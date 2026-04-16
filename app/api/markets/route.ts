import { NextResponse } from 'next/server'

const SYMBOLS = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^STOXX50E', name: 'Euro Stoxx 50' },
  { symbol: 'EURUSD=X', name: 'EUR/USD' },
  { symbol: '^VIX', name: 'VIX' },
  { symbol: 'GC=F', name: 'Gold' },
  { symbol: 'CL=F', name: 'WTI' },
]

interface YahooQuote {
  symbol: string
  regularMarketPrice: number
  regularMarketChange: number
  regularMarketChangePercent: number
  marketState: string
  regularMarketTime: number
}

interface YahooResponse {
  quoteResponse: {
    result: YahooQuote[]
  }
}

export async function GET() {
  try {
    const symbolList = SYMBOLS.map((s) => s.symbol).join(',')
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 300 }, // cache 5 min
    })

    if (!res.ok) throw new Error(`Yahoo Finance API error: ${res.status}`)

    const data: YahooResponse = await res.json()
    const quotes = data.quoteResponse?.result ?? []

    const markets = SYMBOLS.map((s) => {
      const quote = quotes.find((q: YahooQuote) => q.symbol === s.symbol)
      if (!quote) return { ...s, price: null, change: null, changePct: null, marketState: 'CLOSED' }

      return {
        name: s.name,
        symbol: s.symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePct: quote.regularMarketChangePercent,
        marketState: quote.marketState,
        timestamp: quote.regularMarketTime,
      }
    })

    // Add static bond/swap data (no reliable free API)
    markets.push(
      {
        name: 'CMS 10Y',
        symbol: 'CMS10',
        price: 3.042,
        change: -0.012,
        changePct: -0.39,
        marketState: 'REGULAR',
        timestamp: Math.floor(Date.now() / 1000),
      },
      {
        name: 'OAT 10Y',
        symbol: 'OAT10',
        price: 3.663,
        change: -0.019,
        changePct: -0.52,
        marketState: 'REGULAR',
        timestamp: Math.floor(Date.now() / 1000),
      },
    )

    return NextResponse.json({ markets, updatedAt: new Date().toISOString() })
  } catch {
    // Fallback with last known data
    return NextResponse.json({
      markets: [
        { name: 'S&P 500', symbol: '^GSPC', price: 7022.95, change: 55.57, changePct: 0.80, marketState: 'CLOSED' },
        { name: 'Nasdaq', symbol: '^IXIC', price: 24016.02, change: 376.93, changePct: 1.59, marketState: 'CLOSED' },
        { name: 'Euro Stoxx 50', symbol: '^STOXX50E', price: 5968.55, change: 28.21, changePct: 0.47, marketState: 'CLOSED' },
        { name: 'EUR/USD', symbol: 'EURUSD=X', price: 1.178, change: -0.0021, changePct: -0.18, marketState: 'CLOSED' },
        { name: 'VIX', symbol: '^VIX', price: 18.10, change: -0.07, changePct: -0.39, marketState: 'CLOSED' },
        { name: 'Gold', symbol: 'GC=F', price: 4832.76, change: 9.16, changePct: 0.19, marketState: 'CLOSED' },
        { name: 'WTI', symbol: 'CL=F', price: 92.48, change: 1.19, changePct: 1.30, marketState: 'CLOSED' },
        { name: 'CMS 10Y', symbol: 'CMS10', price: 3.042, change: -0.012, changePct: -0.39, marketState: 'REGULAR' },
        { name: 'OAT 10Y', symbol: 'OAT10', price: 3.663, change: -0.019, changePct: -0.52, marketState: 'REGULAR' },
      ],
      updatedAt: new Date().toISOString(),
      fallback: true,
    })
  }
}
