import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Bar {
  date: string // yyyy-mm-dd
  close: number
}

interface YahooChart {
  chart: {
    result?: Array<{
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: (number | null)[] }> }
    }>
    error?: unknown
  }
}

/** Historique des clôtures quotidiennes d'un symbole Yahoo, du strike à aujourd'hui. */
async function fetchHistory(symbol: string, period1: number): Promise<Bar[]> {
  const period2 = Math.floor(Date.now() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?period1=${period1}&period2=${period2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`)
  const data: YahooChart = await res.json()
  const r = data.chart?.result?.[0]
  const ts = r?.timestamp
  const closes = r?.indicators?.quote?.[0]?.close
  if (!ts || !closes) return []
  const out: Bar[] = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (typeof c === 'number') out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c })
  }
  return out
}

/** Dernière clôture à la date cible (jour de bourse ≤ cible). */
function closeAt(bars: Bar[], target: string): number | undefined {
  let val: number | undefined
  for (const b of bars) {
    if (b.date <= target) val = b.close
    else break
  }
  return val
}

export async function GET(req: Request) {
  const isin = new URL(req.url).searchParams.get('isin')
  if (!isin) return NextResponse.json({ error: 'isin requis' }, { status: 400 })
  const p = products.find((x) => x.isin === isin)
  if (!p) return NextResponse.json({ error: 'produit inconnu' }, { status: 404 })

  const symbols = p.sousJacents.map((u) => yahooSymbol(u.bloomberg))
  if (symbols.length === 0 || symbols.some((s) => s === null)) {
    return NextResponse.json({
      isin,
      niveaux: {},
      incomplet: true,
      raison: 'un sous-jacent au moins n’est pas disponible sur Yahoo (indice propriétaire / taux)',
    })
  }

  const period1 = Math.floor(new Date(p.dateConstatationInitiale).getTime() / 1000)
  if (!Number.isFinite(period1)) {
    return NextResponse.json({ isin, niveaux: {}, incomplet: true, raison: 'date initiale invalide' })
  }

  try {
    const histories = await Promise.all((symbols as string[]).map((s) => fetchHistory(s, period1)))
    // Strike = clôture de chaque sous-jacent à la date de constatation initiale.
    const strikes = histories.map((h) => closeAt(h, p.dateConstatationInitiale) ?? h[0]?.close)
    if (strikes.some((s) => !s)) {
      return NextResponse.json({ isin, niveaux: {}, incomplet: true, raison: 'strike introuvable' })
    }

    const today = new Date().toISOString().slice(0, 10)
    const niveaux: Record<string, number> = {}
    for (const o of p.observations ?? []) {
      const d = o.dateObservation
      if (d > today) continue
      let worst: number | undefined
      for (let j = 0; j < histories.length; j++) {
        const c = closeAt(histories[j], d)
        if (typeof c !== 'number') {
          worst = undefined
          break
        }
        const perf = (c / (strikes[j] as number)) * 100
        worst = worst === undefined ? perf : Math.min(worst, perf)
      }
      if (typeof worst === 'number') niveaux[d] = Math.round(worst * 100) / 100
    }
    return NextResponse.json({ isin, niveaux, symbols })
  } catch (e) {
    return NextResponse.json({ isin, niveaux: {}, incomplet: true, raison: String(e) })
  }
}
