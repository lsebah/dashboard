'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import {
  totaux,
  parClasse,
  parEmetteur,
  parType,
  parSecteur,
  parRegion,
  parClient,
  contributeurs,
  echeancierParAnnee,
  concentration,
  historiqueEncours,
  estVivant,
  eurNominal,
  prixOf,
  pnlOf,
  eurCompact,
  pct,
  pctAbs,
  type Part,
} from '@/lib/cmf-analytics'
import {
  Panel,
  StatCard,
  Donut,
  Legend,
  BarList,
  DivergingBars,
  AreaChart,
  HeatGrid,
  RadialStat,
  Sparkline,
  colorAt,
  BB_ORANGE,
} from './charts'

// ── Helpers de situation « live » (depuis le worst-of courant Yahoo) ─────────
function barriereProtection(p: Product): number | undefined {
  if (p.terms?.kind === 'autocall') return p.terms.protectionPct
  return p.pdiPct ?? undefined
}
type Sit = 'positive' | 'sans_stress' | 'proche' | 'sous' | 'non_classe'
function sitLive(p: Product, wo: number | null | undefined): Sit {
  if (typeof wo !== 'number') {
    if (p.terms?.kind === 'rates' && p.terms.capitalGaranti) return 'sans_stress'
    return 'non_classe'
  }
  const prot = barriereProtection(p)
  if (wo >= 100) return 'positive'
  if (prot === undefined) return 'sans_stress'
  if (wo < prot) return 'sous'
  if (wo - prot <= 10) return 'proche'
  return 'sans_stress'
}
const SIT_META: Record<Sit, { label: string; color: string }> = {
  positive: { label: 'En gain', color: '#16a34a' },
  sans_stress: { label: 'Sans stress', color: '#0ea5e9' },
  proche: { label: 'Proche barrière', color: '#f59e0b' },
  sous: { label: 'Sous barrière', color: '#ef4444' },
  non_classe: { label: 'Non classé', color: '#94a3b8' },
}

function heatColor(m: number | null): string {
  if (m === null) return '#ece9e2'
  if (m < 0) return '#ef4444'
  if (m < 8) return '#f59e0b'
  if (m < 20) return '#eab308'
  if (m < 35) return '#84cc16'
  return '#22c55e'
}

// Top N + regroupement du reste en « Autres ».
function topN(parts: Part[], n: number): Part[] {
  if (parts.length <= n) return parts
  const head = parts.slice(0, n)
  const rest = parts.slice(n)
  const montant = rest.reduce((s, p) => s + p.montant, 0)
  const pctSum = rest.reduce((s, p) => s + p.pct, 0)
  return [...head, { label: 'Autres', montant, pct: pctSum, n: rest.reduce((s, p) => s + p.n, 0) }]
}
const toDonut = (parts: Part[]) => parts.map((p, i) => ({ label: p.label, value: p.montant, color: colorAt(i), pct: p.pct }))

