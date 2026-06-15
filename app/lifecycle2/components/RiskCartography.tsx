'use client'

import { useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import { computeRisks, NIVEAU_COLOR, type RiskItem } from '@/lib/cmf-risk'
import { eurCompact } from '@/lib/cmf-analytics'
import { Panel } from './charts'
import Modal from '@/app/lifecycle/components/Modal'

const yearsTo = (iso: string) => {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : (t - Date.now()) / (365.25 * 86_400_000)
}
const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean))).sort()

const ALL = '— Tous —'

export default function RiskCartography({
  products,
  courant,
}: {
  products: Product[]
  courant: Record<string, number | null> | null
}) {
  const [client, setClient] = useState(ALL)
  const [emetteur, setEmetteur] = useState(ALL)
  const [type, setType] = useState(ALL)
  const [maturite, setMaturite] = useState(ALL)
  const [categorie, setCategorie] = useState(ALL)
  const [sel, setSel] = useState<RiskItem | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const clientOpts = useMemo(() => uniq(products.flatMap((p) => p.clients ?? [])), [products])
  const emetteurOpts = useMemo(() => uniq(products.map((p) => p.emetteur)), [products])
  const typeOpts = useMemo(() => uniq(products.map((p) => p.productType ?? '')), [products])

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (client !== ALL && !(p.clients ?? []).includes(client)) return false
        if (emetteur !== ALL && p.emetteur !== emetteur) return false
        if (type !== ALL && (p.productType ?? '') !== type) return false
        if (maturite !== ALL) {
          const y = yearsTo(p.dateEcheance)
          if (maturite === '<2' && !(y < 2)) return false
          if (maturite === '2-5' && !(y >= 2 && y < 5)) return false
          if (maturite === '5-8' && !(y >= 5 && y < 8)) return false
          if (maturite === '>8' && !(y >= 8)) return false
        }
        return true
      }),
    [products, client, emetteur, type, maturite],
  )

  const risks = useMemo(() => computeRisks(filtered, courant), [filtered, courant])
  const categOpts = useMemo(() => uniq(risks.map((r) => r.categorie)), [risks])
  const shown = useMemo(() => (categorie === ALL ? risks : risks.filter((r) => r.categorie === categorie)), [risks, categorie])

  // ── Échelles du nuage de bulles ───────────────────────────────────────────
  const W = 360
  const H = 230
  const PADX = 38
  const PADY = 26
  const maxExpo = Math.max(20, Math.ceil(Math.max(0, ...shown.map((r) => r.exposition)) / 10) * 10)
  const xOf = (expo: number) => PADX + (expo / maxExpo) * (W - PADX - 12)
  const yOf = (sev: number) => H - PADY - (sev / 100) * (H - PADY - 12)
  const total = filtered.reduce((s, p) => s + (p.nominal || 0), 0) || 1
  const rOf = (montant: number) => Math.max(7, Math.min(26, Math.sqrt(montant / total) * 60))

  const sel0 = sel ? shown.find((r) => r.id === sel.id) ?? sel : null

  const Select = ({ label, value, set, opts, mapLabel }: { label: string; value: string; set: (v: string) => void; opts: { v: string; l: string }[]; mapLabel?: boolean }) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)} className="input py-1 text-[12px]">
        {opts.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  )
  const opt = (arr: string[]) => [{ v: ALL, l: ALL }, ...arr.map((x) => ({ v: x, l: x }))]

  return (
    <Panel
      title="Cartographie du risque"
      sub="chaque bulle = un indicateur · position = sévérité × exposition · taille = montant · clic = détail"
      className="lg:col-span-5"
      right={
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {(['faible', 'modéré', 'élevé', 'critique'] as const).map((n) => (
            <span key={n} className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: NIVEAU_COLOR[n] }} />
              {n}
            </span>
          ))}
        </div>
      }
    >
      {/* Filtres */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Select label="Client" value={client} set={setClient} opts={opt(clientOpts)} />
        <Select label="Émetteur" value={emetteur} set={setEmetteur} opts={opt(emetteurOpts)} />
        <Select label="Type produit" value={type} set={setType} opts={opt(typeOpts)} />
        <Select
          label="Maturité"
          value={maturite}
          set={setMaturite}
          opts={[{ v: ALL, l: ALL }, { v: '<2', l: '< 2 ans' }, { v: '2-5', l: '2–5 ans' }, { v: '5-8', l: '5–8 ans' }, { v: '>8', l: '> 8 ans' }]}
        />
        <Select label="Type de risque" value={categorie} set={setCategorie} opts={opt(categOpts)} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* Nuage de bulles */}
        <div className="lg:col-span-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
            {/* zone "haut risque" (sévérité haute + exposition haute) */}
            <rect x={xOf(maxExpo / 2)} y={yOf(100)} width={W - 12 - xOf(maxExpo / 2)} height={yOf(50) - yOf(100)} fill="#b42318" opacity="0.05" />
            {/* axes */}
            <line x1={PADX} y1={H - PADY} x2={W - 12} y2={H - PADY} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={PADX} y1={12} x2={PADX} y2={H - PADY} stroke="#cbd5e1" strokeWidth="1" />
            {[0, 25, 50, 75, 100].map((s) => (
              <g key={s}>
                <line x1={PADX - 3} y1={yOf(s)} x2={W - 12} y2={yOf(s)} stroke="#eef1f5" strokeWidth="1" />
                <text x={PADX - 6} y={yOf(s) + 3} textAnchor="end" fontSize="7" fill="#94a3b8">{s}</text>
              </g>
            ))}
            {[0, maxExpo / 2, maxExpo].map((e) => (
              <text key={e} x={xOf(e)} y={H - PADY + 11} textAnchor="middle" fontSize="7" fill="#94a3b8">{Math.round(e)}%</text>
            ))}
            <text x={(PADX + W) / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#64748b">Exposition (% du portefeuille)</text>
            <text x={10} y={(H - PADY) / 2} textAnchor="middle" fontSize="8" fill="#64748b" transform={`rotate(-90 10 ${(H - PADY) / 2})`}>Sévérité</text>

            {shown.map((r) => {
              const cx = xOf(r.exposition)
              const cy = yOf(r.severite)
              const on = hover === r.id
              return (
                <g key={r.id} className="cursor-pointer" onClick={() => setSel(r)} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
                  <circle cx={cx} cy={cy} r={rOf(r.montantExpose)} fill={NIVEAU_COLOR[r.niveau]} fillOpacity={on ? 0.85 : 0.6} stroke={NIVEAU_COLOR[r.niveau]} strokeWidth={on ? 2 : 1}>
                    <title>{`${r.nom}\n${r.categorie} · niveau ${r.niveau}\nExposition ${r.pctPortefeuille.toFixed(1)} % · ${eurCompact(r.montantExpose)}\nSévérité ${r.severite}/100 · clic pour le détail`}</title>
                  </circle>
                </g>
              )
            })}
          </svg>
          {hover && sel0?.id !== hover && (
            <div className="mt-1 text-[11px] text-slate-500">
              {(() => {
                const r = shown.find((x) => x.id === hover)
                return r ? `${r.nom} — ${r.niveau} · ${r.pctPortefeuille.toFixed(1)} % · ${eurCompact(r.montantExpose)}` : ''
              })()}
            </div>
          )}
          {shown.length === 0 && <p className="mt-2 text-[12px] text-slate-400">Aucun indicateur pour ces filtres.</p>}
        </div>

        {/* Liste cliquable des indicateurs */}
        <div className="lg:col-span-2">
          <div className="lc2-label mb-1.5 normal-case tracking-normal">Indicateurs ({shown.length})</div>
          <ul className="space-y-1">
            {shown.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSel(r)}
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover(null)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] ${hover === r.id ? 'border-slate-300 bg-slate-50' : 'border-slate-200'}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: NIVEAU_COLOR[r.niveau] }} />
                    <span className="truncate text-slate-700">{r.nom}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">{r.pctPortefeuille.toFixed(0)} %</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!courant && <p className="mt-2 text-[11px] text-slate-400">Niveaux temps réel en cours de chargement — le risque de barrière s’affine une fois les worst-of reçus.</p>}

      {/* Panneau détaillé */}
      <Modal open={!!sel0} onClose={() => setSel(null)} title={sel0 ? sel0.nom : ''}>
        {sel0 && <RiskDetail r={sel0} />}
      </Modal>
    </Panel>
  )
}

