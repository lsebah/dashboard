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
import { useAllocations, tousLesClients, type ClientAlloc } from '@/lib/allocations'
import { SITUATION_COLOR, SITUATION_LABEL, freqLabel, assetLabel } from './labels'
import ProductSynopsis from './ProductSynopsis'
import ProductReconstruction from './ProductReconstruction'
import ClientAssign from './ClientAssign'
import Modal from './Modal'

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

type SortVal = string | number | undefined

// Valeur numérique de tête d'une chaîne (« 85% », « 2,50% » → 85 / 2.5).
function pctNum(s?: string): number | undefined {
  if (!s) return undefined
  const m = s.match(/-?\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : undefined
}
function bAutocallVal(p: Product): number | undefined {
  if (p.barriereAutocall) return pctNum(p.barriereAutocall)
  const t = p.terms
  if (t?.kind === 'autocall' && !t.degressif) return t.barriereRappelPct ?? 100
  return undefined
}
function bCouponVal(p: Product): number | undefined {
  if (p.barriereCoupon) return pctNum(p.barriereCoupon)
  const t = p.terms
  return t?.kind === 'autocall' ? t.barriereCouponPct : undefined
}
function pdiVal(p: Product): number | undefined {
  return p.pdiText ? pctNum(p.pdiText) : p.pdiPct
}
function memVal(p: Product): number {
  const t = p.terms
  return (t?.kind === 'autocall' && t.effetMemoire) || /[ée]moire/i.test(p.description ?? '')
    ? 1
    : 0
}
function sjVal(p: Product): string | undefined {
  const u = p.sousJacents[0]
  return u ? ticker(u.bloomberg ?? u.nom) : undefined
}

// Colonnes du tableau (ordre = ordre des cellules du corps). `key` ⇒ triable.
const COLUMNS: { label: string; key?: string; align?: 'center' }[] = [
  { label: 'RR', key: 'rr' },
  { label: 'Issue', key: 'issue' },
  { label: 'ISIN', key: 'isin' },
  { label: 'Last', key: 'last' },
  { label: 'P&L', key: 'pnl' },
  { label: 'Next event', key: 'next' },
  { label: 'CY', key: 'cy' },
  { label: 'Amount', key: 'amount' },
  { label: 'Issuer', key: 'issuer' },
  { label: 'Freq.', key: 'freq' },
  { label: 'Y', key: 'y' },
  { label: 'Description', key: 'desc' },
  { label: 'Eq/Cr', key: 'asset' },
  { label: 'Type', key: 'type' },
  { label: 'Mém.', key: 'mem', align: 'center' },
  { label: 'Cpn p.a.', key: 'cpn' },
  { label: 'B. Autocall', key: 'bauto' },
  { label: 'B. Coupon', key: 'bcoupon' },
  { label: 'PDI', key: 'pdi' },
  { label: 'Client', key: 'client' },
  { label: 'Sous-jacents', key: 'sj' },
]

function compare(a: SortVal, b: SortVal): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'fr')
}

