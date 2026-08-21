import { NextResponse } from 'next/server'
import { fetchHistory } from '@/lib/yahoo'
import { indiceParCle } from '@/lib/indices-radar'
import {
  COMPOSITIONS,
  CLE_KV_MEMBRES,
  ageDepuis,
  compositionEffective,
  perimeeDepuis,
  retenirMembres,
  type SurcoucheMembres,
} from '@/lib/index-members'
import { kvConfigured, kvGet } from '@/lib/kv'
import { pointRadar, mediane, FENETRE_6M, FENETRE_PERCENTILE } from '@/lib/volatilite'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
//  Radar de volatilité des COMPOSANTS d'un indice — la lecture d'origine de
//  l'outil Leonteq, qui choisit une VALEUR pour un autocall ou un
//  participatif, pas un indice.
//
//  La composition vient d'un fichier versionné, rafraîchi mensuellement
//  (cf. lib/index-members.ts), ou du KV quand c'est le run Bloomberg quotidien
//  qui l'a rapportée — le CAC 40, l'Euro Stoxx 50 et le MSCI World n'ont pas de
//  source publique scrapable. Les deux origines suivent la règle des prix : le
//  plus récent gagne, et l'écran CITE celle qui a servi. Les cours, eux,
//  viennent de Yahoo comme le reste du site.
//
//  DEUX PLAFONDS, TOUS DEUX DITS À VOIX HAUTE :
//   • le nombre de valeurs tracées — chaque valeur coûte un historique, et le
//     S&P 500 en demanderait cinq cents ; on garde les plus lourdes ;
//   • la concurrence des appels — Yahoo n'aime pas soixante requêtes d'un
//     coup, et un radar à moitié vide serait pire qu'un radar lent.
//  Une valeur qui échoue part dans `indisponibles` avec sa raison, elle ne
//  disparaît pas du décompte.
// ─────────────────────────────────────────────────────────────────────────

const PLAFOND_DEFAUT = 60
// Yahoo encaisse largement douze requêtes de front ; six faisaient dix vagues
// là où cinq suffisent, et c'est ce qui poussait la route au-delà du délai.
const CONCURRENCE = 12
const ANNEES_HISTORIQUE = 3

// ─────────────────────────────────────────────────────────────────────────
//  POURQUOI CE `maxDuration`
//
//  Soixante historiques à récupérer, c'est long — et sans cette ligne, Vercel
//  applique son délai par défaut (dix secondes), qui coupe la route AVANT
//  qu'elle ait fini. Le navigateur reçoit alors une erreur, l'écran reste
//  vide, et rien ne dit pourquoi : le radar « ne marche pas » alors que la
//  composition est bonne et que Yahoo répond. C'est exactement le défaut
//  constaté en production le 20/08/2026.
//
//  Le budget est donc porté à soixante secondes. Ce n'est pas un pansement :
//  le travail est réellement long, et mieux vaut une planche qui met cinq
//  secondes à s'afficher qu'une planche qui n'arrive jamais.
// ─────────────────────────────────────────────────────────────────────────
export const maxDuration = 60

/** Exécute `taches` par vagues de `n` — un ordonnanceur minimal, sans dépendance. */
async function parVagues<T, R>(items: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += n) {
    out.push(...(await Promise.all(items.slice(i, i + n).map(f))))
  }
  return out
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const cle = (url.searchParams.get('indice') ?? '').toUpperCase()
  const plafond = Math.min(Number(url.searchParams.get('plafond')) || PLAFOND_DEFAUT, 120)

  const indice = indiceParCle(cle)
  if (!indice) return NextResponse.json({ error: `indice inconnu : ${cle || '(vide)'}` }, { status: 400 })

  // Le KV n'est pas indispensable : sans lui, on retombe exactement sur le
  // fichier versionné, comportement d'avant la surcouche.
  const surcouche = kvConfigured() ? await kvGet<SurcoucheMembres>(CLE_KV_MEMBRES) : null
  const compo = compositionEffective(cle, surcouche)
  if (!compo) {
    // Pas de liste = pas de radar. On le dit, avec la source à interroger —
    // plutôt qu'un graphique vide qui laisserait croire à un marché calme.
    return NextResponse.json(
      {
        indice: { cle, nom: indice.nom },
        composition: null,
        raison:
          'composition non renseignée — ni le job mensuel « Rafraîchit les membres des indices » ni le run Bloomberg quotidien ne l’ont écrite.',
        source: COMPOSITIONS[cle]?.source ?? null,
        points: [],
        indisponibles: [],
      },
      { status: 200 },
    )
  }

  const { membres, total, tronque } = retenirMembres(compo, plafond)
  const debut = Math.floor(Date.now() / 1000) - ANNEES_HISTORIQUE * 365 * 24 * 3600

  const resultats = await parVagues(membres, CONCURRENCE, async (m) => {
    try {
      const bars = await fetchHistory(m.symbole, debut)
      if (bars.length === 0) return { m, erreur: 'aucune cotation renvoyée' }
      const p = pointRadar(m.symbole, m.nom, bars)
      if (!p) return { m, erreur: `historique trop court (${bars.length} séances)` }
      return { m, point: { ...p, poids: m.poids ?? null } }
    } catch (e) {
      return { m, erreur: (e as Error).message }
    }
  })

  const points = resultats
    .map((r) => ('point' in r ? r.point : null))
    .filter((p): p is NonNullable<typeof p> => p != null)

  const indisponibles = resultats
    .filter((r) => 'erreur' in r)
    .map((r) => ({ symbole: r.m.symbole, nom: r.m.nom, raison: (r as { erreur: string }).erreur }))

  return NextResponse.json({
    genereLe: new Date().toISOString(),
    indice: { cle, nom: indice.nom },
    mesure: 'volatilité réalisée annualisée',
    fenetreJours: FENETRE_6M,
    fenetrePercentileJours: FENETRE_PERCENTILE,
    composition: {
      source: compo.source,
      majLe: compo.majLe,
      ageJours: ageDepuis(compo.majLe),
      perimee: perimeeDepuis(compo.majLe),
      total,
      traces: points.length,
      tronque,
      // Membres que Bloomberg a rendus mais qu'aucun symbole Yahoo ne suit
      // (places asiatiques, canadiennes…) : ils ne sont pas dans `total`, et
      // taire leur nombre laisserait croire l'indice plus petit qu'il n'est.
      ...(surcouche?.indices?.[cle]?.ecartes
        ? { nonMappes: surcouche.indices[cle].ecartes }
        : {}),
    },
    volMediane: mediane(points.map((p) => p.vol)),
    points,
    indisponibles,
  })
}
