import { NextResponse } from 'next/server'
import { products } from '@/lib/products'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Liste des tickers Bloomberg DISTINCTS des sous-jacents des produits VIVANTS
// (rappelés / vendus / échus exclus). Sert au script Bloomberg
// (scripts/bloomberg_prices.py) pour savoir quels niveaux (PX_Last) récupérer,
// sans avoir besoin du dépôt cloné sur le PC.
const CLOSED = new Set(['rappele', 'vendu', 'echu'])

export async function GET() {
  const seen = new Set<string>()
  const underlyings: string[] = []
  for (const p of products) {
    if (CLOSED.has(p.statut ?? '')) continue
    for (const u of p.sousJacents) {
      const b = u.bloomberg?.trim()
      if (b && !seen.has(b)) {
        seen.add(b)
        underlyings.push(b)
      }
    }
  }
  return NextResponse.json({ underlyings, count: underlyings.length })
}
