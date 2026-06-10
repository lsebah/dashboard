'use client'

import { useMemo, useState } from 'react'
import type { CommissionsData, CommissionLigne } from '@/lib/commissions'

const EUR = (n: number | null | undefined, devise = 'EUR') =>
  typeof n === 'number'
    ? n.toLocaleString('fr-FR', { style: 'currency', currency: devise, maximumFractionDigits: 0 })
    : '—'
// Pourcentage avec 2 décimales MAX (zéros superflus retirés) : 0.06 → « 6 % »,
// 0.0392 → « 3.92 % », 0.039999 → « 4 % ».
const PCT = (n: number | null | undefined) =>
  typeof n === 'number' ? `${parseFloat((n * 100).toFixed(2))} %` : '—'
const dateFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : null
const annee = (l: CommissionLigne) => (l.issue ? l.issue.slice(0, 4) : '—')

// Email « Nouvelle Facture » à Gabrielle Salmon (skill cmf-facture-gabrielle).
// Destinataire = office@cmf.finance ; CC systématique Pierre Doize + Thomas Ballot
// (emails déduits de la convention CMF prenom-initiale.nom@cmf.finance).
const GABRIELLE_EMAIL = 'office@cmf.finance'
const FACTURE_CC = 'p.doize@cmf.finance,t.ballot@cmf.finance'
const num = (n: number | null | undefined) =>
  typeof n === 'number' ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : ''

type StatutFacture = 'toutes' | 'a_facturer' | 'envoyee' | 'payee'

