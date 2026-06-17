'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFrnStore } from '@/lib/frn/store'
import { displayedCoupon, fmt2 } from '@/lib/frn/pricing'
import { issuerInfo, ratingLine, issuerOrder } from '@/lib/frn/issuers'
import type { Currency, CallType, FrnQuote } from '@/lib/frn/types'
import FrnImportPanel from './FrnImportPanel'

const MATURITIES = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15]

/** Nombre de jours OUVRÉS écoulés depuis une date ISO. */
function businessDaysAgo(iso: string, now = new Date()): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return Infinity
  const cur = new Date(d)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  let count = 0
  while (cur < end) {
    cur.setDate(cur.getDate() + 1)
    const wd = cur.getDay()
    if (wd !== 0 && wd !== 6) count++
  }
  return count
}
const dateFr = (iso: string) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

interface TableModel {
  issuers: string[]
  grid: Map<string, Map<number, FrnQuote>>
  lastRun: Record<string, string>
  best: Map<number, number>
}

export default function FrnView() {
  const { quotes, upsert, local, reset } = useFrnStore()
  const [currency, setCurrency] = useState<Currency>('EUR')
  const [reofferStr, setReofferStr] = useState('100.00')
  const [reoffer, setReoffer] = useState(100)
  const [staleDays, setStaleDays] = useState(5)
  const [importOpen, setImportOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Recalcul temps réel avec léger debounce sur le reoffer.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = parseFloat(reofferStr.replace(',', '.'))
      if (Number.isFinite(v)) setReoffer(v)
    }, 200)
    return () => clearTimeout(t)
  }, [reofferStr])

  const byCurrency = useMemo(() => quotes.filter((q) => q.currency === currency), [quotes, currency])

  const build = (callType: CallType): TableModel => {
    const rows = byCurrency.filter((q) => q.callType === callType)
    const issuers = Array.from(new Set(rows.map((r) => r.issuer))).sort(
      (a, b) => issuerOrder(a) - issuerOrder(b) || a.localeCompare(b),
    )
    const grid = new Map<string, Map<number, FrnQuote>>()
    const lastRun: Record<string, string> = {}
    for (const q of rows) {
      if (!grid.has(q.issuer)) grid.set(q.issuer, new Map())
      grid.get(q.issuer)!.set(q.maturityYears, q)
      if (!lastRun[q.issuer] || q.runDate > lastRun[q.issuer]) lastRun[q.issuer] = q.runDate
    }
    // Meilleur coupon par maturité parmi les runs FRAIS (les coupons sont sur la
    // même base — running annuel au UF du run).
    const best = new Map<number, number>()
    for (const q of rows) {
      if (businessDaysAgo(q.runDate) > staleDays) continue
      const d = displayedCoupon(q, reoffer)
      const cur = best.get(q.maturityYears)
      if (cur === undefined || d.value > cur) best.set(q.maturityYears, d.value)
    }
    return { issuers, grid, lastRun, best }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tableNC = useMemo(() => build('NC'), [byCurrency, reoffer, staleDays])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tableCALL = useMemo(() => build('CALLABLE'), [byCurrency, reoffer, staleDays])

  const lastUpdate = useMemo(() => {
    const ds = byCurrency.map((q) => q.runDate).filter(Boolean).sort()
    return ds.length ? ds[ds.length - 1] : ''
  }, [byCurrency])

  // ── Export texte propre (sans UF) pour coller dans un email client ──────────
  const buildExport = (): string => {
    const head = ['Émetteur', ...MATURITIES.map((m) => `${m}Y`)]
    const section = (m: TableModel, title: string) => {
      const lines: string[][] = [head]
      for (const iss of m.issuers) {
        const row = [iss]
        for (const mat of MATURITIES) {
          const q = m.grid.get(iss)?.get(mat)
          if (!q) {
            row.push('-')
            continue
          }
          const d = displayedCoupon(q, reoffer)
          row.push(fmt2(d.value))
        }
        lines.push(row)
      }
      const widths = head.map((_, c) => Math.max(...lines.map((l) => (l[c] ?? '').length)))
      const fmtRow = (l: string[]) => l.map((cell, c) => (c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c]))).join('  ')
      return [`=== ${title} ===`, ...lines.map(fmtRow)].join('\n')
    }
    return [
      `FRN ${currency} — coupons quotés (running annuel), reoffer ${reoffer.toFixed(2)}%`,
      '',
      section(tableNC, 'Non Call'),
      '',
      section(tableCALL, 'Callable (NC1)'),
      '',
      `MAJ ${new Date().toLocaleString('fr-FR')}`,
    ].join('\n')
  }
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildExport())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard indisponible */
    }
  }

  // ── Rendu d'un tableau ──────────────────────────────────────────────────────
  const renderTable = (m: TableModel, title: string) => (
    <div className="card overflow-auto">
      <div className="px-3 pt-3 text-sm font-semibold text-cmf-navy">{title}</div>
      <table className="mt-1.5 w-full table-fixed border-collapse text-[13px]">
        {/* Largeurs FIXES identiques dans les deux tableaux ⇒ les colonnes
            d'années s'alignent verticalement d'un tableau à l'autre. */}
        <colgroup>
          <col style={{ width: 190 }} />
          <col style={{ width: 96 }} />
          {MATURITIES.map((m) => (
            <col key={m} />
          ))}
        </colgroup>
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-1 text-left font-medium">Émetteur</th>
            <th className="border-b border-slate-200 px-2 py-1 text-left font-medium whitespace-nowrap">Dernier run</th>
            {MATURITIES.map((mat) => (
              <th key={mat} className="border-b border-slate-200 px-2 py-1 text-right font-medium tabular-nums">{mat}Y</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {m.issuers.length === 0 && (
            <tr>
              <td colSpan={MATURITIES.length + 2} className="px-3 py-6 text-center text-slate-400">
                Aucun prix {currency} pour ce tableau.
              </td>
            </tr>
          )}
          {m.issuers.map((iss) => {
            const info = issuerInfo(iss)
            const run = m.lastRun[iss]
            const stale = run ? businessDaysAgo(run) > staleDays : true
            return (
              <tr key={iss} className="hover:bg-orange-50/40">
                <td className="sticky left-0 z-10 bg-white px-3 py-1 whitespace-nowrap leading-tight">
                  <div className="font-medium text-slate-800">{iss}</div>
                  {info && <div className="text-[10px] leading-none text-slate-400" title="Moody's / S&P / Fitch (indicatif)">{ratingLine(info)}</div>}
                </td>
                <td className={`px-2 py-1 whitespace-nowrap tabular-nums ${stale ? 'text-amber-600' : 'text-slate-500'}`} title={stale ? `Plus de ${staleDays} j ouvrés` : undefined}>
                  {dateFr(run)}
                </td>
                {MATURITIES.map((mat) => {
                  const q = m.grid.get(iss)?.get(mat)
                  if (!q) return <td key={mat} className="px-2 py-1 text-right text-slate-300">—</td>
                  const d = displayedCoupon(q, reoffer)
                  const cellStale = businessDaysAgo(q.runDate) > staleDays
                  const isBest = !cellStale && m.best.get(mat) !== undefined && Math.abs(m.best.get(mat)! - d.value) < 1e-9
                  const cls = cellStale ? 'text-slate-300' : isBest ? 'font-bold text-red-600' : 'text-slate-700'
                  return (
                    <td key={mat} className={`px-2 py-1 text-right tabular-nums ${cls}`}
                        title={`${q.issuer} ${q.maturityYears}Y · coupon ${fmt2(q.coupon)}% · UF ${fmt2(q.uf)}%${q.sensitivity != null ? ` · sensi ${q.sensitivity}` : ' · duration non fournie'} · run ${dateFr(q.runDate)}${q.source ? ' · ' + q.source : ''}`}>
                      <div className="leading-tight">{fmt2(d.value)}</div>
                      <div className="text-[9px] font-normal leading-none text-slate-400">
                        {q.sensitivity != null ? `s ${q.sensitivity}` : `@${fmt2(q.baseReoffer)}`}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cmf-navy">FRN — runs émetteurs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fixed Rate Notes · coupons réels des runs émetteurs. Meilleur coupon par maturité en{' '}
            <span className="font-semibold text-red-600">rouge</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Sous-onglets devise */}
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
            {(['EUR', 'USD'] as Currency[]).map((c) => (
              <button key={c} onClick={() => setCurrency(c)} className={`px-3 py-1.5 ${currency === c ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}>
                {c}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            Reoffer
            <input value={reofferStr} onChange={(e) => setReofferStr(e.target.value)} inputMode="decimal" className="input w-24 text-right tabular-nums" title="Reoffer commun aux deux tableaux (recalcul temps réel)" />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            Péremption (j ouvrés)
            <input type="number" min={0} value={staleDays} onChange={(e) => setStaleDays(Math.max(0, Number(e.target.value) || 0))} className="input w-16 text-right tabular-nums" />
          </label>
          <button onClick={() => setImportOpen(true)} className="rounded-md bg-cmf-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Importer un run
          </button>
          <button onClick={doCopy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50" title="Copie texte propre (sans UF) pour email client">
            {copied ? '✓ Copié' : 'Copier pour email'}
          </button>
          {local.length > 0 && (
            <button onClick={reset} className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100" title="Efface les runs saisis localement">
              Réinit. saisies ({local.length})
            </button>
          )}
        </div>
      </div>

      {renderTable(tableNC, 'Non Call')}
      {renderTable(tableCALL, 'Callable (NC1)')}

      <p className="text-xs text-slate-400">
        Coupons réels tirés des runs émetteurs (running annuel, au UF du run). Retraitement à 0 % UF /
        reoffer {reoffer.toFixed(2)} % appliqué uniquement si la duration est fournie. Cellules grisées =
        run &gt; {staleDays} j ouvrés. Meilleur coupon/maturité en rouge. Dernière MAJ {currency} :{' '}
        {dateFr(lastUpdate)}.
      </p>

      <FrnImportPanel open={importOpen} onClose={() => setImportOpen(false)} onSave={(qs) => upsert(qs)} defaultCurrency={currency} />
    </div>
  )
}
