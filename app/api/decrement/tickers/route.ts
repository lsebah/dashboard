import { NextResponse } from 'next/server'
import indices from '@/lib/decrement-indices.json'

export const dynamic = 'force-dynamic'

// Liste des tickers Bloomberg des indices à décrément à pricer chaque jour
// (PX_LAST). Consommée par scripts/bloomberg_prices.py, qui POSTe les niveaux
// dans `levels:overlay` (même surcouche que les sous-jacents). L'onglet
// Décrément lit ensuite /api/levels pour la colonne « Niveau ».
export async function GET() {
  const tickers = Object.keys(indices as Record<string, unknown>)
  return NextResponse.json({ tickers })
}
