import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50' },
  { symbol: 'EURUSD=X', name: 'EUR/USD' },
  { symbol: '^VIX', name: 'VIX' },
  { symbol: 'GC=F', name: 'Gold' },
  { symbol: 'CL=F', name: 'WTI' },
]

interface ChartMeta {
  symbol: string
  regularMarketPrice?: number
  chartPreviousClose?: number
  previousClose?: number
  regularMarketTime?: number
  marketState?: string
}

interface ChartResponse {
  chart: {
    result?: Array<{ meta: ChartMeta }>
    error?: unknown
  }
}

interface MarketItem {
  name: string
  symbol: string
  price: number | null
  change: number | null
  changePct: number | null
  marketState: string
  timestamp?: number
}

async function fetchQuote(symbol: string, name: string): Promise<MarketItem> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`)
    const data: ChartResponse = await res.json()
    const meta = data.chart?.result?.[0]?.meta
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      throw new Error(`Missing meta for ${symbol}`)
    }
    const prevClose = meta.chartPreviousClose ?? meta.previousClose
    const price = meta.regularMarketPrice
    const change = typeof prevClose === 'number' ? price - prevClose : null
    const changePct = typeof prevClose === 'number' && prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : null
    return {
      name,
      symbol,
      price,
      change,
      changePct,
      marketState: meta.marketState ?? 'REGULAR',
      timestamp: meta.regularMarketTime,
    }
  } catch {
    return { name, symbol, price: null, change: null, changePct: null, marketState: 'CLOSED' }
  }
}

export async function GET() {
  const quotes = await Promise.all(SYMBOLS.map((s) => fetchQuote(s.symbol, s.name)))
  const anyLive = quotes.some((q) => q.price !== null)

  const markets: MarketItem[] = [...quotes]

  // Static bond/swap data (no reliable free API)
  const now = Math.floor(Date.now() / 1000)
  markets.push(
    {
      name: 'CMS 10Y',
      symbol: 'CMS10',
      price: 3.042,
      change: -0.012,
      changePct: -0.39,
      marketState: 'REGULAR',
      timestamp: now,
    },
    {
      name: 'OAT 10Y',
      symbol: 'OAT10',
      price: 3.663,
      change: -0.019,
      changePct: -0.52,
      marketState: 'REGULAR',
      timestamp: now,
    },
  )

  return NextResponse.json({
    markets,
    updatedAt: new Date().toISOString(),
    fallback: !anyLive,
  })
}
