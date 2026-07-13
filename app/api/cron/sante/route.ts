import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { computeDataHealth } from '@/lib/data-health'
import { computeCoherence, type CommissionLine } from '@/lib/coherence'
import { yahooSymbol } from '@/lib/underlyings'
import commissions from '@/lib/commissions.json'
import { kvConfigured, kvGet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────────────────
//  Boucle de contrôle « Santé quotidienne ».
//  Recense les anomalies du portefeuille et — s'il y en a — envoie UN email
//  récapitulatif (Resend). Sans anomalie : aucun email (pas de bruit).
//  Déclenché par Vercel Cron (Authorization: Bearer <CRON_SECRET>).
//  Aucune donnée n'est modifiée : ce contrôle ne fait que lire et signaler.
// ─────────────────────────────────────────────────────────────────────────
const CLOSED = new Set(['rappele', 'vendu', 'echu'])
const PRIX_FROID_JOURS = 5

interface Overlay {
  asof: string | null
}

export async function GET(req: Request) {
  if (process.env.CRON_SECRET) {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const vivants = products.filter((p) => !CLOSED.has(p.statut ?? ''))

  // 1) Santé des données (TS manquante, coupon/airbag non décodé…).
  const health = computeDataHealth(vivants)

  // 2) Cohérence commissions ↔ produits (client renommé, date divergente…).
  const lignes = (commissions as { lignes: CommissionLine[] }).lignes ?? []
  const coherence = computeCoherence(lignes, products)

  // 3) Prix froids : surcouche Bloomberg trop ancienne.
  const overlay = kvConfigured() ? await kvGet<Overlay>('prices:overlay') : null
  const asof = overlay?.asof ?? null
  const prixAgeJours = asof ? (Date.now() - new Date(asof).getTime()) / 86400000 : null
  const prixFroids = prixAgeJours != null && prixAgeJours > PRIX_FROID_JOURS

  // 4) Sous-jacents non-Yahoo sans ticker Bloomberg (jamais pricés).
  const sansTicker: string[] = []
  for (const p of vivants)
    for (const u of p.sousJacents ?? [])
      if (!u.bloomberg?.trim() && yahooSymbol(u.bloomberg) === null)
        sansTicker.push(`${p.isin} · ${u.nom}`)

  const resume = {
    asof: new Date().toISOString(),
    sansTS: health.sansTS.length,
    sansCoupon: health.sansCoupon.length,
    airbagSansNiveau: health.airbagSansNiveau.length,
    deviseSuspecte: health.deviseSuspecte.length,
    coherenceClient: coherence.filter((c) => c.type === 'client').length,
    coherenceDate: coherence.filter((c) => c.type === 'date').length,
    coherenceOrpheline: coherence.filter((c) => c.type === 'orpheline').length,
    prixFroids,
    prixAgeJours: prixAgeJours != null ? Math.round(prixAgeJours) : null,
    sansTicker: sansTicker.length,
  }

  const total =
    resume.sansTS +
    resume.coherenceClient +
    resume.coherenceDate +
    resume.coherenceOrpheline +
    resume.deviseSuspecte +
    (prixFroids ? 1 : 0)

  // Pas d'anomalie « dure » → pas d'email (le rapport reste consultable en JSON).
  if (total === 0) {
    return NextResponse.json({ ok: true, envoye: false, resume })
  }

  const lignesTxt = [
    `Contrôle santé du portefeuille — ${vivants.length} produits vivants.`,
    '',
    resume.sansTS ? `• ${resume.sansTS} produit(s) sans termsheet` : '',
    resume.coherenceClient
      ? `• ${resume.coherenceClient} divergence(s) de client (commissions ↔ produit) : ` +
        coherence
          .filter((c) => c.type === 'client')
          .map((c) => `${c.isin} ${c.classeur}→${c.produit}`)
          .join(', ')
      : '',
    resume.coherenceDate
      ? `• ${resume.coherenceDate} divergence(s) de date d'émission : ` +
        coherence
          .filter((c) => c.type === 'date')
          .map((c) => `${c.isin} ${c.classeur}≠${c.produit}`)
          .join(', ')
      : '',
    resume.coherenceOrpheline ? `• ${resume.coherenceOrpheline} ligne(s) commission orpheline(s)` : '',
    resume.deviseSuspecte ? `• ${resume.deviseSuspecte} devise(s) incohérente(s)` : '',
    prixFroids ? `• Prix Bloomberg froids : dernière ingestion il y a ${resume.prixAgeJours} j` : '',
    '',
    'Détail complet : onglet « Santé des données » du dashboard.',
    '— Contrôle automatique CMF',
  ]
    .filter((l) => l !== '')
    .join('\n')

  let envoye = false
  const key = process.env.RESEND_API_KEY
  if (key) {
    const from = process.env.NOTIF_EMAIL_FROM || 'l.sebah@cmf.finance'
    const to = process.env.NOTIF_EMAIL_TO || 'L.sebah@cmf.finance'
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `CMF | Contrôle santé — ${total} anomalie(s)`,
          text: lignesTxt,
        }),
      })
      envoye = res.ok
    } catch {
      envoye = false
    }
  }

  return NextResponse.json({ ok: true, envoye, total, resume })
}