export default function CommissionsView({ data }: { data: CommissionsData }) {
  const [an, setAn] = useState<string>('2026')
  const [statut, setStatut] = useState<StatutFacture>('toutes')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: keyof CommissionLigne; dir: 'asc' | 'desc' }>({
    key: 'issue',
    dir: 'desc',
  })

  const annees = useMemo(() => {
    const s = new Set(data.lignes.map(annee).filter((a) => a !== '—'))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [data.lignes])

  const filtered = useMemo(() => {
    let l = data.lignes
    if (an !== 'tous') l = l.filter((x) => annee(x) === an)
    if (statut === 'a_facturer') l = l.filter((x) => !x.facture)
    if (statut === 'envoyee') l = l.filter((x) => x.sent && !x.credited)
    if (statut === 'payee') l = l.filter((x) => x.credited)
    const needle = q.trim().toLowerCase()
    if (needle)
      l = l.filter((x) =>
        [x.isin, x.client, x.emetteur, x.description, x.facture].some((s) =>
          (s ?? '').toLowerCase().includes(needle),
        ),
      )
    const m = sort.dir === 'asc' ? 1 : -1
    return [...l].sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m
      return String(va).localeCompare(String(vb), 'fr') * m
    })
  }, [data.lignes, an, statut, q, sort])

  // Totaux du jeu filtré.
  const tot = useMemo(() => {
    const sum = (k: keyof CommissionLigne) =>
      filtered.reduce((s, l) => s + (typeof l[k] === 'number' ? (l[k] as number) : 0), 0)
    return {
      perçue: sum('comCmf'),
      retro: sum('comClient'),
      total: sum('comTotal'),
      net: sum('net'),
      nominal: sum('nominal'),
    }
  }, [filtered])

  const ytd = data.commissionsNettesParAnnee['2026'] ?? 0
  const dealsYtd = data.dealsParAnnee['2026'] ?? 0

  const toggleSort = (key: keyof CommissionLigne) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  // Lien mailto pré-rempli pour facturer un deal sans facture. La facture part
  // vers Gabrielle Salmon (qui l'édite pour l'émetteur) — c'est Laurent qui
  // procède à l'envoi. Le destinataire et le format exact viennent du « skill
  // facture » (à brancher) ; ce corps est un brouillon reprenant les éléments du
  // deal en attendant.
  const factureMailto = (l: CommissionLigne): string => {
    const d = dateFr(l.issue) ?? ''
    // Montant facturé à l'émetteur = Invoice % (UF total) × Nominal = COM TOTAL.
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
      `Upfront\t\t${PCT(l.ufPct)}  —  EUR ${num(l.comTotal)}`,
    ]
    // Reversement éventuel au cabinet partenaire (rétrocession connue dans la base).
    if (typeof l.comClient === 'number' && l.comClient > 0 && l.client)
      lignes.push('', `Dès règlement reçu, merci de reverser EUR ${num(l.comClient)} à ${l.client}.`)
    lignes.push('', 'Merci')
    const p = new URLSearchParams()
    p.set('cc', FACTURE_CC)
    p.set('subject', `Nouvelle Facture ${l.emetteur ?? ''}`.trim())
    p.set('body', lignes.join('\n'))
    return `mailto:${GABRIELLE_EMAIL}?${p.toString()}`
  }

  const COLS: { key: keyof CommissionLigne; label: string; num?: boolean; render?: (l: CommissionLigne) => React.ReactNode }[] = [
    { key: 'issue', label: 'Émission', render: (l) => dateFr(l.issue) ?? '—' },
    { key: 'isin', label: 'ISIN' },
    { key: 'client', label: 'Client' },
    { key: 'emetteur', label: 'Émetteur' },
    { key: 'description', label: 'Description' },
    { key: 'nominal', label: 'Nominal', num: true, render: (l) => EUR(l.nominal, l.devise ?? 'EUR') },
    { key: 'ufPct', label: 'UF', num: true, render: (l) => PCT(l.ufPct) },
    { key: 'comCmf', label: 'Perçue (CMF)', num: true, render: (l) => EUR(l.comCmf) },
    { key: 'retroPct', label: 'Rétro', num: true, render: (l) => PCT(l.retroPct) },
    { key: 'comClient', label: 'Reversé CGP', num: true, render: (l) => EUR(l.comClient) },
    { key: 'comTotal', label: 'Com. totale', num: true, render: (l) => EUR(l.comTotal) },
    {
      key: 'facture',
      label: 'Facture',
      render: (l) =>
        l.facture ? (
          l.facture
        ) : (
          <a
            href={factureMailto(l)}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded border border-cmf-blue/40 bg-blue-50 px-1.5 py-0.5 text-cmf-blue hover:bg-blue-100"
            title="Ouvrir l’email de facture (à éditer par Gabrielle pour l’émetteur) — tu procèdes à l’envoi"
          >
            ✉ Facturer
          </a>
        ),
    },
    { key: 'sent', label: 'Envoyée', render: (l) => dateFr(l.sent) ?? <span className="text-slate-300">—</span> },
    { key: 'credited', label: 'Payée', render: (l) => (l.credited ? <span className="text-emerald-600">{dateFr(l.credited)}</span> : <span className="text-amber-600">en attente</span>) },
    { key: 'split', label: 'Split', num: true, render: (l) => (typeof l.split === 'number' ? `${(l.split * 100).toFixed(0)} %` : '—') },
    { key: 'net', label: 'Net (LS)', num: true, render: (l) => <span className="font-semibold">{EUR(l.net)}</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-cmf-navy">Commissions</h1>
        <span className="text-xs text-slate-400">classeur Lifecycle · MAJ {dateFr(data.majLe)}</span>
      </div>

      {/* Cartes récap (chiffres officiels du classeur) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="field-label">Commissions Nettes · YTD 2026</div>
          <div className="text-2xl font-bold text-emerald-600">{EUR(ytd)}</div>
          <div className="text-[11px] text-slate-400">{dealsYtd} deals · Q1 {EUR(data.trimestre2026.Q1)} · Q2 {EUR(data.trimestre2026.Q2)}</div>
        </div>
        {['2025', '2024', '2023'].map((y) => (
          <div key={y} className="card p-4">
            <div className="field-label">Commissions Nettes · {y}</div>
            <div className="text-2xl font-bold text-slate-700">{EUR(data.commissionsNettesParAnnee[y])}</div>
            <div className="text-[11px] text-slate-400">{data.dealsParAnnee[y]} deals</div>
          </div>
        ))}
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
          {['tous', ...annees].map((y) => (
            <button
              key={y}
              onClick={() => setAn(y)}
              className={`px-3 py-1.5 ${an === y ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
            >
              {y === 'tous' ? 'Tous' : y}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
          {([
            ['toutes', 'Toutes'],
            ['a_facturer', 'À facturer'],
            ['envoyee', 'Envoyée'],
            ['payee', 'Payée'],
          ] as [StatutFacture, string][]).map(([v, lab]) => (
            <button
              key={v}
              onClick={() => setStatut(v)}
              className={`px-3 py-1.5 ${statut === v ? 'bg-cmf-blue text-white' : 'bg-white text-slate-600'}`}
            >
              {lab}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (ISIN, client, émetteur, facture…)"
          className="input w-[280px]"
        />
      </div>

      {/* Bandeau totaux du jeu filtré */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
          <div className="field-label">Perçue (CMF)</div>
          <div className="font-semibold tabular-nums">{EUR(tot.perçue)}</div>
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
          <div className="field-label">Reversé CGP</div>
          <div className="font-semibold tabular-nums text-orange-600">{EUR(tot.retro)}</div>
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
          <div className="field-label">Com. totale</div>
          <div className="font-semibold tabular-nums">{EUR(tot.total)}</div>
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
          <div className="field-label">Net (LS) — lignes listées</div>
          <div className="font-semibold tabular-nums text-emerald-600">{EUR(tot.net)}</div>
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
          <div className="field-label">Nominal placé</div>
          <div className="font-semibold tabular-nums">{EUR(tot.nominal)}</div>
        </div>
      </div>

      {/* Table détail */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-slate-500 sticky top-0">
            <tr>
              {COLS.map((c) => (
                <th
                  key={String(c.key)}
                  onClick={() => toggleSort(c.key)}
                  className={`px-2 py-1.5 font-medium cursor-pointer whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}
                  title="Trier"
                >
                  {c.label}
                  {sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((l, i) => (
              <tr key={`${l.isin}|${l.facture ?? i}`} className="hover:bg-orange-50">
                {COLS.map((c) => (
                  <td
                    key={String(c.key)}
                    className={`px-2 py-1.5 whitespace-nowrap ${c.num ? 'text-right tabular-nums' : ''} ${
                      c.key === 'description' ? 'max-w-[240px] truncate' : ''
                    }`}
                    title={c.key === 'description' ? l.description ?? undefined : undefined}
                  >
                    {c.render ? c.render(l) : ((l[c.key] as string | number | null) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-2 py-6 text-center text-slate-400">
                  Aucune commission pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Le hero « Commissions Nettes » reprend les totaux annuels officiels du classeur (onglet
        Backlog / Revenue Par Année). Le total « Net (LS) » ci-dessus est la somme des lignes
        listées (positions encore présentes dans l&apos;onglet Lifecycle) ; il peut être
        légèrement inférieur au total annuel, qui inclut aussi des deals déjà clôturés sortis de
        la liste.
      </p>
    </div>
  )
}
