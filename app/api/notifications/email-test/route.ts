import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Endpoint de DIAGNOSTIC (GET, ouvrable dans le navigateur) : envoie un email de
// test via Resend et renvoie la réponse BRUTE de Resend (statut + corps) pour
// vérifier la configuration de bout en bout. N'envoie qu'à l'adresse configurée
// (NOTIF_EMAIL_TO) — aucune entrée utilisateur. À retirer une fois validé.
const TO = process.env.NOTIF_EMAIL_TO || 'L.sebah@cmf.finance'
const FROM = process.env.NOTIF_EMAIL_FROM || 'notifications@cmf.finance'

export async function GET() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({
      ok: false,
      reason:
        'RESEND_API_KEY absent côté serveur — variable non posée dans Vercel, ou déploiement pas encore rafraîchi (redéploie après avoir ajouté la variable).',
    })
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: '[TEST] Dashboard CMF — email opérationnel ✅',
        text:
          'Ceci est un email de test envoyé depuis le dashboard CMF.\n\n' +
          `Expéditeur (FROM) : ${FROM}\n` +
          `Destinataire (TO) : ${TO}\n\n` +
          'Si tu lis ce message, Resend est correctement configuré : ' +
          'les emails de rappel et le reporting partiront bien.',
      }),
    })
    const corps = await res.text()
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      from: FROM,
      to: TO,
      // Réponse brute de Resend : en cas d'échec, contient la raison (ex.
      // « domain is not verified », « you can only send to your own email »…).
      resend: corps.slice(0, 600),
      aide: res.ok
        ? 'Email accepté par Resend — vérifie ta boîte de réception (et les spams).'
        : "Échec : lis le champ « resend » ci-dessus pour la raison exacte (souvent : domaine FROM non vérifié, ou TO ≠ email du compte Resend en mode non vérifié).",
    })
  } catch (e) {
    return NextResponse.json({ ok: false, reason: String(e) })
  }
}
