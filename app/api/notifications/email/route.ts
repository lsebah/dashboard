import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Envoi d'email de notification (rappel produit) vers L.sebah@cmf.finance.
// Utilise Resend via son API REST (aucune dépendance npm) si RESEND_API_KEY est
// configuré. Sinon dégrade proprement (`configured:false`) — le centre de
// notifications fonctionne quand même ; l'email partira dès la clé posée.
//   Variables d'environnement :
//     RESEND_API_KEY   → clé API Resend
//     NOTIF_EMAIL_FROM → expéditeur vérifié (défaut: notifications@cmf.finance)
//     NOTIF_EMAIL_TO   → destinataire (défaut: L.sebah@cmf.finance)
const TO = process.env.NOTIF_EMAIL_TO || 'L.sebah@cmf.finance'
const FROM = process.env.NOTIF_EMAIL_FROM || 'notifications@cmf.finance'

export async function POST(req: Request) {
  let body: { subject?: string; text?: string }
  try {
    body = (await req.json()) as { subject?: string; text?: string }
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }
  const subject = (body.subject ?? '').trim()
  const text = (body.text ?? '').trim()
  if (!subject || !text) return NextResponse.json({ error: 'subject/text requis' }, { status: 400 })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ configured: false, sent: false })

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject, text }),
    })
    return NextResponse.json({ configured: true, sent: res.ok })
  } catch {
    return NextResponse.json({ configured: true, sent: false })
  }
}