function RiskDetail({ r }: { r: RiskItem }) {
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ background: NIVEAU_COLOR[r.niveau] }}>
          {r.niveau.toUpperCase()}
        </span>
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">{r.categorie}</span>
        <span className="text-xs text-slate-400">Sévérité {r.severite}/100</span>
      </div>

      <p className="text-slate-600">{r.description}</p>

      <div className="grid grid-cols-3 gap-2">
        <Kpi k="Montant exposé" v={eurCompact(r.montantExpose)} />
        <Kpi k="% du portefeuille" v={`${r.pctPortefeuille.toFixed(1)} %`} />
        <Kpi k="Produits concernés" v={`${r.produits.length}`} />
      </div>

      <Section title="Facteurs de notation">
        <ul className="list-disc space-y-0.5 pl-4 text-slate-600">{r.facteurs.map((f, i) => <li key={i}>{f}</li>)}</ul>
      </Section>

      <Section title="Références de calcul">
        <ul className="list-disc space-y-0.5 pl-4 text-slate-500">{r.references.map((f, i) => <li key={i}>{f}</li>)}</ul>
      </Section>

      <Section title="Émetteurs concernés">
        <div className="flex flex-wrap gap-1">
          {r.emetteurs.map((e) => (
            <span key={e} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">{e}</span>
          ))}
        </div>
      </Section>

      <Section title={`Produits / positions concernés (${r.produits.length})`}>
        <div className="max-h-52 overflow-auto rounded-md border border-slate-100">
          <table className="w-full text-[12px]">
            <tbody className="divide-y divide-slate-50">
              {r.produits.map((p) => (
                <tr key={p.isin} className="hover:bg-slate-50">
                  <td className="px-2 py-1 text-slate-700">{p.nom}</td>
                  <td className="px-2 py-1 font-mono text-[11px] text-slate-400">{p.isin}</td>
                  <td className="px-2 py-1 text-slate-500">{p.emetteur}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-600">{eurCompact(p.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a href="/lifecycle2/portefeuille" className="mt-1.5 inline-block text-[12px] text-cmf-blue hover:underline">
          → Voir les positions dans le Portefeuille
        </a>
      </Section>

      <Section title="Évolution historique du risque">
        {r.historique.length > 0 ? (
          <div className="text-slate-600">{r.historique.map((h) => `${h.label}: ${h.value}`).join(' · ')}</div>
        ) : (
          <p className="text-[12px] text-slate-400">
            En cours de constitution — un instantané du niveau de risque sera enregistré à chaque rafraîchissement (pas de série historique stockée à ce jour).
          </p>
        )}
      </Section>
    </div>
  )
}

function Kpi({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{k}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-slate-800">{v}</div>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="lc2-label mb-1 normal-case tracking-normal">{title}</div>
      {children}
    </div>
  )
}
