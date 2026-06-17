import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Tickers Bloomberg des sous-jacents des produits VIVANTS (rappelés / vendus /
// échus exclus) qui NE SONT PAS mappables sur Yahoo. On ne sollicite Bloomberg
// que pour les cotations absentes de Yahoo (indices à décrément/propriétaires,
// matières premières, change…) ; les actions et grands indices restent pricés
// par Yahoo. Sert au script Bloomberg (scripts/bloomberg_prices.py).
const CLOSED = new Set(['rappele', 'vendu', 'echu'])

export async function GET() {
  const seen = new Set<string>()
  const underlyings: string[] = []
  for (const p of products) {
    if (CLOSED.has(p.statut ?? '')) continue
    for (const u of p.sousJacents) {
      const b = u.bloomberg?.trim()
      if (!b || seen.has(b)) continue
      if (yahooSymbol(u.bloomberg) !== null) continue // déjà couvert par Yahoo
      seen.add(b)
      underlyings.push(b)
    }
  }
  return NextResponse.json({ underlyings, count: underlyings.length })
}
