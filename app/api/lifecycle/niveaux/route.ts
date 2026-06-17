import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'
import { fetchHistory, closeAt, lastClose, type Bar } from '@/lib/yahoo'
import { kvConfigured, kvGet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Niveau worst-of constaté à chaque observation passée (pour le suivi des
// coupons) + niveaux COURANTS des sous-jacents (en % du strike) pour afficher la
// performance dans la fiche produit.
//
// Le strike de chaque sous-jacent est soit figé dans la termsheet
// (`niveauInitial`), soit RECONSTRUIT = clôture Yahoo à la date de constatation
// initiale. Le calcul est résilient par sous-jacent : un sous-jacent
// indisponible (indice propriétaire, échec Yahoo) ⇒ « — » pour CELUI-LÀ
// uniquement, les autres affichent bien leur performance.
export async function GET(req: Request) {
  const isin = new URL(req.url).searchParams.get('isin')
  if (!isin) return NextResponse.json({ error: 'isin requis' }, { status: 400 })
  const p = products.find((x) => x.isin === isin)
  if (!p) return NextResponse.json({ error: 'produit inconnu' }, { status: 404 })

  const t = Math.floor(new Date(p.dateConstatationInitiale).getTime() / 1000)
  const period1 = Number.isFinite(t) ? t : Math.floor(Date.now() / 1000) - 5 * 365 * 86400

  // Par sous-jacent : symbole Yahoo, historique, strike (TS ou reconstruit).
  const cols = await Promise.all(
    p.sousJacents.map(async (u) => {
      const sym = yahooSymbol(u.bloomberg)
      let bars: Bar[] = []
      if (sym) {
        try {
          bars = await fetchHistory(sym, period1)
        } catch {
          bars = []
        }
      }
      const strike =
        u.niveauInitial ?? closeAt(bars, p.dateConstatationInitiale) ?? bars[0]?.close
      return { nom: u.nom, sym, bars, strike, bbg: u.bloomberg?.trim() }
    }),
  )

  // Niveaux Bloomberg (PX_Last) par ticker — repli pour les sous-jacents non
  // mappables Yahoo (indices à décrément, baskets propriétaires…).
  const levels = kvConfigured()
    ? (await kvGet<{ levels: Record<string, number> }>('levels:overlay'))?.levels ?? {}
    : {}

  // Niveaux courants (% du strike) par sous-jacent — résilient. Repli sur le
  // niveau Bloomberg (PX_Last) quand Yahoo n'a pas de clôture (décréments…).
  const sj = cols.map((c) => {
    const last = lastClose(c.bars) ?? (c.bbg ? levels[c.bbg] : undefined)
    const pct =
      typeof last === 'number' && typeof c.strike === 'number' && c.strike > 0
        ? Math.round((last / c.strike) * 10000) / 100
        : null
    return { nom: c.nom, pct }
  })
  const worstOf = sj.some((x) => x.pct === null)
    ? null
    : Math.min(...sj.map((x) => x.pct as number))

  // Worst-of constaté aux observations passées (suivi des coupons) : nécessite
  // TOUS les sous-jacents (strike + historique). Sinon on saute le suivi.
  const niveaux: Record<string, number> = {}
  const complet = cols.every((c) => typeof c.strike === 'number' && c.bars.length > 0)
  if (complet) {
    const today = new Date().toISOString().slice(0, 10)
    for (const o of p.observations ?? []) {
      const d = o.dateObservation
      if (d > today) continue
      let worst: number | undefined
      for (const c of cols) {
        const cl = closeAt(c.bars, d)
        if (typeof cl !== 'number') {
          worst = undefined
          break
        }
        const perf = (cl / (c.strike as number)) * 100
        worst = worst === undefined ? perf : Math.min(worst, perf)
      }
      if (typeof worst === 'number') niveaux[d] = Math.round(worst * 100) / 100
    }
  }

  return NextResponse.json({
    isin,
    niveaux,
    symbols: cols.map((c) => c.sym),
    courant: { worstOf, sj },
  })
}
