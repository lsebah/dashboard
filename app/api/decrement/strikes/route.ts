import { NextResponse } from 'next/server'
import { kvConfigured, kvGet } from '@/lib/kv'

export const dynamic = 'force-dynamic'

interface StrikesOverlay {
  asof: string
  strikes: Record<string, { ticker?: string; date?: string; value: number }>
}

// Strikes (valeurs initiales) des indices décrément par ISIN produit, récupérés
// par Bloomberg (date de constatation initiale) et posés via /api/prices/ingest.
export async function GET() {
  const o = kvConfigured() ? await kvGet<StrikesOverlay>('decrement:strikes:overlay') : null
  return NextResponse.json(o ?? { asof: null, strikes: {} })
}
