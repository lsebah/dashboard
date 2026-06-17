import { products } from '@/lib/products'
import PortfolioExplorer from './components/PortfolioExplorer'
import NouveauTradeButton from './components/NouveauTradeButton'

// La synthèse « Analyse de risques » (compteurs de situations) est rendue par
// PortfolioExplorer, côté client, pour bénéficier des niveaux courants des
// sous-jacents (sinon tout serait « non classé » faute de perf côté serveur).
export default function PortefeuillePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-cmf-navy">Portefeuille</h1>
        <NouveauTradeButton />
      </div>

      <PortfolioExplorer products={products} />
    </div>
  )
}
