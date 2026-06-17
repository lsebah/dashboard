import { NextResponse } from 'next/server'
import { kvConfigured, kvGet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Surcouche de prix (Vercel KV) alimentée par /api/prices/ingest (PC Bloomberg).
// Lue côté portefeuille et appliquée par-dessus feed.json (le plus récent gagne).
interface Overlay {
  asof: string
  prices: Record<string, number>
}

export async function GET() {
  const o = kvConfigured() ? await kvGet<Overlay>('prices:overlay') : null
  return NextResponse.json(o ?? { asof: null, prices: {} })
}
