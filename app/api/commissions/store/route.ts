import { NextResponse } from 'next/server'
import { kvConfigured, kvGet, kvSet } from '@/lib/kv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Persistance serveur des modifications de commissions faites dans l'interface,
// pour qu'elles soient mémorisées sur tous les appareils (et survivent aux
// rechargements / déploiements), sans entrer dans le dépôt git.
//   slot=ov     → surcharges des lignes du classeur (Payé, n° facture, UF/Rétro)
//   slot=local  → commissions créées via « Nouveau trade »
//   slot=alloc  → allocations clients par produit (ISIN → [{client, montant}])
//   slot=statut → statuts forcés par produit (Vendu / Rappelé…)
//   slot=noms     → noms d'affichage renommés par produit
//   slot=products → produits créés via « Nouveau produit » (brouillons)
// Dégrade proprement : si le KV n'est pas configuré, l'API renvoie
// `configured:false` et le client retombe sur le stockage navigateur.
const SLOTS: Record<string, string> = {
  ov: 'cmf:commissions:ov:v1',
  local: 'cmf:commissions:local:v1',
  alloc: 'cmf:lifecycle:alloc:v1',
  statut: 'cmf:lifecycle:statut:v1',
  noms: 'cmf:lifecycle:noms:v1',
  products: 'cmf:lifecycle:products:v1',
}

export async function GET(req: Request) {
  const slot = new URL(req.url).searchParams.get('slot') ?? ''
  const key = SLOTS[slot]
  if (!key) return NextResponse.json({ error: 'slot inconnu' }, { status: 400 })
  if (!kvConfigured()) return NextResponse.json({ configured: false, value: null })
  const value = await kvGet(key)
  return NextResponse.json({ configured: true, value })
}

export async function PUT(req: Request) {
  let body: { slot?: string; value?: unknown }
  try {
    body = (await req.json()) as { slot?: string; value?: unknown }
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }
  const key = SLOTS[body.slot ?? '']
  if (!key) return NextResponse.json({ error: 'slot inconnu' }, { status: 400 })
  if (!kvConfigured()) return NextResponse.json({ configured: false, ok: false })
  const ok = await kvSet(key, body.value ?? null)
  return NextResponse.json({ configured: true, ok })
}