export default function CmfTerminal({ products }: { products: Product[] }) {
  const [courant, setCourant] = useState<Record<string, number | null> | null>(null)

  useEffect(() => {
    let annule = false
    const isins = Array.from(new Set(products.map((p) => p.isin)))
    fetch(`/api/lifecycle/courant?isins=${encodeURIComponent(isins.join(','))}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return
        const m: Record<string, number | null> = {}
        for (const [isin, v] of Object.entries(d?.courant ?? {}))
          m[isin] = (v as { worstOf: number | null }).worstOf
        setCourant(m)
      })
      .catch(() => !annule && setCourant({}))
    return () => {
      annule = true
    }
  }, [products])

  const T = useMemo(() => totaux(products), [products])
  const vivants = useMemo(() => products.filter(estVivant), [products])
  const classe = useMemo(() => topN(parClasse(vivants), 6), [vivants])
  const emetteur = useMemo(() => topN(parEmetteur(vivants), 8), [vivants])
  const type = useMemo(() => topN(parType(vivants), 7), [vivants])
  const secteur = useMemo(() => topN(parSecteur(vivants), 8), [vivants])
  const region = useMemo(() => parRegion(vivants), [vivants])
  const clients = useMemo(() => topN(parClient(products), 9), [products])
  const contrib = useMemo(() => contributeurs(products), [products])
  const echeances = useMemo(() => echeancierParAnnee(products), [products])
  const conc = useMemo(() => concentration(products), [products])
  const histo = useMemo(() => historiqueEncours(products), [products])

  const risque = useMemo(() => {
    return vivants
      .map((p) => {
        const wo = courant ? courant[p.isin] ?? null : null
        const prot = barriereProtection(p)
        const marge = typeof wo === 'number' && typeof prot === 'number' ? wo - prot : null
        return { p, wo, prot, marge, sit: sitLive(p, wo) }
      })
      .filter((r) => r.p.sousJacents.length > 0)
      .sort((a, b) => (a.marge ?? 1e9) - (b.marge ?? 1e9))
  }, [vivants, courant])

  const situations = useMemo(() => {
    const counts: Record<Sit, { n: number; montant: number }> = {
      positive: { n: 0, montant: 0 },
      sans_stress: { n: 0, montant: 0 },
      proche: { n: 0, montant: 0 },
      sous: { n: 0, montant: 0 },
      non_classe: { n: 0, montant: 0 },
    }
    for (const p of vivants) {
      const wo = courant ? courant[p.isin] ?? null : null
      const s = sitLive(p, wo)
      counts[s].n += 1
      counts[s].montant += eurNominal(p)
    }
    return counts
  }, [vivants, courant])
  const totalSitMontant = Object.values(situations).reduce((s, v) => s + v.montant, 0) || 1
  const proches = situations.proche.n + situations.sous.n

  const sparkEncours = histo.map((h) => h.encours)
  const live = courant !== null

  return (
    <div className="flex flex-col gap-4">
      {/* ── En-tête de section ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Vue d&apos;ensemble du portefeuille</h2>
          <p className="text-[13px] text-slate-500">
            Livre vivant · {T.nbVivant} produits actifs sur {T.nbTotal} · valorisation mark-to-market
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-bb-orange lc2-pulse'}`} />
          {live ? 'Niveaux temps réel' : 'Chargement des niveaux…'}
        </span>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Encours nominal" value={eurCompact(T.nominal)} sub={`${T.nbVivant} produits vivants`} accent={BB_ORANGE} style={{ animationDelay: '0ms' }} spark={<Sparkline data={sparkEncours} />} />
        <StatCard label="Valorisation MtM" value={eurCompact(T.valorisation)} delta={T.pnlPct} deltaLabel="vs nominal" accent="#0ea5e9" style={{ animationDelay: '40ms' }} />
        <StatCard label="P&L latent" value={`${T.pnlEur >= 0 ? '+' : ''}${eurCompact(T.pnlEur)}`} sub="MtM + coupons encaissés" accent={T.pnlEur >= 0 ? '#16a34a' : '#e11d48'} style={{ animationDelay: '80ms' }} />
        <StatCard label="Rdt depuis origine" value={pct(T.pnlPct)} sub="pondéré nominal" accent="#10b981" style={{ animationDelay: '120ms' }} />
        <StatCard label="Carry p.a. (cible)" value={pctAbs(T.carryPa)} sub="coupon annualisé moyen" accent="#f59e0b" style={{ animationDelay: '160ms' }} />
        <StatCard label="Rendement YTD" value={pctAbs(T.carryYtd)} sub="carry couru 2026 · indicatif" accent="#ffb000" style={{ animationDelay: '200ms' }} />
        <StatCard label="Dispersion P&L" value={`${T.dispersion.toFixed(1)} pt`} sub="écart-type pondéré · indicatif" accent="#8b5cf6" style={{ animationDelay: '240ms' }} />
        <StatCard label="Ratio rdt / risque" value={T.ratio.toFixed(2)} sub="rendement / dispersion" accent="#0891b2" style={{ animationDelay: '280ms' }} />
      </div>

      {/* ── Allocation des actifs ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Allocation par classe d'actif" sub="part de l'encours nominal">
          <div className="flex items-center gap-4">
            <Donut data={toDonut(classe)} centerTop={`${classe.length}`} centerSub="classes" />
            <div className="min-w-0 flex-1">
              <Legend items={toDonut(classe)} format={eurCompact} />
            </div>
          </div>
        </Panel>
        <Panel title="Top émetteurs" sub={`${conc.nbEmetteurs} émetteurs · HHI ${conc.hhiEmetteur}`}>
          <BarList items={emetteur.map((e, i) => ({ label: e.label, value: e.montant, pct: e.pct, color: colorAt(i) }))} format={eurCompact} />
        </Panel>
        <Panel title="Par type de produit" sub="Phoenix · Athéna · Booster · Reverse…">
          <BarList items={type.map((e, i) => ({ label: e.label, value: e.montant, pct: e.pct, sub: `${e.n}`, color: colorAt(i + 3) }))} format={eurCompact} />
        </Panel>
      </div>

      {/* ── Répartition sectorielle & géographique ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Répartition sectorielle" sub="dérivée des sous-jacents (secteur dominant)">
          <BarList items={secteur.map((e, i) => ({ label: e.label, value: e.montant, pct: e.pct, sub: `${e.n}`, color: colorAt(i) }))} format={eurCompact} />
        </Panel>
        <Panel title="Répartition géographique" sub="zone dominante des sous-jacents">
          <div className="flex items-center gap-4">
            <Donut data={toDonut(region)} centerTop={`${region.length}`} centerSub="zones" />
            <div className="min-w-0 flex-1">
              <Legend items={toDonut(region)} format={eurCompact} />
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Évolution & contribution ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel title="Évolution de l'encours" sub="nominal actif reconstruit (mensuel)" className="lg:col-span-3">
          <AreaChart points={histo.map((h) => ({ label: h.label, value: h.encours }))} format={eurCompact} color={BB_ORANGE} />
        </Panel>
        <Panel title="Contributeurs au P&L" sub="meilleurs / moins bons (€, MtM)" className="lg:col-span-2">
          <DivergingBars
            items={[...contrib.slice(0, 5), ...contrib.slice(-5).reverse()]
              .filter((c, i, a) => a.findIndex((x) => x.isin === c.isin) === i)
              .map((c) => ({ label: c.label.length > 16 ? c.label.slice(0, 16) + '…' : c.label, value: c.contribEur, sub: `${c.emetteur} · ${pct(c.pnlPct)}` }))}
            format={eurCompact}
          />
        </Panel>
      </div>

      {/* ── Risque ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel
          title="Cartographie du risque — worst-of vs barrière"
          sub="chaque cellule = un produit, classé du plus risqué au plus sûr (niveaux live)"
          className="lg:col-span-3"
          right={
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#ef4444' }} />sous</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#f59e0b' }} />proche</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#22c55e' }} />confortable</span>
            </div>
          }
        >
          {!live ? (
            <div className="grid animate-pulse grid-cols-12 gap-1">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-[3px] bg-slate-100" />
              ))}
            </div>
          ) : (
            <HeatGrid
              cols={14}
              cells={risque.map((r) => ({
                key: r.p.isin,
                label: typeof r.wo === 'number' ? `${Math.round(r.wo)}` : '·',
                bg: heatColor(r.marge),
                fg: r.marge === null ? '#94a3b8' : '#1e293b',
                title: `${r.p.emetteur} · ${r.p.isin}\n${r.p.productType ?? r.p.nom}\nWorst-of ${typeof r.wo === 'number' ? r.wo.toFixed(1) + ' %' : 'n/c'} · barrière ${typeof r.prot === 'number' ? r.prot + ' %' : 'n/c'}${r.marge !== null ? ` · marge ${r.marge.toFixed(1)} pt` : ''}`,
              }))}
            />
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            {live ? `${risque.filter((r) => r.marge !== null).length} produits cotés · ` : ''}
            indices propriétaires, taux et crédit non cotés → cellules grises.
          </p>
        </Panel>

        <Panel title="Indicateurs de risque" className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <RadialStat
              value={live ? 1 - proches / Math.max(1, risque.length) : 0}
              centerTop={live ? `${risque.length - proches}` : '…'}
              centerSub="hors zone"
              color={proches > 0 ? '#f59e0b' : '#16a34a'}
            />
            <div className="min-w-0 flex-1 space-y-2 text-[13px]">
              <Stat k="Produits proches / sous barrière" v={live ? `${proches}` : '…'} warn={proches > 0} />
              <Stat k="Top émetteur" v={conc.topEmetteur ? `${conc.topEmetteur.label} · ${conc.topEmetteur.pct.toFixed(1)} %` : '—'} />
              <Stat k="Top sous-jacent" v={conc.topSousJacent ? `${conc.topSousJacent.nom} · ${conc.topSousJacent.pct.toFixed(1)} %` : '—'} />
              <Stat k="Concentration (HHI émetteur)" v={`${conc.hhiEmetteur}`} />
            </div>
          </div>

          <div className="mt-4">
            <div className="lc2-label mb-1.5 normal-case tracking-normal">Situation du livre (live)</div>
            <div className="flex h-3 overflow-hidden rounded-full border border-slate-200">
              {(Object.keys(situations) as Sit[]).map((s) =>
                situations[s].montant > 0 ? (
                  <div
                    key={s}
                    title={`${SIT_META[s].label} · ${situations[s].n} · ${eurCompact(situations[s].montant)}`}
                    style={{ width: `${(situations[s].montant / totalSitMontant) * 100}%`, background: SIT_META[s].color }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {(Object.keys(situations) as Sit[]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 text-slate-500">
                  <span className="h-2 w-2 rounded-sm" style={{ background: SIT_META[s].color }} />
                  {SIT_META[s].label} <span className="tabular-nums text-slate-700">{situations[s].n}</span>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Échéancier & clients ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Échéancier (maturity ladder)" sub="nominal arrivant à maturité par année">
          <BarList items={echeances.map((e) => ({ label: e.label, value: e.montant, pct: e.pct, sub: `${e.n}`, color: '#0ea5e9' }))} format={eurCompact} />
        </Panel>
        <Panel title="Allocation par client" sub="montants investis (feed)">
          <BarList items={clients.map((e, i) => ({ label: e.label, value: e.montant, pct: e.pct, sub: `${e.n}`, color: colorAt(i + 1) }))} format={eurCompact} />
        </Panel>
      </div>

      {/* ── Positions ──────────────────────────────────────────────────── */}
      <PositionsTable products={vivants} courant={courant} />
    </div>
  )
}

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1.5">
      <span className="text-slate-500">{k}</span>
      <span className={`shrink-0 text-right font-medium tabular-nums ${warn ? 'text-amber-600' : 'text-slate-800'}`}>{v}</span>
    </div>
  )
}

