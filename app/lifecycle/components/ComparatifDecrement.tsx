'use client'

import { useMemo, useState } from 'react'
import indicesRaw from '@/lib/decrement-indices.json'
import Modal from './Modal'

interface IndexInfo {
  nom?: string
  description?: string
  nbComposants?: number
  secteur?: string
  decrement?: string
  source?: string
}
const ENRICH = indicesRaw as Record<string, IndexInfo>

interface Row {
  ticker: string
  emetteur: string
  type: string
  strike: string | null
  uf: string | null
  couponPa: number | null
  memoire: boolean
  barriereCoupon: string | null
  barriereProtection: string | null
  departAutocall: string | null
  frequence: string | null
  degressivite: string | null
  seuilInitial: string | null
  maturiteMax: string | null
  secteur: string | null
  dateRun: string | null
}

const ISSUER_COLOR: Record<string, string> = {
  MS: 'text-rose-600',
  BNPP: 'text-emerald-600',
  GS: 'text-amber-600',
  UBS: 'text-red-600',
  BofA: 'text-blue-600',
  Citi: 'text-sky-600',
  BBVA: 'text-indigo-600',
}

function coupCls(v: number | null): string {
  if (typeof v !== 'number') return 'text-slate-400'
  if (v >= 12) return 'text-emerald-700 font-bold'
  if (v >= 9) return 'text-emerald-600 font-semibold'
  return 'text-slate-700'
}

// Description générée depuis les données du run (fallback quand pas de one-pager).
function describe(r: Row): string {
  let s = `${r.type ?? 'Produit autocall'} sur l'indice à décrément ${r.ticker}`
  if (r.secteur) s += ` (secteur ${r.secteur})`
  const p: string[] = []
  if (typeof r.couponPa === 'number')
    p.push(`coupon ${r.couponPa.toFixed(2)} % p.a.${r.memoire ? ' à effet mémoire' : ''}`)
  if (r.barriereCoupon) p.push(`barrière coupon ${r.barriereCoupon}`)
  if (r.barriereProtection) p.push(`protection ${r.barriereProtection}`)
  if (r.departAutocall) p.push(`autocall dès ${r.departAutocall}`)
  if (r.frequence) p.push(`obs. ${r.frequence.toLowerCase()}`)
  if (r.degressivite) p.push(`dégressivité ${r.degressivite}`)
  if (r.maturiteMax) p.push(`maturité max ${r.maturiteMax}`)
  if (typeof r.uf === 'string') p.push(`upfront ${r.uf}`)
  if (p.length) s += ' — ' + p.join(', ')
  return s + `. Émetteur ${r.emetteur}.`
}

