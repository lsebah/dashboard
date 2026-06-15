import { NextResponse } from 'next/server'
import { SEED } from '@/lib/frn/store'
import type { FrnQuote } from '@/lib/frn/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET : renvoie le seed versionné (lecture publique).
export async function GET() {
  return NextResponse.json({ quotes: SEED, count: SEED.length })
}

function valid(q: unknown): q is FrnQuote {
  if (!q || typeof q !== 'object') return false
  const o = q as Record<string, unknown>
  return (
    typeof o.issuer === 'string' &&
    (o.currency === 'EUR' || o.currency === 'USD') &&
    (o.callType === 'NC' || o.callType === 'CALLABLE') &&
    typeof o.maturityYears === 'number' &&
    typeof o.coupon === 'number' &&
    typeof o.uf === 'number' &&
    (o.sensitivity === null || typeof o.sensitivity === 'number')
  )
}

// POST : ingestion de runs (phase 2). Protégé par header x-frn-api-key.
// Upsert par (issuer, currency, callType, maturityYears) — un nouveau run écrase
// l'ancien prix du même couple. Persistance durable = à brancher (Vercel KV / DB) :
// le FS Vercel est read-only au runtime, donc on valide ici et on prépare le
// contrat d'API, sans écrire le JSON versionné.
export async function POST(req: Request) {
  const secret = process.env.FRN_API_KEY
  if (!secret) {
    return NextResponse.json(
      { error: 'FRN_API_KEY non configurée côté serveur.' },
      { status: 503 },
    )
  }
  if (req.headers.get('x-frn-api-key') !== secret) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Le corps doit être un tableau de FrnQuote.' }, { status: 400 })
  }

  const accepted: FrnQuote[] = []
  const rejected: { index: number; reason: string }[] = []
  body.forEach((q, i) => (valid(q) ? accepted.push(q) : rejected.push({ index: i, reason: 'champ requis manquant/invalide' })))

  // Clés (issuer|currency|callType|maturityYears) qui seraient upsertées.
  const keys = accepted.map((q) => `${q.issuer}|${q.currency}|${q.callType}|${q.maturityYears}`)

  return NextResponse.json({
    accepted: accepted.length,
    rejected,
    upsertKeys: keys,
    persisted: false,
    note: 'Validation OK. Persistance durable à brancher (Vercel KV / base). Le run le plus récent écrase le couple existant.',
  })
}
