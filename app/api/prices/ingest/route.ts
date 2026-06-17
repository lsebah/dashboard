import { NextResponse } from 'next/server'
import { kvConfigured, kvGet, kvSet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Ingestion depuis le PC Bloomberg (sans git). Protégé par l'en-tête
// `x-prices-api-key` (= process.env.PRICES_API_KEY).
//
// Corps accepté (tous les champs sont optionnels, au moins un requis) :
//   { "prices": { "ISIN": 99.5, … } }            prix mark-to-market par ISIN
//   { "levels": { "SAF FP": 187.2, … } }          niveaux (PX_Last) par ticker Bloomberg
//   { "remove": ["ISIN", …] }                     purge de clés du surcouche prix
//   [ { "isin": "...", "price": 99.5 }, … ]        forme tableau (prix uniquement)
//
// Upsert (fusion) dans Vercel KV : `prices:overlay` et `levels:overlay`.
// Le surcouche est lue par /api/prices et /api/levels puis appliquée par-dessus
// feed.json côté portefeuille (le plus récent gagne).
const PRICES_KEY = 'prices:overlay'
const LEVELS_KEY = 'levels:overlay'
interface PricesOverlay {
  asof: string
  prices: Record<string, number>
}
interface LevelsOverlay {
  asof: string
  levels: Record<string, number>
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null

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
      { error: 'KV non configuré (KV_REST_API_URL / KV_REST_API_TOKEN ou REDIS_URL).' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }

  // — Prix par ISIN (objet { ISIN: prix } ou tableau [{ isin, price }]) —
  const incomingPrices: Record<string, number> = {}
  const collectPrice = (isin: unknown, price: unknown) => {
    const n = num(price)
    if (typeof isin === 'string' && n !== null) incomingPrices[isin] = n
  }
  let hasPrices = false
  if (Array.isArray(body)) {
    hasPrices = true
    for (const r of body) collectPrice((r as { isin?: unknown })?.isin, (r as { price?: unknown })?.price)
  } else if (body && typeof body === 'object') {
    const p = (body as { prices?: unknown }).prices
    if (p && typeof p === 'object') {
      hasPrices = true
      for (const [k, v] of Object.entries(p)) collectPrice(k, v)
    }
  }

  // — Niveaux des sous-jacents par ticker Bloomberg (PX_Last) —
  const incomingLevels: Record<string, number> = {}
  let hasLevels = false
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const l = (body as { levels?: unknown }).levels
    if (l && typeof l === 'object') {
      hasLevels = true
      for (const [k, v] of Object.entries(l)) {
        const n = num(v)
        if (n !== null) incomingLevels[k] = n
      }
    }
  }

  // — Purge de clés du surcouche prix —
  const removeKeys: string[] = []
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const r = (body as { remove?: unknown }).remove
    if (Array.isArray(r)) for (const k of r) if (typeof k === 'string') removeKeys.push(k)
  }

  if (!hasPrices && !hasLevels && removeKeys.length === 0) {
    return NextResponse.json(
      { error: 'Rien à ingérer. Attendu { prices }, { levels } et/ou { remove }.' },
      { status: 400 },
    )
  }

  const asof = new Date().toISOString()
  const out: Record<string, unknown> = { asof, persisted: true }

  if (hasPrices || removeKeys.length) {
    const prev = (await kvGet<PricesOverlay>(PRICES_KEY)) ?? { asof: '', prices: {} }
    const prices = { ...prev.prices, ...incomingPrices }
    for (const k of removeKeys) delete prices[k]
    const ok = await kvSet(PRICES_KEY, { asof, prices })
    out.persisted = (out.persisted as boolean) && ok
    out.prices = {
      accepted: Object.keys(incomingPrices).length,
      removed: removeKeys.length,
      total: Object.keys(prices).length,
    }
  }

  if (hasLevels) {
    const prev = (await kvGet<LevelsOverlay>(LEVELS_KEY)) ?? { asof: '', levels: {} }
    const levels = { ...prev.levels, ...incomingLevels }
    const ok = await kvSet(LEVELS_KEY, { asof, levels })
    out.persisted = (out.persisted as boolean) && ok
    out.levels = { accepted: Object.keys(incomingLevels).length, total: Object.keys(levels).length }
  }

  return NextResponse.json(out)
}
