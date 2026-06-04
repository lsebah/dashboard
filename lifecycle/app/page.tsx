import { products } from '@/lib/products'
import type { Product } from '@/lib/types'
import { situation, type Situation } from '@/lib/lifecycle'
import { SITUATION_LABEL, SITUATION_COLOR } from './components/labels'
import PortfolioExplorer from './components/PortfolioExplorer'

// ── Bandeau de synthèse (mini "Analyse de risques") ──────────────────────────
function Synthese({ list }: { list: Product[] }) {
  const total = list.reduce((s, p) => s + p.nominal, 0)
  const bySituation = new Map<Situation, number>()
  for (const p of list) {
    const s = situation(p)
    bySituation.set(s, (bySituation.get(s) ?? 0) + 1)
  }
  return (
    <div className="card p-4 mb-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div className="text-2xl font-bold text-cmf-navy">{list.length}</div>
          <div className="text-xs text-slate-500">Produits en cours</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-cmf-navy">
            {(total / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}M
          </div>
          <div className="text-xs text-slate-500">Nominal total (toutes devises)</div>
        </div>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(SITUATION_LABEL) as Situation[]).map((s) => {
            const n = bySituation.get(s) ?? 0
            if (n === 0) return null
            return (
              <div key={s} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${SITUATION_COLOR[s]}`} />
                <span className="text-sm text-slate-700">{SITUATION_LABEL[s]}</span>
                <span className="text-sm font-semibold text-slate-900">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function PortefeuillePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-cmf-navy">Portefeuille</h1>
        <a
          href="/produits/nouveau"
          className="rounded-md bg-cmf-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nouveau produit
        </a>
      </div>

      <Synthese list={products} />
      <PortfolioExplorer products={products} />
    </div>
  )
}
