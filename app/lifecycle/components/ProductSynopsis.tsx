import type { Product } from '@/lib/types'
import {
  moisRestants,
  avancement,
  situation,
  couponPa,
  prochainEvenement,
  prochaineObservation,
  formatDateFr,
  formatPct,
  formatMontant,
} from '@/lib/lifecycle'
import { SITUATION_LABEL, SITUATION_COLOR, freqLabel } from './labels'

/** Carte « Synopsis produit » — reproduit la fiche de vizibility. */
export default function ProductSynopsis({ product }: { product: Product }) {
  const s = situation(product)
  const next = prochainEvenement(product)
  const nextObs = prochaineObservation(product)
  const mois = moisRestants(product)
  const progress = Math.round(avancement(product) * 100)
  const terms = product.terms
  const cpa = couponPa(product)

  const protection =
    terms?.kind === 'autocall'
      ? `${terms.protectionPct}% KI ${terms.protectionStyle === 'europeenne' ? 'Européenne' : 'Américaine'}`
      : product.pdiText ?? (typeof product.pdiPct === 'number' ? `${product.pdiPct}%` : '—')

  const rappel =
    terms?.kind === 'autocall'
      ? terms.degressif
        ? `Dégressif (≤ ${terms.barriereRappelPct ?? 100}%)`
        : `${terms.barriereRappelPct ?? 100}% (${freqLabel(product.frequence)})`
      : product.barriereAutocall ?? '—'

  const memoire =
    (terms?.kind === 'autocall' && terms.effetMemoire) || /[ée]moire/i.test(product.description ?? '')

  const barriereCoupon =
    terms?.kind === 'autocall' && terms.barriereCouponPct
      ? `${terms.barriereCouponPct}%${memoire ? ' avec effet Mémoire' : ''}`
      : product.barriereCoupon
        ? `${product.barriereCoupon}${memoire ? ' avec effet Mémoire' : ''}`
        : memoire
          ? 'effet Mémoire'
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
        <span
          className={`w-2.5 h-2.5 rounded-full mt-1 ${SITUATION_COLOR[s]}`}
          title={SITUATION_LABEL[s]}
        />
      </div>

      {/* Titre + badges */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-cmf-navy">{product.nom}</h3>
        {product.productType && (
          <span className="text-[11px] text-slate-500">· {product.productType}</span>
        )}
        {product.badges?.map((b) => (
          <span key={b} className="badge">
            {b}
          </span>
        ))}
      </div>

      {/* Termsheet */}
      {product.termsheetUrl && (
        <a
          href={product.termsheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cmf-blue hover:underline inline-flex items-center gap-1 w-fit"
          title={product.termsheetFichier}
        >
          📄 Termsheet ↗
        </a>
      )}

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
            {next ? `Prochain événement le ${formatDateFr(next)}` : 'Échéance atteinte'}
          </span>
          <span className="text-slate-400">{mois} mois restants</span>
        </div>
      </div>

      {/* Monitoring de la prochaine observation (depuis le calendrier décodé) */}
      {nextObs &&
        (() => {
          const isRates = terms?.kind === 'rates'
          const ref = isRates ? terms.tauxReference ?? 'taux' : 'worst'
          const cmp = isRates && terms.sens === 'bearish' ? '≤' : '≥'
          const fmt = (v: number) => `${v}%`
          return (
            <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-[11px]">
              <div className="field-label mb-0.5">
                Prochaine observation — {formatDateFr(nextObs.dateObservation)}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
                <span>
                  Autocall si {ref} {cmp}{' '}
                  <span className="font-medium text-slate-800">
                    {nextObs.autocallActif !== false && typeof nextObs.niveauRappelPct === 'number'
                      ? fmt(nextObs.niveauRappelPct)
                      : '— (non-call)'}
                  </span>
                </span>
                {typeof nextObs.niveauCouponPct === 'number' && (
                  <span>
                    Coupon si {ref} {cmp}{' '}
                    <span className="font-medium text-slate-800">{fmt(nextObs.niveauCouponPct)}</span>
                  </span>
                )}
              </div>
            </div>
          )
        })()}

      {/* Mécanisme */}
      <dl className="text-xs space-y-1">
        <div className="flex gap-2">
          <dt className="field-label w-28 shrink-0">Coupon p.a.</dt>
          <dd className="text-slate-700">
            {cpa ? formatPct(cpa) : '—'}
            {memoire && <span className="text-slate-400"> · effet mémoire</span>}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="field-label w-28 shrink-0">Barrière coupon</dt>
          <dd className="text-slate-700">{barriereCoupon}</dd>
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
            {product.sousJacents.length > 0
              ? `Sous-jacent${
                  product.sousJacents.length > 1
                    ? `s (${product.basket === 'worst_of' ? 'moins performant' : product.basket})`
                    : ''
                }`
              : 'Sous-jacents'}
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
            {product.sousJacents.length === 0 && (
              <li className="text-slate-400">{product.description ?? '—'}</li>
            )}
          </ul>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-cmf-navy tabular-nums">
            {formatPct(product.prixMarche)}
          </div>
          <div className="text-[11px] text-slate-500">Prix (mark-to-market)</div>
          {typeof product.pnlPct === 'number' && (
            <div
              className={`text-[11px] tabular-nums ${
                product.pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              P&amp;L {product.pnlPct >= 0 ? '+' : ''}
              {product.pnlPct.toFixed(2)}%
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
