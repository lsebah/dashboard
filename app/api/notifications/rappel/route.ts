import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { messageRappel } from '@/lib/rappel'
import { kvConfigured, kvGet, kvSet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Envoi de l'email de rappel (autocall déclenché) pour un ISIN → L.sebah@cmf.finance.
// Idempotent : un même ISIN n'est notifié qu'UNE fois (dédup KV), sauf `force`.
// Appelé au clic « Marquer rappelé » et par le cron santé (détection quotidienne).
//   Body : { isin: string, force?: boolean }
const NOTIFIES_KEY = 'cmf:rappels:notifies:v1'

export async function POST(req: Request) {
  let body: { isin?: string; force?: boolean }
  try {
    body = (await req.json()) as { isin?: string; force?: boolean }
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }
  const isin = (body.isin ?? '').trim()
  if (!isin) return NextResponse.json({ error: 'isin requis' }, { status: 400 })

  const p = products.find((x) => x.isin === isin)
  if (!p) return NextResponse.json({ error: 'ISIN inconnu' }, { status: 404 })

  // Dédup : déjà notifié ?
  const notifies = (kvConfigured() ? await kvGet<string[]>(NOTIFIES_KEY) : null) ?? []
  if (!body.force && notifies.includes(isin)) {
    return NextResponse.json({ ok: true, sent: false, reason: 'déjà notifié' })
  }

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ ok: true, sent: false, reason: 'RESEND_API_KEY absent' })

  const from = process.env.NOTIF_EMAIL_FROM || 'l.sebah@cmf.finance'
  const to = process.env.NOTIF_EMAIL_TO || 'L.sebah@cmf.finance'
  const { subject, text } = messageRappel(p)
  let sent = false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
    sent = res.ok
  } catch {
    sent = false
  }

  if (sent && kvConfigured() && !notifies.includes(isin)) {
    await kvSet(NOTIFIES_KEY, [...notifies, isin])
  }
  return NextResponse.json({ ok: true, sent })
}
