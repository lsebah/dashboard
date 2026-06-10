'use client'

import { useMemo, useState } from 'react'
import type { CommissionsData, CommissionLigne } from '@/lib/commissions'
import { useCommissionsStore } from '@/lib/commissions-store'

// Année en cours : seule éditable. Les précédentes sont clôturées (statiques).
const ANNEE_COURANTE = '2026'

const EUR = (n: number | null | undefined, devise = 'EUR') =>
  typeof n === 'number'
    ? n.toLocaleString('fr-FR', { style: 'currency', currency: devise, maximumFractionDigits: 0 })
    : '—'
const num = (n: number | null | undefined) =>
  typeof n === 'number' ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : ''
// UF / Rétro : toujours 2 décimales. 0.06 → « 6.00 % ».
const PCT2 = (n: number | null | undefined) =>
  typeof n === 'number' ? `${(n * 100).toFixed(2)} %` : '—'
const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : null
const annee = (l: CommissionLigne) => (l.issue ? l.issue.slice(0, 4) : '—')
const trimestre = (iso: string) => `Q${Math.floor(new Date(iso).getMonth() / 3) + 1}`

// Email « Nouvelle Facture » à Gabrielle Salmon (skill cmf-facture-gabrielle).
const GABRIELLE_EMAIL = 'office@cmf.finance'
const FACTURE_CC = 'p.doize@cmf.finance,t.ballot@cmf.finance'

