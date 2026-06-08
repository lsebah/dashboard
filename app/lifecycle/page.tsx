import { products } from '@/lib/products'
import PortfolioExplorer from './components/PortfolioExplorer'

// La synthèse « Analyse de risques » (compteurs de situations) est rendue par
// PortfolioExplorer, côté client, pour bénéficier des niveaux courants des
// sous-jacents (sinon tout serait « non classé » faute de perf côté serveur).
export default function PortefeuillePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-cmf-navy">Portefeuille</h1>
        <a
          href="/lifecycle/produits/nouveau"
          className="rounded-md bg-cmf-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nouveau produit
        </a>
      </div>

      <PortfolioExplorer products={products} />
    </div>
  )
}
