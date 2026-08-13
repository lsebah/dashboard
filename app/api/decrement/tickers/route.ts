import { NextResponse } from 'next/server'
import indices from '@/lib/decrement-indices.json'
import comparatif from '@/lib/decrement-comparatif.json'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Liste des tickers Bloomberg des indices à décrément à pricer (PX_LAST).
// Consommée par scripts/bloomberg_prices.py, qui POSTe les niveaux dans
// `levels:overlay` ; l'onglet Décrément lit ensuite /api/levels pour la
// colonne « Niveau ».
//
// UNION de deux sources, et pas seulement du catalogue :
//   • lib/decrement-indices.json — le catalogue enrichi (nom, secteur, fiche) ;
//   • lib/decrement-comparatif.json — les lignes RÉELLEMENT AFFICHÉES.
// Un indice arrivé par un run récent est affiché dans le tableau avant d'être
// ajouté au catalogue : sans l'union, il resterait éternellement sans niveau
// (« — » dans la colonne Niveau) alors qu'il est proposé aux clients. C'était
// le cas des 7 indices du run Citi du 11/08 (FTBASICR, MQDEF50, ETCORE50,
// MQRANGE, USATOP20, MXSOV50, MEBANK).
export async function GET() {
  const duCatalogue = Object.keys(indices as Record<string, unknown>)
  const duComparatif = (comparatif as { ticker?: string }[])
    .map((r) => r.ticker)
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')

  const tickers = [...new Set([...duCatalogue, ...duComparatif])].sort()
  return NextResponse.json({
    tickers,
    count: tickers.length,
    source: { catalogue: duCatalogue.length, comparatif: new Set(duComparatif).size },
  })
}
