import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'

export const dynamic = 'force-dynamic'

// Valeurs initiales (strike) à récupérer par Bloomberg pour la « valo vs strike »
// des produits détenus dont le sous-jacent est un indice propriétaire/décrément
// NON couvert par Yahoo et dont le niveau initial n'est pas déjà décodé.
// Le strike = niveau de l'indice à la date de constatation initiale du produit.
// Consommé par scripts/bloomberg_prices.py (requête historique BDH), qui POSTe
// les valeurs dans `decrement:strikes:overlay` (clé = ISIN du produit).
export async function GET() {
  const out: { isin: string; ticker: string; date: string }[] = []
  for (const p of products) {
    if (p.statut === 'vendu' || p.statut === 'echu') continue
    const date = p.dateConstatationInitiale
    if (!date) continue
    for (const u of p.sousJacents ?? []) {
      const bbg = u.bloomberg?.trim()
      if (!bbg) continue
      if (typeof u.niveauInitial === 'number') continue // strike déjà connu
      if (yahooSymbol(u.bloomberg) !== null) continue // couvert par Yahoo (pas Bloomberg)
      out.push({ isin: p.isin, ticker: bbg, date })
    }
  }
  return NextResponse.json({ strikes: out })
}
