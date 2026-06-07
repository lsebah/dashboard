// ─────────────────────────────────────────────────────────────────────────
//  Helpers Yahoo Finance (serveur uniquement) — historique de clôtures.
//  Utilisé par les routes /api/lifecycle/niveaux et /api/lifecycle/courant.
//  NB : bloqué dans le sandbox de build (« Host not in allowlist »), fonctionne
//  au request-time sur Vercel. Toujours appeler depuis une route dynamique.
// ─────────────────────────────────────────────────────────────────────────

export interface Bar {
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

/** Historique des clôtures quotidiennes d'un symbole Yahoo, de `period1` (epoch s) à aujourd'hui. */
export async function fetchHistory(symbol: string, period1: number): Promise<Bar[]> {
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
    if (typeof c === 'number')
      out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c })
  }
  return out
}

/** Dernière clôture à la date cible (dernier jour de bourse ≤ cible). */
export function closeAt(bars: Bar[], target: string): number | undefined {
  let val: number | undefined
  for (const b of bars) {
    if (b.date <= target) val = b.close
    else break
  }
  return val
}

/** Dernière clôture connue de la série. */
export function lastClose(bars: Bar[]): number | undefined {
  return bars.length ? bars[bars.length - 1].close : undefined
}
