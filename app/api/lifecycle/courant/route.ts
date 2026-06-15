import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'
import { fetchHistory, closeAt, lastClose, type Bar } from '@/lib/yahoo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Niveau COURANT du worst-of par produit (en % du strike), pour estimer la
// probabilité d'autocall dans le calendrier. Batché : on ne télécharge qu'UNE
// fois l'historique de chaque symbole Yahoo (mutualisé entre produits).
export async function GET(req: Request) {
  const isinsParam = new URL(req.url).searchParams.get('isins')
  const wanted = isinsParam ? new Set(isinsParam.split(',').filter(Boolean)) : null
  const list = products.filter(
    (p) => (!wanted || wanted.has(p.isin)) && p.sousJacents.length > 0,
  )

  // Symboles Yahoo uniques → période de départ la plus ancienne nécessaire.
  const symPeriod = new Map<string, number>()
  for (const p of list) {
    const t = Math.floor(new Date(p.dateConstatationInitiale).getTime() / 1000)
    const p1 = Number.isFinite(t) ? t : Math.floor(Date.now() / 1000) - 5 * 365 * 86400
    for (const u of p.sousJacents) {
      const s = yahooSymbol(u.bloomberg)
      if (!s) continue
      symPeriod.set(s, Math.min(symPeriod.get(s) ?? p1, p1))
    }
  }

  const hist = new Map<string, Bar[]>()
  await Promise.all(
    Array.from(symPeriod.entries()).map(async ([s, p1]) => {
      try {
        hist.set(s, await fetchHistory(s, p1))
      } catch {
        hist.set(s, [])
      }
    }),
  )

  const today = new Date().toISOString().slice(0, 10)
  const courant: Record<
    string,
    {
      worstOf: number | null
      sj: { nom: string; pct: number | null }[]
      niveaux: Record<string, number>
    }
  > = {}
  for (const p of list) {
    // Par sous-jacent : barres Yahoo + strike (TS ou reconstruit à la constatation
    // initiale). Mutualisé avec le calcul du worst-of constaté ci-dessous.
    const cols = p.sousJacents.map((u) => {
      const s = yahooSymbol(u.bloomberg)
      const bars = s ? hist.get(s) ?? [] : []
      const strike =
        u.niveauInitial ?? closeAt(bars, p.dateConstatationInitiale) ?? bars[0]?.close
      return { nom: u.nom, bars, strike }
    })

    // Niveaux COURANTS (% du strike) par sous-jacent — résilient.
    const sj = cols.map((c) => {
      const last = lastClose(c.bars)
      const pct =
        typeof last === 'number' && typeof c.strike === 'number' && c.strike > 0
          ? Math.round((last / c.strike) * 10000) / 100
          : null
      return { nom: c.nom, pct }
    })
    const worstOf = sj.some((x) => x.pct === null)
      ? null
      : Math.min(...sj.map((x) => x.pct as number))

    // Worst-of CONSTATÉ aux observations passées (suivi des coupons → P&L coupons
    // inclus dans la colonne, comme la fiche). Nécessite TOUS les sous-jacents.
    const niveaux: Record<string, number> = {}
    const complet = cols.every((c) => typeof c.strike === 'number' && c.bars.length > 0)
    if (complet) {
      for (const o of p.observations ?? []) {
        if (o.dateObservation > today) continue
        let worst: number | undefined
        for (const c of cols) {
          const cl = closeAt(c.bars, o.dateObservation)
          if (typeof cl !== 'number') {
            worst = undefined
            break
          }
          const perf = (cl / (c.strike as number)) * 100
          worst = worst === undefined ? perf : Math.min(worst, perf)
        }
        if (typeof worst === 'number') niveaux[o.dateObservation] = Math.round(worst * 100) / 100
      }
    }

    courant[p.isin] = { worstOf, sj, niveaux }
  }

  return NextResponse.json({ courant })
}
