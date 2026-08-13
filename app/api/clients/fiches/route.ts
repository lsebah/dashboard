import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import roster from '@/lib/clients-roster.json'
import emailsHistoriques from '@/data/client-emails.json'
import { defaultAllocsOf } from '@/lib/client-report'
import { kvConfigured, kvGetResult, kvSet } from '@/lib/kv'
import { fusionnerFiches, normaliserFiche, type FicheClient } from '@/lib/clients-fiches'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Fiches clients (onglet Maintenance). Source de vérité des abonnements au
// reporting : c'est CETTE route que consulte scripts/reporting_clients.mjs pour
// savoir à qui envoyer le relevé hebdomadaire et mensuel. Une seule
// implémentation de la fusion (lib/clients-fiches) pour l'interface et pour
// l'agent d'envoi — c'est la raison d'être de la route.
const CLE = 'cmf:clients:fiches:v1'

/** Tous les codes clients connus de l'application (hors fiches et fichier historique). */
function codesConnus(): string[] {
  const set = new Set<string>()
  for (const p of products) for (const a of defaultAllocsOf(p)) if (a.client) set.add(a.client)
  for (const c of roster as string[]) if (c) set.add(c)
  // Array.from (et non un spread d'itérateur) : le tsconfig cible ES5.
  return Array.from(set)
}

const historiques = emailsHistoriques as unknown as Record<string, string>

export async function GET() {
  const connus = codesConnus()

  // KV absent (dev local) : on sert les valeurs par défaut, en le disant. Aucun
  // envoi ne sera déclenché sur cette base — l'agent refuse ce mode.
  if (!kvConfigured()) {
    return NextResponse.json({
      configured: false,
      source: 'defaut',
      fiches: fusionnerFiches({ codesConnus: connus, fiches: null, emailsHistoriques: historiques }),
    })
  }

  const { ok, value } = await kvGetResult<Record<string, FicheClient>>(CLE)
  // KV configuré mais illisible : on REFUSE de répondre. Servir les valeurs par
  // défaut ferait silencieusement réapparaître des abonnements décochés (et
  // disparaître ceux qui ont été cochés) — le pire des deux mondes.
  if (!ok)
    return NextResponse.json(
      { error: 'Stockage des fiches injoignable — réessayer. Aucune valeur par défaut servie à sa place.' },
      { status: 503 },
    )

  return NextResponse.json({
    configured: true,
    source: 'kv',
    fiches: fusionnerFiches({ codesConnus: connus, fiches: value, emailsHistoriques: historiques }),
  })
}

/** Enregistre (crée ou remplace) une fiche. */
export async function PUT(req: Request) {
  let body: { fiche?: unknown }
  try {
    body = (await req.json()) as { fiche?: unknown }
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }
  const fiche = normaliserFiche(body.fiche)
  if (!fiche) return NextResponse.json({ error: 'Fiche invalide (code client obligatoire).' }, { status: 400 })
  if (!kvConfigured())
    return NextResponse.json(
      { error: "Stockage non configuré sur cet environnement — la fiche ne peut pas être enregistrée." },
      { status: 503 },
    )

  // Lecture-modification-écriture : on ne réécrit jamais l'ensemble depuis le
  // navigateur, pour qu'un onglet ouvert depuis une heure n'efface pas les
  // fiches enregistrées entre-temps.
  const { ok, value } = await kvGetResult<Record<string, FicheClient>>(CLE)
  if (!ok) return NextResponse.json({ error: 'Stockage injoignable — fiche non enregistrée.' }, { status: 503 })

  const toutes = { ...(value ?? {}), [fiche.code]: { ...fiche, maj: new Date().toISOString() } }
  const ecrit = await kvSet(CLE, toutes)
  if (!ecrit) return NextResponse.json({ error: 'Écriture refusée par le stockage — fiche non enregistrée.' }, { status: 503 })
  return NextResponse.json({ ok: true, fiche: toutes[fiche.code] })
}

/** Supprime une fiche enregistrée (le client retrouve sa valeur par défaut). */
export async function DELETE(req: Request) {
  const code = new URL(req.url).searchParams.get('code')?.trim()
  if (!code) return NextResponse.json({ error: 'Paramètre `code` manquant.' }, { status: 400 })
  if (!kvConfigured()) return NextResponse.json({ error: 'Stockage non configuré.' }, { status: 503 })
  const { ok, value } = await kvGetResult<Record<string, FicheClient>>(CLE)
  if (!ok) return NextResponse.json({ error: 'Stockage injoignable — fiche non supprimée.' }, { status: 503 })
  const toutes = { ...(value ?? {}) }
  delete toutes[code]
  const ecrit = await kvSet(CLE, toutes)
  if (!ecrit) return NextResponse.json({ error: 'Écriture refusée par le stockage.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