export default function PortfolioExplorer({ products }: { products: Product[] }) {
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [client, setClient] = useState<string>('')
  const [liveOnly, setLiveOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'issue',
    dir: 'desc',
  })

  const { map, setClients } = useAllocations()

  // Allocations effectives d'un produit : localStorage, sinon seed `clients`.
  const allocsOf = useMemo(
    () =>
      (p: Product): ClientAlloc[] =>
        map[p.isin] ?? p.clients?.map((c) => ({ client: c })) ?? [],
    [map],
  )

  const clients = useMemo(
    () => tousLesClients(map, products.flatMap((p) => p.clients ?? [])),
    [map, products],
  )

  const filtered = useMemo(() => {
    let l = products
    if (client) l = l.filter((p) => allocsOf(p).some((a) => a.client === client))
    if (liveOnly) l = l.filter((p) => typeof p.prixMarche === 'number')
    return l
  }, [products, client, liveOnly, allocsOf])

  const nbLive = useMemo(
    () => products.filter((p) => typeof p.prixMarche === 'number').length,
    [products],
  )

  const sorters: Record<string, (p: Product) => SortVal> = useMemo(
    () => ({
      rr: (p) => p.rr,
      issue: (p) => p.dateEmission,
      isin: (p) => p.isin,
      last: (p) => p.prixMarche,
      pnl: (p) => p.pnlPct,
      next: (p) => prochainEvenement(p),
      cy: (p) => p.devise,
      amount: (p) => p.nominal,
      issuer: (p) => p.emetteur,
      freq: (p) => freqLabel(p.frequence),
      y: (p) => annees(p),
      desc: (p) => p.description ?? p.nom,
      asset: (p) => p.assetClass,
      type: (p) => p.productType,
      cpn: (p) => couponPa(p),
      mem: (p) => memVal(p),
      bauto: (p) => bAutocallVal(p),
      bcoupon: (p) => bCouponVal(p),
      pdi: (p) => pdiVal(p),
      client: (p) => allocsOf(p)[0]?.client,
      sj: (p) => sjVal(p),
    }),
    [allocsOf],
  )

  const list = useMemo(() => {
    const acc = sorters[sort.key]
    if (!acc) return filtered
    const m = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = acc(a)
      const vb = acc(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1 // valeurs vides toujours en fin
      if (vb == null) return -1
      return compare(va, vb) * m
    })
  }, [filtered, sort, sorters])

  const toggleSort = (key?: string) => {
    if (!key) return
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  const opened = openId ? products.find((p) => p.id === openId) ?? null : null

  return (
    <div>
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setLiveOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              liveOnly
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="N'afficher que les produits LIVE (avec un prix)"
          >
            <span className={`w-2 h-2 rounded-full ${liveOnly ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            LIVE
            <span className="text-xs text-slate-400">{nbLive}</span>
          </button>
        </div>
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="input max-w-[220px]"
          title="Filtrer par client (axe d'allocation)"
        >
          <option value="">— Tous les clients —</option>
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
            <button key={p.id} onClick={() => setOpenId(p.id)} className="text-left">
              <ProductSynopsis product={p} />
            </button>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-slate-50 text-slate-500 sticky top-0">
              <tr>
                {COLUMNS.map((c) => {
                  const active = c.key && sort.key === c.key
                  return (
                    <th
                      key={c.label}
                      onClick={() => toggleSort(c.key)}
                      className={`font-medium px-2 py-1.5 whitespace-nowrap border-b border-slate-200 ${
                        c.align === 'center' ? 'text-center' : 'text-left'
                      } ${c.key ? 'cursor-pointer select-none hover:text-cmf-navy' : ''}`}
                      title={c.key ? 'Trier' : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {active && (
                          <span className="text-cmf-blue">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                        )}
                        {c.key && !active && <span className="text-slate-300">↕</span>}
                      </span>
                    </th>
                  )
                })}
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
                const allocs = allocsOf(p)
                return (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    className="cursor-pointer hover:bg-blue-50/60"
                  >
                    <td className="px-2 py-1.5 text-slate-500">{p.rr ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                      {formatDateFr(p.dateEmission)}
                    </td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${SITUATION_COLOR[s]}`} title={SITUATION_LABEL[s]} />
                        {p.isin}
                        {p.termsheetUrl && (
                          <a
                            href={p.termsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-400 hover:text-cmf-blue"
                            title="Ouvrir la termsheet (PDF)"
                          >
                            📄
                          </a>
                        )}
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
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">
                      {allocs.length > 0 ? (
                        allocs.map((a) => a.client).join(', ')
                      ) : (
                        <span className="text-slate-300">+ affecter</span>
                      )}
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
      )}

      {/* Popup produit */}
      <Modal
        open={!!opened}
        onClose={() => setOpenId(null)}
        title={opened ? `${opened.nom} · ${opened.isin}` : ''}
      >
        {opened && (
          <div className="flex flex-col gap-3">
            <ProductSynopsis product={opened} />
            <ClientAssign
              allocs={allocsOf(opened)}
              devise={opened.devise}
              onChange={(next) => setClients(opened.isin, next)}
            />
            <ProductReconstruction product={opened} />
          </div>
        )}
      </Modal>
    </div>
  )
}
