import type { Product, RatesTerms, CreditTerms } from '@/lib/types'
import {
  echeancier,
  degressivite,
  scenariosMaturite,
  scenariosTaux,
  scenariosCredit,
  suiviCoupons,
  distribueCoupons,
  formatDateFr,
  type Scenario,
  type CouponStatut,
} from '@/lib/lifecycle'

const COUPON_STATUT: Record<CouponStatut, { label: string; cls: string }> = {
  paye: { label: 'Payé', cls: 'text-emerald-600' },
  rattrape: { label: 'Rattrapé', cls: 'text-emerald-600' },
  manque: { label: 'Manqué (mémoire)', cls: 'text-red-600' },
  a_constater: { label: 'À constater', cls: 'text-slate-400' },
  a_venir: { label: 'À venir', cls: 'text-slate-400' },
}

/** Suivi des coupons (Phoenix) : payé / mis en mémoire / rattrapé par observation. */
function CouponSuivi({ product }: { product: Product }) {
  if (!distribueCoupons(product)) return null
  const lignes = suiviCoupons(product)
  if (lignes.length === 0) return null
  const encaisses = lignes.filter((l) => l.statut !== 'a_venir')
  const aConstater = encaisses.some((l) => l.statut === 'a_constater')
  const cumul = encaisses.length ? encaisses[encaisses.length - 1].cumulPayePct : 0
  return (
    <div>
      <div className="field-label mb-1 flex items-center justify-between">
        <span>Suivi des coupons</span>
        <span className="text-[12px] text-slate-500 normal-case">
          {aConstater
            ? 'coupons encaissés : à constater (niveaux des sous-jacents requis)'
            : `coupons encaissés : ${cumul.toFixed(2)}%`}
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto rounded border border-slate-100">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-slate-500 sticky top-0">
            <tr>
              <th className="text-left font-medium px-2 py-1">#</th>
              <th className="text-left font-medium px-2 py-1">Observation</th>
              <th className="text-right font-medium px-2 py-1">Coupon</th>
              <th className="text-right font-medium px-2 py-1">Barrière</th>
              <th className="text-right font-medium px-2 py-1">Niveau</th>
              <th className="text-left font-medium px-2 py-1">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lignes.map((l) => {
              const s = COUPON_STATUT[l.statut]
              return (
                <tr key={l.n} className={l.statut === 'a_venir' ? 'text-slate-400' : ''}>
                  <td className="px-2 py-1 tabular-nums">{l.n}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{formatDateFr(l.date)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{l.couponPct}%</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {typeof l.barriereCouponPct === 'number' ? `${l.barriereCouponPct}%` : '—'}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {typeof l.niveauConstatePct === 'number' ? `${l.niveauConstatePct}%` : '—'}
                  </td>
                  <td className={`px-2 py-1 whitespace-nowrap ${s.cls}`}>
                    {s.label}
                    {l.statut === 'manque' && l.enMemoirePct > 0 ? ` · ${l.enMemoirePct}%` : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Liste de scénarios (carte) — réutilisée par les reconstructions taux/crédit. */
function ScenarioList({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <div>
      <div className="field-label mb-1.5">Scénarios de dénouement</div>
      <ul className="space-y-1.5">
        {scenarios.map((s) => (
          <li key={s.titre} className={`rounded-md border p-2 ${TON[s.ton]}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <span className={`w-1.5 h-1.5 rounded-full ${TON_DOT[s.ton]}`} />
              {s.titre}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">Si {s.condition}</div>
            <div className="text-[12px] text-slate-700">→ {s.resultat}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TON: Record<Scenario['ton'], string> = {
  positif: 'border-emerald-200 bg-emerald-50',
  neutre: 'border-slate-200 bg-slate-50',
  negatif: 'border-red-200 bg-red-50',
}
const TON_DOT: Record<Scenario['ton'], string> = {
  positif: 'bg-emerald-500',
  neutre: 'bg-slate-400',
  negatif: 'bg-red-500',
}

/** Mini-courbe SVG du barème de barrière d'autocall (montre la dégressivité). */
function BarriereCurve({ niveaux }: { niveaux: number[] }) {
  const w = 240
  const h = 56
  const pad = 6
  const min = Math.min(...niveaux) - 2
  const max = Math.max(...niveaux) + 2
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, niveaux.length - 1)
  const y = (v: number) => pad + ((max - v) * (h - 2 * pad)) / Math.max(1, max - min)
  const pts = niveaux.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#1d4ed8" strokeWidth={1.5} />
      {niveaux.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2} fill="#1d4ed8" />
      ))}
    </svg>
  )
}

/**
 * Carte « Reconstruction » — tout est dérivé des `terms` décodés de la termsheet
 * (rien de saisi à la main). Met en avant la dégressivité et les scénarios.
 */
export default function ProductReconstruction({ product }: { product: Product }) {
  const t = product.terms
  if (t?.kind === 'rates' && product.observations?.length) {
    return <RatesReconstruction product={product} t={t} />
  }
  if (t?.kind === 'credit') {
    return <CreditReconstruction product={product} t={t} />
  }
  if (t?.kind !== 'autocall' || !(product.observations?.length)) {
    return (
      <div className="card p-4 text-xs text-slate-400">
        Reconstruction détaillée disponible une fois la termsheet décodée
        (mécanique + calendrier).
      </div>
    )
  }

  const lignes = echeancier(product)
  const degr = degressivite(product)
  const scenarios = scenariosMaturite(product)
  const niveaux = lignes
    .map((l) => l.niveauRappelPct)
    .filter((v): v is number => typeof v === 'number')

  const chips: string[] = [
    `Sens ${t.sens}`,
    `Protection ${t.protectionPct}% ${t.protectionStyle === 'europeenne' ? 'KIE' : 'KIA'}`,
  ]
  if (t.effetMemoire) chips.push('Effet mémoire')
  if (t.airbag) chips.push('Airbag')
  if (t.oxygene) chips.push('Oxygène') // feature Athena : coupons mémoire payés à maturité si ≥ niveau Oxygène
  const premierRappel = lignes.find((l) => l.actif)?.n
  if (premierRappel && premierRappel > 1) chips.push(`Non-call (${premierRappel - 1} obs.)`)
  if (degr) chips.push('Barrière dégressive')
  if (t.bonusFinalPct) chips.push(`Bonus +${t.bonusFinalPct}%`)
  if (t.decrement) chips.push(`Décrément · ${t.decrement}`)

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-cmf-navy text-sm">Reconstruction (termsheet)</h3>
        <span className="text-[11px] text-slate-400">dérivé, non saisi</span>
      </div>

      {/* Paramètres décodés */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="badge">
            {c}
          </span>
        ))}
      </div>

      {/* Barème dégressif */}
      {degr && (
        <div>
          <div className="field-label mb-1">
            Barème d&apos;autocall — dégressif {degr.depart}% → {degr.fin}%
            <span className="text-slate-400"> (−{degr.pas.toFixed(2)} pt / observation)</span>
          </div>
          <BarriereCurve niveaux={niveaux} />
        </div>
      )}

      {/* Échéancier reconstruit */}
      <div>
        <div className="field-label mb-1">Échéancier reconstruit</div>
        <div className="max-h-56 overflow-y-auto rounded border border-slate-100">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 sticky top-0">
              <tr>
                <th className="text-left font-medium px-2 py-1">#</th>
                <th className="text-left font-medium px-2 py-1">Observation</th>
                <th className="text-right font-medium px-2 py-1">Niveau rappel</th>
                <th className="text-right font-medium px-2 py-1">Remb. si rappelé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((l) => (
                <tr key={l.n} className={l.passe ? 'text-slate-400' : ''}>
                  <td className="px-2 py-1 tabular-nums">{l.n}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {formatDateFr(l.date)}
                    {!l.actif && (
                      <span className="ml-1 text-[10px] text-slate-400">non-call</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {typeof l.niveauRappelPct === 'number' ? `${l.niveauRappelPct}%` : '—'}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {typeof l.remboursementPct === 'number'
                      ? `${l.remboursementPct.toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suivi des coupons (payé / mémoire / rattrapé) */}
      <CouponSuivi product={product} />

      {/* Scénarios de dénouement */}
      <div>
        <div className="field-label mb-1.5">Scénarios de dénouement</div>
        <ul className="space-y-1.5">
          {scenarios.map((s) => (
            <li key={s.titre} className={`rounded-md border p-2 ${TON[s.ton]}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className={`w-1.5 h-1.5 rounded-full ${TON_DOT[s.ton]}`} />
                {s.titre}
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">Si {s.condition}</div>
              <div className="text-[12px] text-slate-700">→ {s.resultat}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Reconstruction d'un produit de TAUX (Phoenix Bearish CMS, steepener, TARN…). */
function RatesReconstruction({ product, t }: { product: Product; t: RatesTerms }) {
  const lignes = echeancier(product)
  const scenarios = scenariosTaux(product)
  const cmp = t.sens === 'bearish' ? '≤' : '≥'
  const taux = t.tauxReference ?? 'Taux de référence'

  // — TARN / steepener : pas de barrière de taux → carte dédiée —
  if (t.type === 'tarn') {
    const tarnChips: string[] = []
    if (t.tauxReference && t.tauxReference2)
      tarnChips.push(`${t.tauxReference} − ${t.tauxReference2}`)
    if (typeof t.multiplicateur === 'number')
      tarnChips.push(`Levier ×${t.multiplicateur}`)
    if (typeof t.couponGarantiPct === 'number')
      tarnChips.push(`Coupon garanti ${t.couponGarantiPct}%`)
    if (typeof t.cibleTarnPct === 'number') tarnChips.push(`Cible ${t.cibleTarnPct}%`)
    if (t.capitalGaranti) tarnChips.push('Capital garanti')
    return (
      <div className="card p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-cmf-navy text-sm">Reconstruction (termsheet)</h3>
          <span className="text-[11px] text-slate-400">dérivé, non saisi</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tarnChips.map((c) => (
            <span key={c} className="badge">
              {c}
            </span>
          ))}
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-[12px] text-slate-600">
          TARN (Target Redemption Note) sur la pente de courbe : coupon ={' '}
          <span className="font-medium text-slate-800">
            {t.multiplicateur ? `${(t.multiplicateur * 100).toFixed(0)}%` : ''} × ({t.tauxReference} −{' '}
            {t.tauxReference2})
          </span>{' '}
          planché à {t.floorPct ?? 0}%. Remboursement anticipé dès que les coupons cumulés
          atteignent la cible de {t.cibleTarnPct}%.
        </div>
        <ScenarioList scenarios={scenarios} />
      </div>
    )
  }

  const chips: string[] = []
  chips.push(`${t.sens === 'bearish' ? 'Bearish' : t.sens === 'bullish' ? 'Bullish' : 'Taux'} · ${taux}`)
  if (typeof t.barriereCouponTauxPct === 'number')
    chips.push(`Coupon si ${cmp} ${t.barriereCouponTauxPct.toFixed(2)}%`)
  if (typeof t.barriereRappelTauxPct === 'number')
    chips.push(`Autocall si ${cmp} ${t.barriereRappelTauxPct.toFixed(2)}%`)
  if (t.effetMemoire) chips.push('Effet mémoire')
  if (typeof t.couponGarantiPct === 'number') chips.push(`Coupon garanti ${t.couponGarantiPct}%`)
  if (t.capitalGaranti) chips.push('Capital garanti')
  if (t.inFine) chips.push('Coupons in fine')

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-cmf-navy text-sm">Reconstruction (termsheet)</h3>
        <span className="text-[11px] text-slate-400">dérivé, non saisi</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="badge">
            {c}
          </span>
        ))}
      </div>

      <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-[12px] text-slate-600">
        Coupon conditionnel {t.couponConditionnelPct ? `${t.couponConditionnelPct}%/période` : ''}
        {t.couponConditionnelPa ? ` (≈ ${t.couponConditionnelPa}% p.a.)` : ''} versé si{' '}
        <span className="font-medium text-slate-800">{taux} {cmp} barrière de coupon</span>
        {t.effetMemoire ? ', avec effet mémoire' : ''}. Rappel anticipé si{' '}
        <span className="font-medium text-slate-800">{taux} {cmp} barrière de rappel</span>.
      </div>

      {/* Échéancier taux */}
      <div>
        <div className="field-label mb-1">Échéancier reconstruit (barrières en taux)</div>
        <div className="max-h-56 overflow-y-auto rounded border border-slate-100">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 sticky top-0">
              <tr>
                <th className="text-left font-medium px-2 py-1">#</th>
                <th className="text-left font-medium px-2 py-1">Observation</th>
                <th className="text-right font-medium px-2 py-1">B. coupon</th>
                <th className="text-right font-medium px-2 py-1">B. rappel</th>
                <th className="text-right font-medium px-2 py-1">Coupon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((l, i) => {
                const o = product.observations?.[i]
                return (
                  <tr key={l.n} className={l.passe ? 'text-slate-400' : ''}>
                    <td className="px-2 py-1 tabular-nums">{l.n}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {formatDateFr(l.date)}
                      {!l.actif && (
                        <span className="ml-1 text-[10px] text-slate-400">non-call</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {typeof o?.niveauCouponPct === 'number' ? `${o.niveauCouponPct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {typeof l.niveauRappelPct === 'number' ? `${l.niveauRappelPct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {typeof l.couponPct === 'number' ? `${l.couponPct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scénarios */}
      <div>
        <div className="field-label mb-1.5">Scénarios de dénouement</div>
        <ul className="space-y-1.5">
          {scenarios.map((s) => (
            <li key={s.titre} className={`rounded-md border p-2 ${TON[s.ton]}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className={`w-1.5 h-1.5 rounded-full ${TON_DOT[s.ton]}`} />
                {s.titre}
              </div>
              <div className="text-[12px] text-slate-500 mt-0.5">Si {s.condition}</div>
              <div className="text-[12px] text-slate-700">→ {s.resultat}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Reconstruction d'un produit de CRÉDIT (CLN / tranche d'indice iTraxx). */
function CreditReconstruction({ product, t }: { product: Product; t: CreditTerms }) {
  const scenarios = scenariosCredit(product)
  const width =
    typeof t.attachementPct === 'number' && typeof t.detachementPct === 'number'
      ? t.detachementPct - t.attachementPct
      : undefined

  const chips: string[] = []
  if (t.indexReference) chips.push(t.indexReference)
  if (typeof t.attachementPct === 'number' && typeof t.detachementPct === 'number')
    chips.push(`Tranche ${t.attachementPct}% – ${t.detachementPct}%`)
  if (typeof t.levier === 'number') chips.push(`Levier ×${t.levier}`)
  chips.push(t.zeroRecovery ? 'Zero recovery' : `Recouvrement ${t.recouvrementPct ?? '—'}%`)
  if (t.couponGaranti) chips.push('Coupon garanti')
  if (t.inFine) chips.push('In fine')
  chips.push(t.protectionCapital ? 'Capital protégé' : 'Capital à risque')

  const rows: { label: string; value: string }[] = []
  if (t.indexReference) rows.push({ label: 'Référence', value: t.indexReference })
  if (typeof t.nbEntites === 'number')
    rows.push({ label: 'Portefeuille', value: `${t.nbEntites} noms` })
  if (typeof t.attachementPct === 'number' && typeof t.detachementPct === 'number')
    rows.push({
      label: 'Tranche',
      value: `${t.attachementPct}% – ${t.detachementPct}%${width ? ` (épaisseur ${width.toFixed(2)}%)` : ''}`,
    })
  if (typeof t.couponPct === 'number')
    rows.push({ label: 'Coupon', value: `${t.couponPct}%${t.couponGaranti ? ' garanti' : ''}` })
  if (typeof t.prixEmissionPct === 'number')
    rows.push({ label: 'Prix d’émission', value: `${t.prixEmissionPct}% (escompte → 100%)` })
  if (typeof t.nbDefautsBuffer === 'number')
    rows.push({ label: 'Coussin', value: `~${t.nbDefautsBuffer} défaut(s) avant perte` })
  if (typeof t.nbDefautsWipe === 'number')
    rows.push({ label: 'Capital épuisé', value: `~${t.nbDefautsWipe} défauts` })

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-cmf-navy text-sm">Reconstruction (termsheet)</h3>
        <span className="text-[11px] text-slate-400">dérivé, non saisi</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="badge">
            {c}
          </span>
        ))}
      </div>

      <dl className="text-xs grid grid-cols-1 gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <dt className="field-label w-32 shrink-0">{r.label}</dt>
            <dd className="text-slate-700">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-md bg-orange-50 border border-orange-200 p-2 text-[12px] text-orange-700">
        Produit de crédit : le capital est réduit par les défauts qui franchissent le
        point d’attachement de la tranche{t.zeroRecovery ? ' (zero recovery : 100% de perte par nom)' : ''}.
      </div>

      <ScenarioList scenarios={scenarios} />
    </div>
  )
}
