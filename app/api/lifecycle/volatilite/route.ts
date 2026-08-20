import { NextResponse } from 'next/server'
import { fetchHistory, lastClose } from '@/lib/yahoo'
import { INDICES_RADAR } from '@/lib/indices-radar'
import {
  pointRadar,
  mediane,
  FENETRE_6M,
  FENETRE_PERCENTILE,
  type PointRadar,
} from '@/lib/volatilite'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
//  Données du radar de volatilité. Tout vient de Yahoo Finance (gratuit, sans
//  clé) : ni Bloomberg, ni abonnement. Route DYNAMIQUE — Yahoo est injoignable
//  au build, et le radar doit de toute façon être lu au jour le jour.
//
//  Un indice qui échoue ne fait pas tomber le radar : il part dans
//  `indisponibles`, avec sa raison. Un radar amputé qui le dit reste lisible ;
//  un radar amputé qui se tait fait croire que l'univers tient en trois points.
// ─────────────────────────────────────────────────────────────────────────

// Trois ans d'historique : il faut FENETRE_PERCENTILE observations d'une vol
// calculée sur FENETRE_6M jours, soit ~378 séances, plus une marge pour les
// jours fériés et les trous de cotation.
const ANNEES_HISTORIQUE = 3

export async function GET() {
  const debut = Math.floor(Date.now() / 1000) - ANNEES_HISTORIQUE * 365 * 24 * 3600

  const resultats = await Promise.all(
    INDICES_RADAR.map(async (idx) => {
      try {
        const bars = await fetchHistory(idx.symbole, debut)
        if (bars.length === 0) return { idx, erreur: 'aucune cotation renvoyée' as const }

        const point = pointRadar(idx.cle, idx.nom, bars)
        if (!point)
          return {
            idx,
            erreur: `historique trop court (${bars.length} séances, il en faut ~${FENETRE_6M + FENETRE_PERCENTILE})` as const,
          }

        // Volatilité implicite publique, quand une existe vraiment. Son échec
        // n'invalide pas le point : c'est un complément, pas un axe.
        let implicite: PointRadar['implicite'] = null
        if (idx.implicite) {
          try {
            const vi = await fetchHistory(idx.implicite.symbole, debut)
            const derniere = lastClose(vi)
            if (typeof derniere === 'number')
              implicite = {
                valeur: derniere,
                nom: idx.implicite.nom,
                horizonJours: idx.implicite.horizonJours,
              }
          } catch {
            /* l'implicite manque : le radar reste juste, il est seulement moins riche */
          }
        }

        return { idx, point: { ...point, implicite, devise: idx.devise } }
      } catch (e) {
        return { idx, erreur: (e as Error).message }
      }
    }),
  )

  const points = resultats
    .map((r) => ('point' in r ? r.point : null))
    .filter((p): p is NonNullable<typeof p> => p != null)

  const indisponibles = resultats
    .filter((r) => 'erreur' in r)
    .map((r) => ({ cle: r.idx.cle, nom: r.idx.nom, symbole: r.idx.symbole, raison: r.erreur }))

  return NextResponse.json({
    genereLe: new Date().toISOString(),
    // La mesure est dite explicitement : le PDF part chez des clients, et une
    // volatilité réalisée ne doit jamais pouvoir se lire comme une implicite.
    mesure: 'volatilité réalisée annualisée',
    fenetreJours: FENETRE_6M,
    fenetrePercentileJours: FENETRE_PERCENTILE,
    volMediane: mediane(points.map((p) => p.vol)),
    points,
    indisponibles,
  })
}