// ── Table des positions (tri client) ─────────────────────────────────────────
type SortKey = 'nominal' | 'pnl' | 'wo' | 'mat'
function PositionsTable({ products, courant }: { products: Product[]; courant: Record<string, number | null> | null }) {
  const [sort, setSort] = useState<{ k: SortKey; dir: number }>({ k: 'nominal', dir: -1 })
  const rows = useMemo(() => {
    const r = products.map((p) => {
      const wo = courant ? courant[p.isin] ?? null : null
      return { p, nom: eurNominal(p), prix: prixOf(p), pnl: pnlOf(p), wo, sit: sitLive(p, wo), mat: p.dateEcheance || '' }
    })
    const g = (x: (typeof r)[number]) =>
      sort.k === 'nominal' ? x.nom : sort.k === 'pnl' ? x.pnl : sort.k === 'wo' ? x.wo ?? -1e9 : x.mat
    return r.sort((a, b) => {
      const va = g(a)
      const vb = g(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sort.dir
      return String(va).localeCompare(String(vb)) * sort.dir
    })
  }, [products, courant, sort])
  const th = (k: SortKey, label: string) => (
    <th
      onClick={() => setSort((s) => ({ k, dir: s.k === k && s.dir === -1 ? 1 : -1 }))}
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right font-medium hover:text-slate-900"
    >
      {label}
      {sort.k === k ? (sort.dir === -1 ? ' ▼' : ' ▲') : ''}
    </th>
  )
  return (
    <Panel title="Positions" sub={`${rows.length} lignes vivantes · cliquer un en-tête pour trier`} className="p-0">
      <div className="max-h-[460px] overflow-auto rounded-b-xl border-t border-slate-100">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-white text-slate-500 shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ISIN</th>
              <th className="px-3 py-2 text-left font-medium">Émetteur</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              {th('nominal', 'Nominal')}
              <th className="px-3 py-2 text-right font-medium">Prix</th>
              {th('pnl', 'P&L')}
              {th('wo', 'Worst-of')}
              <th className="px-3 py-2 text-left font-medium">Situation</th>
              {th('mat', 'Échéance')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ p, nom, prix, pnl, wo, sit, mat }) => (
              <tr key={p.isin} className="hover:bg-orange-50/50">
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600">{p.isin}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{p.emetteur}</td>
                <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-500" title={p.nom}>{p.productType ?? p.family}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-800">{eurCompact(nom)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-600">{prix.toFixed(1)}</td>
                <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pct(pnl)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-600">{typeof wo === 'number' ? `${wo.toFixed(0)} %` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SIT_META[sit].color }} />
                    <span className="text-slate-500">{SIT_META[sit].label}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-500">{mat ? mat.slice(0, 7) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
