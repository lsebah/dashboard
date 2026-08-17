// ─────────────────────────────────────────────────────────────────────────
//  Le REGISTRE DES COMMISSIONS comme second référentiel du Deal Done.
//
//  Règle posée par Laurent (17/08/2026) : « utilise comme référentiel mon
//  tableau de commissions qui reprend l'intégralité de mes deals ».
//
//  Le dossier Outlook « DEAL DONE » raconte ce que l'équipe a ANNONCÉ ; le
//  registre enregistre ce qui a été FAIT. Les deux ne se recouvrent pas :
//  une affaire peut être facturée sans avoir été annoncée au team, et une
//  annonce n'a pas toujours d'ISIN. Croiser les deux est le seul moyen d'avoir
//  la liste complète.
//
//  Deux opérations, jamais plus :
//    • ENRICHIR — un deal annoncé qui correspond à une ligne du registre
//      récupère son ISIN et sa date d'émission. Rien d'autre n'est écrasé :
//      l'UF du deal done fait foi (règle du 16/08).
//    • COMPLÉTER — une ligne du registre sans annonce correspondante devient un
//      deal à part entière, marqué comme venant du registre.
//
//  Le rapprochement est STRICT : ISIN identique, ou même émetteur ET nom de
//  produit qui se recouvrent fortement. Un rapprochement approximatif ferait
//  disparaître un deal réel derrière un autre — c'est pire qu'un doublon, qui
//  se voit.
// ─────────────────────────────────────────────────────────────────────────
import type { CommissionLigne } from './commissions'
import type { Deal } from './deal-done'
import { clefProduit } from './deal-done'

/** Pseudo-ISIN agrégeant plusieurs tranches — hors périmètre (cf. coherence.ts). */
const ISIN_AGREGE = new Set(['FEI'])

/** Mots vides : présents partout, ils ne prouvent aucune ressemblance. */
const VIDES = new Set([
  'phoenix', 'athena', 'athena', 'memoire', 'autocall', 'autocallable', 'worst',
  'wof', 'sur', 'de', 'du', 'la', 'le', 'les', 'et', 'aux', 'des', 'airbag',
  'degressif', 'mensuel', 'mensuelle', 'trimestriel', 'inverse', 'reverse',
])

const mots = (s?: string | null): Set<string> =>
  new Set(
    clefProduit(s ?? '')
      .split(' ')
      .filter((m) => m.length > 3 && !VIDES.has(m)),
  )

/**
 * Deux mots désignent-ils la même chose ? On compare par PRÉFIXE, pas à
 * l'identique : le registre écrit « Ferroviaires + Infra » là où l'annonce dit
 * « Ferroviaire / Infrastructure ». Un pluriel et une abréviation suffisaient à
 * faire échouer le rapprochement, et le produit apparaissait deux fois.
 */
const memeMot = (a: string, b: string): boolean => {
  const n = Math.min(a.length, b.length)
  return n >= 4 && a.slice(0, n) === b.slice(0, n)
}

const communs = (a: Set<string>, b: Set<string>): number => {
  let n = 0
  a.forEach((m) => {
    let trouve = false
    b.forEach((x) => {
      if (!trouve && memeMot(m, x)) trouve = true
    })
    if (trouve) n++
  })
  return n
}

/**
 * Un deal annoncé et une ligne de registre désignent-ils la MÊME affaire ?
 *
 * Vrai si les ISIN coïncident, ou si les libellés partagent au moins deux mots
 * distinctifs (hors vocabulaire de payoff, présent partout). Deux mots, pas un :
 * « Rheinmetall » seul apparaît dans quatre produits différents de 2026.
 */
export function memeAffaire(deal: Deal, ligne: CommissionLigne): boolean {
  if (deal.isin && ligne.isin && deal.isin === ligne.isin) return true
  const a = mots(`${deal.produit} ${deal.description ?? ''}`)
  const b = mots(ligne.description)
  return communs(a, b) >= 2
}

export interface CroisementRegistre {
  /** Deals annoncés, enrichis de l'ISIN et de la date d'émission du registre. */
  deals: Deal[]
  /** Deals créés depuis le registre, faute d'annonce correspondante. */
  ajoutes: Deal[]
  /** ISIN du registre rapprochés d'une annonce existante — traçabilité. */
  rapproches: string[]
}

/**
 * Croise les deals annoncés avec le registre des commissions.
 *
 * `annee` filtre les lignes du registre sur leur date d'émission. Les lignes
 * d'un même ISIN sont regroupées : plusieurs clients sur un produit ne font
 * qu'UN deal, dont le nominal est la somme des tickets.
 */
export function croiserAvecRegistre(
  deals: Deal[],
  lignes: CommissionLigne[],
  annee = '2026',
): CroisementRegistre {
  const retenues = lignes.filter(
    (l) => (l.issue ?? '').startsWith(annee) && !ISIN_AGREGE.has(l.isin),
  )

  // Un ISIN = un produit = un deal, quel que soit le nombre de clients.
  const parIsin = new Map<string, CommissionLigne[]>()
  for (const l of retenues) {
    const g = parIsin.get(l.isin)
    if (g) g.push(l)
    else parIsin.set(l.isin, [l])
  }

  const sortie = deals.map((d) => ({ ...d }))
  const ajoutes: Deal[] = []
  const rapproches: string[] = []
  const dejaPris = new Set<number>()

  parIsin.forEach((groupe, isin) => {
    const ref = groupe[0]
    // Le premier deal non encore apparié qui désigne la même affaire.
    const i = sortie.findIndex((d, idx) => !dejaPris.has(idx) && memeAffaire(d, ref))
    if (i >= 0) {
      dejaPris.add(i)
      rapproches.push(isin)
      // ENRICHISSEMENT seulement : on ne touche ni à l'UF ni au nominal du deal
      // done, qui font foi. On comble ce qui manque, rien de plus.
      if (!sortie[i].isin) sortie[i].isin = isin
      if (!sortie[i].dateEmission && ref.issue) sortie[i].dateEmission = ref.issue
      return
    }
    const nominal = groupe.reduce((s, l) => s + (l.nominal ?? 0), 0)
    ajoutes.push({
      id: `registre-${isin}`,
      // Faute d'annonce, la date d'émission tient lieu de repère chronologique.
      date: ref.issue ?? '',
      // Le registre ne porte pas de RR : on ne l'invente pas.
      rr: undefined as unknown as Deal['rr'],
      produit: ref.description ?? isin,
      description: `Repris du registre des commissions — aucun deal done correspondant dans le dossier Outlook.`,
      emetteur: ref.emetteur ?? undefined,
      devise: ref.devise ?? undefined,
      nominal: nominal > 0 ? nominal : undefined,
      ufGlobal: typeof ref.ufPct === 'number' ? Math.round(ref.ufPct * 10000) / 100 : undefined,
      isin,
      dateEmission: ref.issue ?? undefined,
      source: 'registre des commissions',
    })
  })

  ajoutes.sort((a, b) => b.date.localeCompare(a.date))
  return { deals: sortie, ajoutes, rapproches }
}
