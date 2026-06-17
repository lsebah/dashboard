import { NextResponse } from 'next/server'
import { kvConfigured, kvGet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Surcouche des NIVEAUX (PX_Last) des sous-jacents, par ticker Bloomberg,
// alimentée par /api/prices/ingest (PC Bloomberg). Sert à afficher la perf
// courante des sous-jacents non mappables Yahoo (indices à décrément…).
interface Overlay {
  asof: string
  levels: Record<string, number>
}

export async function GET() {
  const o = kvConfigured() ? await kvGet<Overlay>('levels:overlay') : null
  return NextResponse.json(o ?? { asof: null, levels: {} })
}
