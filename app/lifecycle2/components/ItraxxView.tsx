'use client'

import { useMemo, useState } from 'react'
import tranchesRaw from '@/data/itraxx-tranches.json'
import type { ItraxxTranche, ItraxxIndex } from '@/lib/itraxx/types'

const TRANCHES = tranchesRaw as ItraxxTranche[]

const dateFr = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')
const fmtCoupon = (t: ItraxxTranche) => t.coupon ?? '—'
const trancheLabel = (t: ItraxxTranche) =>
  t.attachment != null && t.detachment != null ? `${t.attachment}–${t.detachment}%` : t.tranche

export default function ItraxxView() {
  const [idx, setIdx] = useState<ItraxxIndex>('Main')

  const rows = useMemo(
    () =>
      TRANCHES.filter((t) => t.index === idx).sort(
        (a, b) =>
          (a.series ?? '').localeCompare(b.series ?? '') ||
          (a.attachment ?? 0) - (b.attachment ?? 0) ||
          (a.maturityYears ?? 0) - (b.maturityYears ?? 0),
      ),
    [idx],
  )
  const lastRun = useMemo(() => {
    const ds = TRANCHES.map((t) => t.runDate).filter(Boolean).sort() as string[]
    return ds.length ? ds[ds.length - 1] : ''
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-cmf-navy">iTraxx — tranches CLN</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tranches sur indices de crédit iTraxx Main &amp; Crossover (CLN). Caractéristiques,
            suivi et comparaison. Données réelles des runs reçus par email.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {(['Main', 'Crossover'] as ItraxxIndex[]).map((i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`px-3 py-1.5 ${idx === i ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
            >
              iTraxx {i}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['Série', 'Tranche', 'Maturité', 'Coupon', 'Type', 'Format', 'Émetteur', 'Devise', 'Run'].map((h) => (
                <th key={h} className="border-b border-slate-200 px-3 py-1.5 text-left font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Aucune tranche iTraxx {idx} importée pour l’instant — en attente du prochain run CLN
                  (rafraîchissement email).
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-orange-50/40">
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">{t.series ?? '—'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap font-medium text-slate-800">{trancheLabel(t)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{t.maturityYears ? `${t.maturityYears}Y` : '—'}</td>
                <td className="px-3 py-1.5 font-medium text-cmf-navy" title={t.coupon ?? undefined}>{fmtCoupon(t)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{t.couponType ?? '—'}</td>
                <td className="px-3 py-1.5 text-slate-600" title={t.format ?? undefined}>{t.format ?? '—'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{t.issuer ?? '—'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{t.devise ?? '—'}</td>
                <td className="px-3 py-1.5 whitespace-nowrap tabular-nums text-slate-400" title={t.source}>{dateFr(t.runDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {TRANCHES.length} tranche(s) au total · iTraxx Main &amp; Crossover. Dernier run : {dateFr(lastRun)}.
        Mise à jour à chaque nouveau run CLN reçu (rafraîchissement email).
      </p>
    </div>
  )
}
