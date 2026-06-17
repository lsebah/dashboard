import { products } from '@/lib/products'
import PortfolioExplorer from '@/app/lifecycle/components/PortfolioExplorer'
import NouveauTradeButton from '@/app/lifecycle/components/NouveauTradeButton'

export default function PortefeuillePage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Portefeuille</h1>
        <NouveauTradeButton />
      </div>
      <PortfolioExplorer products={products} />
    </div>
  )
}
