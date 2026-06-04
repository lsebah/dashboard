'use client'

import { useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import {
  prochainEvenement,
  situation,
  couponPa,
  formatDateFr,
  formatPct,
} from '@/lib/lifecycle'
import { SITUATION_COLOR, SITUATION_LABEL, freqLabel, assetLabel } from './labels'
import ProductSynopsis from './ProductSynopsis'

function annees(p: Product): number {
  const d0 = new Date(p.dateConstatationInitiale).getTime()
  const d1 = new Date(p.dateEcheance).getTime()
  return Math.round((d1 - d0) / (365.25 * 86_400_000))
}

function ticker(s: string): string {
  return s.split(' ')[0]
}

function lastLabel(p: Product): { text: string; cls: string } {
  if (p.statut === 'rappele') return { text: 'CALLED', cls: 'text-emerald-600 font-semibold' }
  if (p.statut === 'vendu') return { text: 'SOLD', cls: 'text-blue-600 font-semibold' }
  if (p.statut === 'echu') return { text: 'ÉCHU', cls: 'text-slate-400' }
  if (typeof p.prixMarche === 'number')
    return { text: p.prixMarche.toFixed(2), cls: 'text-slate-800' }
  return { text: 'Live', cls: 'text-slate-400' }
}

const COLS = [
  'RR', 'Issue', 'ISIN', 'Last', 'P&L', 'Next event', 'CY', 'Amount',
  'Issuer', 'Freq.', 'Y', 'Description', 'Eq/Cr', 'Type', 'Mém.',
  'Cpn p.a.', 'B. Autocall', 'B. Coupon', 'PDI', 'Client', 'Sous-jacents',
]

export default function PortfolioExplorer({ products }: { products: Product[] }) {
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [client, setClient] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string>(products[0]?.id ?? '')

  const clients = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => p.clients?.forEach((c) => set.add(c)))
    return Array.from(set).sort()
  }, [products])

  const list = useMemo(
    () => (client ? products.filter((p) => p.clients?.includes(client)) : products),
    [products, client],
  )

  const selected = products.find((p) => p.id === selectedId) ?? list[0]

  return (
    <div>
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1.5 ${view === 'table' ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
          >
            Tableau
          </button>
          <button
            onClick={() => setView('cards')}
            className={`px-3 py-1.5 ${view === 'cards' ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
          >
            Cartes
          </button>
        </div>
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="input max-w-[220px]"
          title="Filtrer par client (axe d'allocation)"
        >
          <option value="">— Changer de client —</option>
          {clients.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((p) => (
            <ProductSynopsis key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Tableau dense (style Excel "Lifecycle") */}
          <div className="xl:col-span-2 card overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  {COLS.map((c) => (
                    <th key={c} className="text-left font-medium px-2 py-1.5 whitespace-nowrap border-b border-slate-200">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p) => {
                  const s = situation(p)
                  const nextEvt = prochainEvenement(p)
                  const last = lastLabel(p)
                  const t = p.terms
                  const memoire =
                    (t?.kind === 'autocall' && t.effetMemoire) ||
                    /[ée]moire/i.test(p.description ?? '')
                  const isSel = p.id === selected?.id
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`cursor-pointer hover:bg-slate-50 ${isSel ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-2 py-1.5 text-slate-500">{p.rr ?? '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                        {formatDateFr(p.dateEmission)}
                      </td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${SITUATION_COLOR[s]}`} title={SITUATION_LABEL[s]} />
                          {p.isin}
                        </span>
                      </td>
                      <td className={`px-2 py-1.5 tabular-nums ${last.cls}`}>{last.text}</td>
                      <td
                        className={`px-2 py-1.5 tabular-nums ${
                          typeof p.pnlPct === 'number'
                            ? p.pnlPct >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {typeof p.pnlPct === 'number'
                          ? `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">
                        {nextEvt ? formatDateFr(nextEvt) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">{p.devise}</td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                        {p.nominal.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{p.emetteur.split(' ')[0]}</td>
                      <td className="px-2 py-1.5 text-slate-500">{freqLabel(p.frequence)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{annees(p)}Y</td>
                      <td className="px-2 py-1.5 max-w-[260px] truncate" title={p.description ?? p.nom}>
                        {p.description ?? p.nom}
                      </td>
                      <td className={`px-2 py-1.5 ${p.assetClass === 'credit' ? 'text-orange-600 font-medium' : 'text-slate-500'}`}>
                        {assetLabel(p.assetClass)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{p.productType ?? '—'}</td>
                      <td className="px-2 py-1.5 text-center">{memoire ? '✓' : ''}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatPct(couponPa(p))}</td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                        {p.barriereAutocall ??
                          (t?.kind === 'autocall'
                            ? t.degressif
                              ? 'Dégr.'
                              : `${t.barriereRappelPct ?? 100}%`
                            : '—')}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {p.barriereCoupon ??
                          (t?.kind === 'autocall' && t.barriereCouponPct
                            ? `${t.barriereCouponPct}%`
                            : '—')}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {p.pdiText ?? (typeof p.pdiPct === 'number' ? `${p.pdiPct}%` : '—')}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                        {p.clients?.join(', ') ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex gap-2">
                          {p.sousJacents.slice(0, 3).map((u) => (
                            <span key={u.nom} className="inline-flex items-center gap-1">
                              <span className="text-slate-500">{ticker(u.bloomberg ?? u.nom)}</span>
                              <span
                                className={`tabular-nums ${
                                  typeof u.perf === 'number'
                                    ? u.perf >= 0
                                      ? 'text-emerald-600'
                                      : 'text-red-600'
                                    : 'text-slate-300'
                                }`}
                              >
                                {typeof u.perf === 'number' ? `${(100 + u.perf).toFixed(0)}%` : '—'}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Synopsis du produit sélectionné */}
          <div className="xl:col-span-1">
            <div className="sticky top-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Synopsis produit
              </div>
              {selected ? (
                <ProductSynopsis product={selected} />
              ) : (
                <div className="card p-4 text-sm text-slate-400">
                  Sélectionnez un produit.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
