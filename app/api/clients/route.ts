import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { kvConfigured, kvGet } from '@/lib/kv'
import { clientsAvecReporting } from '@/lib/client-report'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Liste des clients ayant au moins une position vivante valorisée — consommée par
// scripts/reporting_clients.mjs pour générer un PDF par client. Même règle que le
// reporting (lib/client-report) afin de ne lister que les clients réellement rendus.
interface Overlay {
  prices: Record<string, number>
}

export async function GET() {
  const o = kvConfigured() ? await kvGet<Overlay>('prices:overlay') : null
  const priceMap = o?.prices ?? {}
  const clients = clientsAvecReporting(products, { perfMap: {}, niveauxMap: {}, priceMap })
  return NextResponse.json({ clients })
}
