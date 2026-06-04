import { products } from '@/lib/products'
import type { Product } from '@/lib/types'
import {
  prochaineObservation,
  moisRestants,
  avancement,
  worstOf,
  situation,
  couponPa,
  formatDateFr,
  formatPct,
  formatMontant,
  type Situation,
} from '@/lib/lifecycle'

const SITUATION_LABEL: Record<Situation, string> = {
  positive: 'Situation positive',
  sans_stress: 'Situation sans stress',
  proche_protection: 'Proche de la protection',
  sous_protection: 'Sous la protection',
  non_classe: 'Non classé',
}

const SITUATION_COLOR: Record<Situation, string> = {
  positive: 'bg-situation-positive',
  sans_stress: 'bg-situation-neutre',
  proche_protection: 'bg-situation-proche',
  sous_protection: 'bg-situation-sous',
  non_classe: 'bg-slate-300',
}

const FREQ_LABEL: Record<string, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
  in_fine: 'In fine',
  autre: 'Autre',
}

function freqLabel(f: string) {
  return FREQ_LABEL[f] ?? f
}

// ── Bandeau de synthèse (mini "Analyse de risques") ──────────────────────────
function Synthese({ list }: { list: Product[] }) {
  const total = list.reduce((s, p) => s + p.nominal, 0)
  const bySituation = new Map<Situation, number>()
  for (const p of list) {
    const s = situation(p)
    bySituation.set(s, (bySituation.get(s) ?? 0) + 1)
  }
  return (
    <div className="card p-4 mb-6">
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

// ── Carte produit ────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const s = situation(product)
  const next = prochaineObservation(product)
  const mois = moisRestants(product)
  const progress = Math.round(avancement(product) * 100)
  const wo = worstOf(product)
  const terms = product.terms
  const cpa = couponPa(product)

  const protection =
    terms.kind === 'autocall'
      ? `${terms.protectionPct}% KI ${terms.protectionStyle === 'europeenne' ? 'Européenne' : 'Américaine'}`
      : '—'

  const rappel =
    terms.kind === 'autocall'
      ? terms.degressif
        ? `Dégressif (≤ ${terms.barriereRappelPct ?? 100}%)`
        : `${terms.barriereRappelPct ?? 100}% (${freqLabel(product.frequence)})`
      : '—'

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-slate-500">
          <span className="font-mono">{product.isin}</span>
          <span className="mx-1.5">•</span>
          {product.emetteur}
          <span className="mx-1.5">•</span>
          <span className="font-medium text-slate-700">
            {formatMontant(product.nominal, product.devise)}
          </span>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full mt-1 ${SITUATION_COLOR[s]}`} title={SITUATION_LABEL[s]} />
      </div>

      {/* Titre + badges */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-cmf-navy">{product.nom}</h3>
        {product.badges?.map((b) => (
          <span key={b} className="badge">
            {b}
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>{formatDateFr(product.dateConstatationInitiale)}</span>
          <span>{formatDateFr(product.dateEcheance)}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden my-1">
          <div className="h-full bg-cmf-blue/70" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-600">
            {next
              ? `Prochaine observation le ${formatDateFr(next.dateObservation)}${
                  next.autocallActif === false ? ' (rappel non-actif)' : ''
                }`
              : 'Échéance atteinte'}
          </span>
          <span className="text-slate-400">{mois} mois restants</span>
        </div>
      </div>

      {/* Mécanisme */}
      <dl className="text-xs space-y-1">
        <div className="flex gap-2">
          <dt className="field-label w-28 shrink-0">Coupon p.a.</dt>
          <dd className="text-slate-700">
            {cpa ? formatPct(cpa) : '—'}
            {terms.kind === 'autocall' && terms.effetMemoire && (
              <span className="text-slate-400"> · effet mémoire</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="field-label w-28 shrink-0">Barrière rappel</dt>
          <dd className="text-slate-700">{rappel}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="field-label w-28 shrink-0">Protection</dt>
          <dd className="text-slate-700">{protection}</dd>
        </div>
      </dl>

      {/* Sous-jacents + prix */}
      <div className="flex items-end justify-between border-t border-slate-100 pt-3">
        <div className="text-xs">
          <div className="field-label mb-1">
            Sous-jacent{product.sousJacents.length > 1 ? `s (${product.basket === 'worst_of' ? 'moins performant' : product.basket})` : ''}
          </div>
          <ul className="space-y-0.5">
            {product.sousJacents.slice(0, 3).map((u) => (
              <li key={u.nom} className="flex gap-3">
                <span className="text-slate-700 truncate max-w-[160px]">{u.nom}</span>
                <span
                  className={`ml-auto tabular-nums ${
                    typeof u.perf === 'number'
                      ? u.perf >= 0
                        ? 'text-emerald-600'
                        : 'text-red-600'
                      : 'text-slate-400'
                  }`}
                >
                  {typeof u.perf === 'number' ? `${(100 + u.perf).toFixed(2)}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-cmf-navy tabular-nums">
            {formatPct(product.prixMarche)}
          </div>
          <div className="text-[11px] text-slate-500">Prix (mark-to-market)</div>
        </div>
      </div>
    </div>
  )
}

export default function PortefeuillePage() {
  const list = products
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

      <Synthese list={list} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}