// % saisi (« 6 », « 6,5 », « 6.00 ») → décimal (0.06 / 0.065).
const parsePct = (raw: string): number | undefined => {
  const v = parseFloat(raw.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(v) ? v / 100 : undefined
}

const rowKey = (l: CommissionLigne) => `${l.isin}|${l.client ?? ''}|${l.issue ?? ''}`

type StatutFacture = 'toutes' | 'a_facturer' | 'envoyee' | 'payee'

export default function CommissionsView({ data }: { data: CommissionsData }) {
  const { ov, patch } = useCommissionsStore()
  const [an, setAn] = useState<string>(ANNEE_COURANTE)
  const [statut, setStatut] = useState<StatutFacture>('toutes')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'issue', dir: 'asc' })

  // Ligne « calculée » : applique les surcharges locales (UF/Rétro saisis → on
  // recalcule Com. totale, Reversé CGP, Perçue CMF et P&L depuis le nominal ;
  // date de paiement et marquage facturé manuels). Édition réservée à l'année
  // courante (comptes des années précédentes clôturés).
  const calc = (l: CommissionLigne) => {
    const o = ov[rowKey(l)] ?? {}
    const editable = annee(l) === ANNEE_COURANTE
    const uf = editable ? o.uf ?? l.ufPct : l.ufPct
    const retro = editable ? o.retro ?? l.retroPct : l.retroPct
    const n = l.nominal
    // On ne RECALCULE que si UF/Rétro ont été saisis ; sinon on garde les montants
    // exacts du classeur (vérifiables ligne à ligne, sans erreur d'arrondi).
    const ovTaux = editable && (o.uf !== undefined || o.retro !== undefined)
    const comTotal = ovTaux && typeof n === 'number' && typeof uf === 'number' ? n * uf : l.comTotal
    const comClient = ovTaux && typeof n === 'number' && typeof retro === 'number' ? n * retro : l.comClient
    const comCmf =
      ovTaux && typeof comTotal === 'number' && typeof comClient === 'number' ? comTotal - comClient : l.comCmf
    const net = ovTaux && typeof comCmf === 'number' && typeof l.split === 'number' ? comCmf * l.split : l.net
    const credited = (editable ? o.credited : undefined) ?? l.credited
    const fait = (editable ? o.fait : false) || !!l.facture || !!credited
    return { ...l, ufPct: uf, retroPct: retro, comTotal, comClient, comCmf, net, credited, fait, editable }
  }

  const annees = useMemo(() => {
    const s = new Set(data.lignes.map(annee).filter((a) => a !== '—'))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [data.lignes])

  const filtered = useMemo(() => {
    let l = data.lignes.map(calc)
    if (an !== 'tous') l = l.filter((x) => annee(x) === an)
    if (statut === 'a_facturer') l = l.filter((x) => !x.fait)
    if (statut === 'envoyee') l = l.filter((x) => x.fait && !x.credited)
    if (statut === 'payee') l = l.filter((x) => x.credited)
    const needle = q.trim().toLowerCase()
    if (needle)
      l = l.filter((x) =>
        [x.isin, x.client, x.emetteur, x.description, x.facture].some((s) =>
          (s ?? '').toLowerCase().includes(needle),
        ),
      )
    const m = sort.dir === 'asc' ? 1 : -1
    const get = (x: ReturnType<typeof calc>) => (x as unknown as Record<string, unknown>)[sort.key]
    return [...l].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m
      return String(va).localeCompare(String(vb), 'fr') * m
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lignes, ov, an, statut, q, sort])

  const tot = useMemo(() => {
    const sum = (k: 'comCmf' | 'comClient' | 'comTotal' | 'net' | 'nominal') =>
      filtered.reduce((s, l) => s + (typeof l[k] === 'number' ? (l[k] as number) : 0), 0)
    return { perçue: sum('comCmf'), retro: sum('comClient'), total: sum('comTotal'), net: sum('net'), nominal: sum('nominal') }
  }, [filtered])

  // Visuel trimestriel de l'année courante : une commission n'est « encaissée »
  // au trimestre QUE si elle a été payée (date d'encaissement) dans ce trimestre.
  const trim = useMemo(() => {
    const out = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
    for (const l of data.lignes.map(calc)) {
      const v = typeof l.comCmf === 'number' ? l.comCmf : 0
      // Deals de l'année → trimestre d'ÉMISSION ; facture d'année antérieure
      // encaissée dans l'année → trimestre de PAIEMENT (ex. Santander 2025→26).
      if (annee(l) === ANNEE_COURANTE && l.issue) out[trimestre(l.issue) as 'Q1' | 'Q2' | 'Q3' | 'Q4'] += v
      else if ((l.credited ?? '').startsWith(ANNEE_COURANTE) && l.credited)
        out[trimestre(l.credited) as 'Q1' | 'Q2' | 'Q3' | 'Q4'] += v
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lignes, ov])
  const trimMax = Math.max(trim.Q1, trim.Q2, trim.Q3, trim.Q4, 1)
  const trimTotal = trim.Q1 + trim.Q2 + trim.Q3 + trim.Q4

  const toggleSort = (key: string) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  const factureMailto = (l: ReturnType<typeof calc>): string => {
    const d = dateFr(l.issue) ?? ''
    const lignes = [
      'Hello Gabrielle,',
      '',
      'Peux-tu éditer la facture suivante',
      '',
      `Émetteur\t${l.emetteur ?? ''}`,
      `ISIN\t\t${l.isin}`,
      `Trade Date\t${d}`,
      `Issue Date\t${d}`,
      `Payoff\t\t${l.description ?? ''}`,
      `Nominal\t\tEUR ${num(l.nominal)}`,
      `Upfront\t\t${PCT2(l.ufPct)}  —  EUR ${num(l.comTotal)}`,
    ]
    if (typeof l.comClient === 'number' && l.comClient > 0 && l.client)
      lignes.push('', `Dès règlement reçu, merci de reverser EUR ${num(l.comClient)} à ${l.client}.`)
    lignes.push('', 'Merci')
    const p = new URLSearchParams()
    p.set('cc', FACTURE_CC)
    p.set('subject', `Nouvelle Facture ${l.emetteur ?? ''}`.trim())
    p.set('body', lignes.join('\n'))
    return `mailto:${GABRIELLE_EMAIL}?${p.toString()}`
  }

  // Commissions Nettes (vrai net) de l'année courante = toutes les commissions
  // ATTRIBUÉES à l'année : émises dans l'année OU émises avant mais ENCAISSÉES
  // dans l'année (ex. Santander émis 2025 payé 2026). Vivant (réagit aux saisies).
  const netLoloYtd = useMemo(
    () =>
      data.lignes
        .map(calc)
        .filter((l) => annee(l) === ANNEE_COURANTE || (l.credited ?? '').startsWith(ANNEE_COURANTE))
        .reduce((s, l) => s + (typeof l.comCmf === 'number' ? l.comCmf : 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.lignes, ov],
  )
  const ytdClasseur = data.commissionsNettesParAnnee[ANNEE_COURANTE] ?? 0
  const inputPct = 'w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums hover:border-slate-300 focus:border-cmf-blue focus:bg-white focus:outline-none'

  const TH = ({ k, label, num: n }: { k: string; label: string; num?: boolean }) => (
    <th onClick={() => toggleSort(k)} className={`px-2 py-1.5 font-medium cursor-pointer whitespace-nowrap ${n ? 'text-right' : 'text-left'}`} title="Trier">
      {label}{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-cmf-navy">Commissions</h1>
        <span className="text-xs text-slate-400">classeur Lifecycle · MAJ {dateFr(data.majLe)}</span>
      </div>

      {/* Cartes récap par année (chiffres officiels du classeur) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="field-label">Net Lolo · YTD {ANNEE_COURANTE}</div>
          <div className="text-2xl font-bold text-emerald-600">{EUR(netLoloYtd)}</div>
          <div className="text-[11px] text-slate-400">
            {data.dealsParAnnee[ANNEE_COURANTE]} deals émis · classeur {EUR(ytdClasseur)}
          </div>
        </div>
        {['2025', '2024', '2023'].map((y) => (
          <div key={y} className="card p-4">
            <div className="field-label">Commissions Nettes · {y} <span className="text-slate-300">(clôturé)</span></div>
            <div className="text-2xl font-bold text-slate-700">{EUR(data.commissionsNettesParAnnee[y])}</div>
            <div className="text-[11px] text-slate-400">{data.dealsParAnnee[y]} deals</div>
          </div>
        ))}
      </div>

      {/* Visuel trimestriel — encaissé (date de paiement) sur l'année courante */}
      <div className="card p-4">
        <div className="field-label mb-2 flex items-center justify-between">
          <span>Commissions Nettes par trimestre · {ANNEE_COURANTE}</span>
          <span className="text-[12px] normal-case text-slate-500">total {EUR(trimTotal)}</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((Q) => (
            <div key={Q}>
              <div className="flex items-end justify-between text-[12px]">
                <span className="font-medium text-slate-600">{Q}</span>
                <span className="tabular-nums text-slate-700">{EUR(trim[Q])}</span>
              </div>
              <div className="mt-1 h-2 rounded bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(trim[Q] / trimMax) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Attribuée au <strong>trimestre d&apos;émission</strong> ; une facture d&apos;année
          antérieure <strong>encaissée</strong> dans l&apos;année courante compte à son trimestre de
          paiement (ex. Santander émis 2025, payé 2026).
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
          {['tous', ...annees].map((y) => (
            <button key={y} onClick={() => setAn(y)} className={`px-3 py-1.5 ${an === y ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}>
              {y === 'tous' ? 'Tous' : y}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
          {([['toutes', 'Toutes'], ['a_facturer', 'À facturer'], ['envoyee', 'Envoyée'], ['payee', 'Payée']] as [StatutFacture, string][]).map(([v, lab]) => (
            <button key={v} onClick={() => setStatut(v)} className={`px-3 py-1.5 ${statut === v ? 'bg-cmf-blue text-white' : 'bg-white text-slate-600'}`}>{lab}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (ISIN, client, émetteur, facture…)" className="input w-[280px]" />
      </div>

      {/* Totaux du jeu filtré */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
        {[
          ['Net Lolo', EUR(tot.perçue), ''],
          ['Reversé CGP', EUR(tot.retro), 'text-orange-600'],
          ['Com. totale', EUR(tot.total), ''],
          ['P&L — lignes listées', EUR(tot.net), 'text-emerald-600'],
          ['Nominal placé', EUR(tot.nominal), ''],
        ].map(([lab, val, cls]) => (
          <div key={lab} className="rounded-md bg-slate-50 border border-slate-200 p-2">
            <div className="field-label">{lab}</div>
            <div className={`font-semibold tabular-nums ${cls}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Table détail */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-slate-500 sticky top-0">
            <tr>
              <TH k="issue" label="Émission" />
              <TH k="isin" label="ISIN" />
              <TH k="client" label="Client" />
              <TH k="emetteur" label="Émetteur" />
              <TH k="description" label="Description" />
              <TH k="nominal" label="Nominal" num />
              <TH k="ufPct" label="UF" num />
              <TH k="comCmf" label="Net Lolo" num />
              <TH k="retroPct" label="Rétro" num />
              <TH k="comClient" label="Reversé CGP" num />
              <TH k="comTotal" label="Com. totale" num />
              <TH k="facture" label="Facture" />
              <TH k="credited" label="Payée" />
              <TH k="split" label="Split" num />
              <TH k="net" label="P&L" num />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((l, i) => (
              <tr key={`${rowKey(l)}|${i}`} className="hover:bg-orange-50">
                <td className="px-2 py-1.5 whitespace-nowrap">{dateFr(l.issue) ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap font-mono">{l.isin}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.client ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.emetteur ?? '—'}</td>
                <td className="px-2 py-1.5 max-w-[220px] truncate" title={l.description ?? undefined}>{l.description ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.nominal, l.devise ?? 'EUR')}</td>
                {/* UF — éditable (année courante) */}
                <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                  {l.editable ? (
                    <input key={`uf|${rowKey(l)}|${l.ufPct ?? ''}`} defaultValue={typeof l.ufPct === 'number' ? (l.ufPct * 100).toFixed(2) : ''} inputMode="decimal" placeholder="—" className={inputPct} title="Saisir l'UF total (%)" onBlur={(e) => patch(rowKey(l), { uf: parsePct(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : PCT2(l.ufPct)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.comCmf)}</td>
                {/* Rétro — éditable (année courante) */}
                <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                  {l.editable ? (
                    <input key={`re|${rowKey(l)}|${l.retroPct ?? ''}`} defaultValue={typeof l.retroPct === 'number' ? (l.retroPct * 100).toFixed(2) : ''} inputMode="decimal" placeholder="—" className={inputPct} title="Saisir la rétrocession (%)" onBlur={(e) => patch(rowKey(l), { retro: parsePct(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : PCT2(l.retroPct)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-orange-600">{EUR(l.comClient)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.comTotal)}</td>
                {/* Facture : n° si connu, sinon bouton ✉ + case « fait » (année courante) */}
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {l.facture ? (
                    l.facture
                  ) : l.editable ? (
                    <span className="inline-flex items-center gap-1.5">
                      <a href={factureMailto(l)} className="inline-flex items-center gap-1 rounded border border-cmf-blue/40 bg-blue-50 px-1.5 py-0.5 text-cmf-blue hover:bg-blue-100" title="Ouvrir l’email de facture (Gabrielle) — tu procèdes à l’envoi">✉ Facturer</a>
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-500" title="Marquer facturé (envoyé par un autre canal)">
                        <input type="checkbox" checked={!!ov[rowKey(l)]?.fait} onChange={(e) => patch(rowKey(l), { fait: e.target.checked || undefined })} />
                        fait
                      </label>
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Payée : date éditable (année courante), sinon statique */}
                <td className="px-1 py-1 whitespace-nowrap">
                  {l.editable ? (
                    <input type="date" defaultValue={l.credited ?? ''} className="rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] hover:border-slate-300 focus:border-cmf-blue focus:bg-white focus:outline-none" title="Date d'encaissement (paiement)" onChange={(e) => patch(rowKey(l), { credited: e.target.value || undefined })} />
                  ) : l.credited ? (
                    <span className="text-emerald-600">{dateFr(l.credited)}</span>
                  ) : (
                    <span className="text-amber-600">en attente</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{typeof l.split === 'number' ? `${(l.split * 100).toFixed(0)} %` : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap font-semibold">{EUR(l.net)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={15} className="px-2 py-6 text-center text-slate-400">Aucune commission pour ce filtre.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Édition réservée à l&apos;année courante ({ANNEE_COURANTE}) : UF et Rétro saisis → Perçue
        (CMF), Reversé CGP et P&amp;L recalculés depuis le nominal du ticket. Les années précédentes
        sont clôturées (lecture seule). Saisies locales (navigateur), non versionnées.
      </p>
    </div>
  )
}
