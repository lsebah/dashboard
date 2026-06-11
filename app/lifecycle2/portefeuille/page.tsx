import { products } from '@/lib/products'
import PortfolioExplorer from '@/app/lifecycle/components/PortfolioExplorer'

export default function PortefeuillePage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Portefeuille</h1>
        <a
          href="/lifecycle2/produits/nouveau"
          className="rounded-md bg-cmf-navy px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0b1d36]"
        >
          + Nouveau produit
        </a>
      </div>
      <PortfolioExplorer products={products} />
    </div>
  )
}
