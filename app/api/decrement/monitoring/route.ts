import { NextResponse } from 'next/server'
import seed from '@/data/decrement-monitoring.json'
import { kvConfigured, kvGet } from '@/lib/kv'
import type { MonitoringState } from '@/lib/decrement/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// État live de la veille pour le dashboard : KV si dispo, sinon le seed versionné.
export async function GET() {
  const live = kvConfigured() ? await kvGet<MonitoringState>('decrement:monitoring') : null
  return NextResponse.json(live ?? (seed as MonitoringState))
}
