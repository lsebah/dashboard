import { NextResponse } from 'next/server'
import { kvConfigured, kvGet, kvSet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Ingestion des prix mark-to-market (depuis le PC Bloomberg, sans git).
// Protégé par l'en-tête `x-prices-api-key` (= process.env.PRICES_API_KEY).
// Corps accepté : { "prices": { "ISIN": 99.5, … } }  OU  [{ "isin": "...", "price": 99.5 }, …]
// Upsert (fusion) dans Vercel KV sous `prices:overlay`. Lu par /api/prices et
// surchargé côté portefeuille par-dessus feed.json (le plus récent gagne).
const KEY = 'prices:overlay'
interface Overlay {
  asof: string
  prices: Record<string, number>
}

export async function POST(req: Request) {
  const secret = process.env.PRICES_API_KEY
  if (!secret) {
    return NextResponse.json({ error: 'PRICES_API_KEY non configurée côté serveur.' }, { status: 503 })
  }
  if (req.headers.get('x-prices-api-key') !== secret) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      { error: 'KV non configuré (KV_REST_API_URL / KV_REST_API_TOKEN).' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }

  const incoming: Record<string, number> = {}
  const collect = (isin: unknown, price: unknown) => {
    if (typeof isin === 'string' && typeof price === 'number' && Number.isFinite(price)) {
      incoming[isin] = Math.round(price * 10000) / 10000
    }
  }
  if (Array.isArray(body)) {
    for (const r of body) collect((r as { isin?: unknown })?.isin, (r as { price?: unknown })?.price)
  } else if (body && typeof body === 'object') {
    const p = (body as { prices?: unknown }).prices
    if (p && typeof p === 'object') for (const [k, v] of Object.entries(p)) collect(k, v)
  }

  const n = Object.keys(incoming).length
  if (n === 0) {
    return NextResponse.json(
      { error: 'Aucun prix valide. Attendu { "prices": { "ISIN": nombre } }.' },
      { status: 400 },
    )
  }

  const prev = (await kvGet<Overlay>(KEY)) ?? { asof: '', prices: {} }
  const asof = new Date().toISOString()
  const merged: Overlay = { asof, prices: { ...prev.prices, ...incoming } }
  const persisted = await kvSet(KEY, merged)

  return NextResponse.json({ accepted: n, total: Object.keys(merged.prices).length, asof, persisted })
}
