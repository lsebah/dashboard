import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { canonicalForProduct, termsheetFile, parseTermsheetName } from '@/lib/termsheets'

export const dynamic = 'force-dynamic'

// Pour chaque produit : nom de fichier TS ACTUEL (si présent dans l'index) et le
// nom CIBLE à la nomenclature. Consommé par le job de synchro OneDrive
// (renommage automatique) et utilisable tel quel pour un renommage manuel.
export async function GET() {
  const items = products.map((p) => {
    const current = termsheetFile(p.isin) ?? null
    const target = canonicalForProduct(p)
    const conforme = current ? parseTermsheetName(current).conforme : false
    return {
      isin: p.isin,
      current,
      target,
      conforme,
      aRenommer: !!current && current !== target,
    }
  })
  const aRenommer = items.filter((i) => i.aRenommer).length
  const sansTs = items.filter((i) => !i.current).length
  return NextResponse.json({ count: items.length, aRenommer, sansTs, items })
}
