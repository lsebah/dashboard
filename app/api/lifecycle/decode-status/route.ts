import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { computeDataHealth, produitsADecoder } from '@/lib/data-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Contrôle « toutes les TS décodées ». Le filtre lui-même vit dans
// lib/data-health.ts (`produitsADecoder`) : l'audit hebdomadaire s'en sert
// aussi, et deux copies d'un contrôle finissent toujours par diverger.
// Consommé par le workflow sync-termsheets et par l'onglet Santé.
// Aucune valeur n'est inventée : on ne fait que signaler.

export async function GET() {
  const aDecoder = produitsADecoder(products)

  // En amont du décodage : des termsheets du dossier dont l'ISIN n'a même pas
  // encore de produit dans le feed — invisibles ailleurs, elles ne remonteraient
  // sinon qu'à l'œil, en parcourant le dossier OneDrive au hasard.
  const sante = computeDataHealth(products)
  const nonRattachees = sante.termsheetSansProduit.map((h) => ({
    isin: h.isin,
    nom: h.nom,
    emetteur: h.type,
    detail: h.detail,
  }))

  return NextResponse.json({
    count: aDecoder.length,
    aDecoder,
    countNonRattachees: nonRattachees.length,
    nonRattachees,
    // Les deux compteurs ci-dessus se calculent SUR l'index. Publier sa
    // fraîcheur avec eux évite de lire « 0 termsheet non rattachée » comme une
    // bonne nouvelle alors que l'index ne voit plus le dossier.
    index: sante.indexTermsheets,
  })
}
