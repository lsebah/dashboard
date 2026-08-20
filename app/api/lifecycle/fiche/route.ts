import { NextResponse } from 'next/server'
import { fiche } from '@/lib/fiches'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Fiche produit d'un ISIN — la source unique servie aux onglets.
//
// Pourquoi un endpoint plutôt qu'un import direct : Commissions et Deal Done
// n'ont aucun accès au portefeuille (ils lisent le registre et leur JSON), et
// embarquer `lib/products` dans leur bundle client ferait payer à chaque onglet
// le poids de tout le portefeuille pour une popup ouverte de temps en temps.
// La fiche est donc chargée à la demande, au clic sur l'ISIN.
export async function GET(req: Request) {
  const isin = new URL(req.url).searchParams.get('isin')?.trim().toUpperCase()
  if (!isin) return NextResponse.json({ error: 'isin manquant' }, { status: 400 })

  const f = fiche(isin)
  if (!f) return NextResponse.json({ isin, connu: false }, { status: 404 })

  return NextResponse.json({ ...f, connu: true })
}
