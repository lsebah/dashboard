import { NextResponse } from 'next/server'
import { products } from '@/lib/products'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Liste des ISIN VIVANTS du portefeuille (rappelés / vendus / échus exclus).
// Sert au script Bloomberg (scripts/bloomberg_prices.py) pour savoir quoi pricer
// sans avoir besoin du dépôt cloné sur le PC.
const CLOSED = new Set(['rappele', 'vendu', 'echu'])

export async function GET() {
  const seen = new Set<string>()
  const isins: string[] = []
  for (const p of products) {
    if (CLOSED.has(p.statut ?? '')) continue
    if (!seen.has(p.isin)) {
      seen.add(p.isin)
      isins.push(p.isin)
    }
  }
  return NextResponse.json({ isins, count: isins.length })
}
