'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import curated from '@/data/markets-curated.json'

interface MarketItem {
  group: string
  name: string
  symbol: string
  unit: string
  price: number | null
  change: number | null
  changePct: number | null
  marketState: string
  timestamp?: number
}
interface CuratedItem {
  label: string
  value: number | null
  unit: string
  asof: string | null
}
interface CuratedGroup {
  titre: string
  items: CuratedItem[]
}
const CURATED = curated as { majLe: string; note: string; groupes: CuratedGroup[] }

function fmtPrice(it: MarketItem): string {
  if (it.price == null) return '—'
  if (it.group === 'Change') return it.price.toFixed(4)
  if (it.group === 'Volatilité') return it.price.toFixed(2)
  if (it.unit === '%') return `${it.price.toFixed(2)} %`
  return it.price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}
const pctClass = (n: number | null) => (n == null ? 'text-slate-400' : n >= 0 ? 'text-emerald-600' : 'text-red-600')
const fmtPct = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)} %`)
const daysAgo = (iso: string | null) => {
  if (!iso) return Infinity
  const d = new Date(iso).getTime()
  return Number.isNaN(d) ? Infinity : Math.floor((Date.now() - d) / 86400000)
}

export default function MarketTerminal() {
  const [items, setItems] = useState<MarketItem[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/lifecycle/markets', { cache: 'no-store' })
      const d = await res.json()
      setItems(d.items ?? [])
      setUpdatedAt(d.updatedAt ?? null)
      setLive(!!d.live)
    } catch {
      /* garde la dernière valeur */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000) // rafraîchissement régulier
    return () => clearInterval(t)
  }, [load])

  const liveGroups = useMemo(() => {
    const order = ['Indices', 'Change', 'Commodités', 'Taux souverains US', 'Volatilité']
    const m = new Map<string, MarketItem[]>()
    for (const it of items) {
      if (!m.has(it.group)) m.set(it.group, [])
      m.get(it.group)!.push(it)
    }
    return order.filter((g) => m.has(g)).map((g) => ({ titre: g, items: m.get(g)! }))
  }, [items])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-cmf-navy">Marchés — terminal</h1>
          <p className="mt-1 text-sm text-slate-500">
            Flux temps réel (Yahoo) + taux curatés. Rafraîchissement automatique toutes les 60 s.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-400 lc2-pulse'}`} />
            {loading ? 'Chargement…' : live ? 'Live' : 'Marché fermé / cache'}
          </span>
          {updatedAt && <span className="tabular-nums">MAJ {new Date(updatedAt).toLocaleTimeString('fr-FR')}</span>}
          <button onClick={load} className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-600 hover:bg-slate-50">
            ↻
          </button>
        </div>
      </div>

      {/* Flux temps réel */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {liveGroups.map((g) => (
          <div key={g.titre} className="rounded-lg border border-[#e2e6ec] bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {g.titre}
            </div>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-slate-50">
                {g.items.map((it) => (
                  <tr key={it.symbol} className="hover:bg-slate-50">
                    <td className="px-3 py-1.5 text-slate-700">{it.name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-900">{fmtPrice(it)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${pctClass(it.changePct)}`}>{fmtPct(it.changePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {loading &&
          liveGroups.length === 0 &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-[#e2e6ec] bg-slate-50" />
          ))}
      </div>

      {/* Taux curatés (BCE / FED / inflation / souverains EUR / swaps) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CURATED.groupes.map((g) => (
          <div key={g.titre} className="rounded-lg border border-[#e2e6ec] bg-white">
            <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {g.titre} <span className="font-normal normal-case text-slate-300">· curaté</span>
            </div>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-slate-50">
                {g.items.map((it) => {
                  const stale = daysAgo(it.asof) > 30
                  return (
                    <tr key={it.label} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-700">{it.label}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {it.value == null ? (
                          <span className="text-slate-300">à renseigner</span>
                        ) : (
                          <span className={stale ? 'text-amber-600' : 'text-slate-900'}>
                            {it.value.toFixed(2)} {it.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[11px] text-slate-400 tabular-nums" title={stale ? 'Plus de 30 jours' : undefined}>
                        {it.asof ? new Date(it.asof).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Indices, change, commodités, rendements souverains US et VIX : <strong>temps réel</strong> (Yahoo).
        Les blocs « curaté » (BCE, FED, inflation, souverains EUR, swaps) se tiennent à jour dans{' '}
        <span className="font-mono">data/markets-curated.json</span> — une valeur de plus de 30 jours est
        signalée en orange.
      </p>
    </div>
  )
}