export default function ComparatifDecrement({ rows }: { rows: Row[] }) {
  const [secteur, setSecteur] = useState<string | null>(null)
  const [emetteur, setEmetteur] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: keyof Row; dir: 'asc' | 'desc' }>({
    key: 'couponPa',
    dir: 'desc',
  })

  const secteurs = useMemo(
    () => Array.from(new Set(rows.map((r) => r.secteur).filter(Boolean) as string[])),
    [rows],
  )
  const emetteurs = useMemo(
    () => Array.from(new Set(rows.map((r) => r.emetteur))).sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!secteur || r.secteur === secteur) &&
        (!emetteur || r.emetteur === emetteur) &&
        (!needle ||
          r.ticker.toLowerCase().includes(needle) ||
          (r.secteur ?? '').toLowerCase().includes(needle) ||
          r.emetteur.toLowerCase().includes(needle)),
    )
  }, [rows, secteur, emetteur, q])

  const list = useMemo(() => {
    const m = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m
      return String(va).localeCompare(String(vb), 'fr') * m
    })
  }, [filtered, sort])

  const toggleSort = (key: keyof Row) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  const meilleur = useMemo(
    () => filtered.reduce((m, r) => Math.max(m, r.couponPa ?? 0), 0),
    [filtered],
  )

  const sel = open ? rows.find((r) => r.ticker === open) ?? null : null
  const selInfo = sel ? ENRICH[sel.ticker] : null

  const COLS: { k: keyof Row; label: string; align?: 'right' | 'center' }[] = [
    { k: 'ticker', label: 'Ticker / Indice' },
    { k: 'emetteur', label: 'Émetteur' },
    { k: 'type', label: 'Type' },
    { k: 'secteur', label: 'Secteur' },
    { k: 'couponPa', label: 'Coupon p.a.', align: 'right' },
    { k: 'uf', label: 'Upfront', align: 'right' },
    { k: 'memoire', label: 'Mém.', align: 'center' },
    { k: 'barriereCoupon', label: 'B. coupon', align: 'right' },
    { k: 'barriereProtection', label: 'B. prot.', align: 'right' },
    { k: 'degressivite', label: 'Dégressivité' },
    { k: 'departAutocall', label: 'Départ AC', align: 'center' },
    { k: 'maturiteMax', label: 'Maturité' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh_-_9rem)]">
      <div className="mb-3 shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-cmf-navy">Comparatif indices décrément</h1>
            <p className="text-sm text-slate-500 mt-1">
              {filtered.length} indices · {emetteurs.length} émetteurs · meilleur coupon{' '}
              <span className="font-semibold text-emerald-700">{meilleur.toFixed(2)}% p.a.</span> ·
              autocall T4, obs. trimestrielle, protection 50 %.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (ticker, secteur, émetteur)…"
              className="input w-[260px]"
            />
            <select
              value={emetteur}
              onChange={(e) => setEmetteur(e.target.value)}
              className="input max-w-[160px]"
            >
              <option value="">— Tous émetteurs —</option>
              {emetteurs.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtres secteur (chips) */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            onClick={() => setSecteur(null)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              !secteur ? 'border-cmf-blue bg-cmf-blue/10 text-cmf-navy' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tous secteurs
          </button>
          {secteurs.map((s) => (
            <button
              key={s}
              onClick={() => setSecteur(secteur === s ? null : s)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                secteur === s ? 'border-cmf-blue bg-cmf-blue/10 text-cmf-navy' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-auto flex-1 min-h-0">
        <table className="w-full text-[12px] border-separate border-spacing-0">
          <thead className="text-slate-500">
            <tr>
              {COLS.map((c) => (
                <th
                  key={String(c.k)}
                  onClick={() => toggleSort(c.k)}
                  className={`font-medium px-2 py-1.5 whitespace-nowrap border-b border-slate-200 bg-slate-50 sticky top-0 cursor-pointer select-none hover:text-cmf-navy ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort.key === c.k && <span className="text-cmf-blue">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r) => (
              <tr
                key={r.ticker}
                onClick={() => setOpen(r.ticker)}
                className="cursor-pointer hover:bg-orange-50"
              >
                <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                  {ENRICH[r.ticker] && <span className="text-cmf-blue mr-1" title="Fiche indice">ⓘ</span>}
                  {r.ticker}
                </td>
                <td className={`px-2 py-1.5 font-medium ${ISSUER_COLOR[r.emetteur] ?? 'text-slate-600'}`}>{r.emetteur}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{r.type}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{r.secteur ?? '—'}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${coupCls(r.couponPa)}`}>
                  {typeof r.couponPa === 'number' ? `${r.couponPa.toFixed(2)}%` : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-cmf-navy font-medium">{r.uf ?? '—'}</td>
                <td className="px-2 py-1.5 text-center">{r.memoire ? '✓' : ''}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.barriereCoupon ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.barriereProtection ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{r.degressivite ?? '—'}</td>
                <td className="px-2 py-1.5 text-center text-slate-500">{r.departAutocall ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{r.maturiteMax ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-2 shrink-0">
        Source : Comparatif Émetteurs — Indices à décrément (run février 2026). Coupons indicatifs
        à la date du run, non contractuels.
      </p>

      <Modal
        open={!!sel}
        onClose={() => setOpen(null)}
        title={sel ? `${selInfo?.nom ?? sel.ticker} · ${sel.emetteur}` : ''}
      >
        {sel && (
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-slate-500">
                  {sel.ticker}
                  {sel.secteur ? ` · ${sel.secteur}` : ''}
                </div>
                <h3 className="font-semibold text-cmf-navy">{selInfo?.nom ?? sel.ticker}</h3>
              </div>
              <div className="shrink-0 rounded-md bg-cmf-blue/10 border border-cmf-blue/30 px-3 py-1.5 text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">Upfront</div>
                <div className="text-lg font-bold text-cmf-navy tabular-nums">{sel.uf ?? '—'}</div>
              </div>
            </div>

            <p className="text-sm text-slate-600">{selInfo?.description ?? describe(sel)}</p>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              {typeof selInfo?.nbComposants === 'number' && (
                <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Composants</dt><dd>{selInfo.nbComposants}</dd></div>
              )}
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Décrément</dt><dd>{selInfo?.decrement ?? '50 pts (std.)'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Coupon p.a.</dt><dd>{typeof sel.couponPa === 'number' ? `${sel.couponPa.toFixed(2)} %` : '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Effet mémoire</dt><dd>{sel.memoire ? 'Oui' : 'Non'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Barrière coupon</dt><dd>{sel.barriereCoupon ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Protection</dt><dd>{sel.barriereProtection ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Départ autocall</dt><dd>{sel.departAutocall ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Seuil init. AC</dt><dd>{sel.seuilInitial ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Fréquence obs</dt><dd>{sel.frequence ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Dégressivité</dt><dd>{sel.degressivite ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Strike</dt><dd>{sel.strike ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Maturité max</dt><dd>{sel.maturiteMax ?? '—'}</dd></div>
              <div className="flex gap-2"><dt className="field-label w-28 shrink-0">Run</dt><dd>{sel.dateRun ?? '—'}</dd></div>
            </dl>

            <p className="text-[11px] text-slate-400">
              {selInfo?.source
                ? `Source : ${selInfo.source}`
                : 'Description générée depuis le run — fiche one-pager à intégrer pour la compo détaillée.'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
