import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Flux de marché TEMPS RÉEL (Yahoo). Groupés pour le terminal Bloomberg.
// unit : 'pts' (indices) · '' (FX) · '$' (commodités) · '%' (rendements / VIX).
interface Sym {
  symbol: string
  name: string
  group: string
  unit: string
}
const SYMBOLS: Sym[] = [
  // Indices
  { symbol: '^GSPC', name: 'S&P 500', group: 'Indices', unit: 'pts' },
  { symbol: '^IXIC', name: 'Nasdaq', group: 'Indices', unit: 'pts' },
  { symbol: '^DJI', name: 'Dow Jones', group: 'Indices', unit: 'pts' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50', group: 'Indices', unit: 'pts' },
  { symbol: '^FCHI', name: 'CAC 40', group: 'Indices', unit: 'pts' },
  { symbol: '^GDAXI', name: 'DAX', group: 'Indices', unit: 'pts' },
  { symbol: '^FTSE', name: 'FTSE 100', group: 'Indices', unit: 'pts' },
  { symbol: '^N225', name: 'Nikkei 225', group: 'Indices', unit: 'pts' },
  // Change
  { symbol: 'EURUSD=X', name: 'EUR/USD', group: 'Change', unit: '' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD', group: 'Change', unit: '' },
  { symbol: 'USDJPY=X', name: 'USD/JPY', group: 'Change', unit: '' },
  { symbol: 'EURGBP=X', name: 'EUR/GBP', group: 'Change', unit: '' },
  { symbol: 'USDCHF=X', name: 'USD/CHF', group: 'Change', unit: '' },
  // Commodités
  { symbol: 'GC=F', name: 'Or (Gold)', group: 'Commodités', unit: '$' },
  { symbol: 'SI=F', name: 'Argent (Silver)', group: 'Commodités', unit: '$' },
  { symbol: 'CL=F', name: 'WTI', group: 'Commodités', unit: '$' },
  { symbol: 'BZ=F', name: 'Brent', group: 'Commodités', unit: '$' },
  // Taux souverains US (rendements Treasury)
  { symbol: '^IRX', name: 'US T-Bill 13W', group: 'Taux souverains US', unit: '%' },
  { symbol: '^FVX', name: 'US 5Y', group: 'Taux souverains US', unit: '%' },
  { symbol: '^TNX', name: 'US 10Y', group: 'Taux souverains US', unit: '%' },
  { symbol: '^TYX', name: 'US 30Y', group: 'Taux souverains US', unit: '%' },
  // Volatilité
  { symbol: '^VIX', name: 'VIX', group: 'Volatilité', unit: '' },
]

interface ChartMeta {
  regularMarketPrice?: number
  chartPreviousClose?: number
  previousClose?: number
  regularMarketTime?: number
  marketState?: string
}
interface MarketItem {
  group: string
  name: string
  symbol: string
  unit: string
  price: number | null
  change: number | null
  changePct: number | null
  marketState: string
  timestamp?: number
}

async function fetchQuote(s: Sym): Promise<MarketItem> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?interval=1d&range=1d`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`Yahoo ${s.symbol} ${res.status}`)
    const data = (await res.json()) as { chart?: { result?: Array<{ meta: ChartMeta }> } }
    const meta = data.chart?.result?.[0]?.meta
    if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('no meta')
    const prev = meta.chartPreviousClose ?? meta.previousClose
    const price = meta.regularMarketPrice
    const change = typeof prev === 'number' ? price - prev : null
    const changePct = typeof prev === 'number' && prev !== 0 ? ((price - prev) / prev) * 100 : null
    return { group: s.group, name: s.name, symbol: s.symbol, unit: s.unit, price, change, changePct, marketState: meta.marketState ?? 'REGULAR', timestamp: meta.regularMarketTime }
  } catch {
    return { group: s.group, name: s.name, symbol: s.symbol, unit: s.unit, price: null, change: null, changePct: null, marketState: 'CLOSED' }
  }
}

export async function GET() {
  const items = await Promise.all(SYMBOLS.map(fetchQuote))
  return NextResponse.json({ items, updatedAt: new Date().toISOString(), live: items.some((i) => i.price !== null) })
}
