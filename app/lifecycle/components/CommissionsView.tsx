'use client'

import { useMemo, useState } from 'react'
import type { CommissionsData, CommissionLigne } from '@/lib/commissions'
import { useCommissionsStore } from '@/lib/commissions-store'
import { useLocalCommissions, type LocalCommission } from '@/lib/local-commissions'
import Modal from './Modal'

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
// Date du jour (ISO) — pour signaler les émissions à venir.
const TODAY = new Date().toISOString().slice(0, 10)
// Année d'attribution : normalement l'année d'émission ; un deal émis une année
// antérieure mais ENCAISSÉ l'année courante (report ponctuel — ex. APPN/Santander,
// erreur de facturation) est rattaché à l'année courante.
const anneeAttr = (l: CommissionLigne) =>
  annee(l) !== ANNEE_COURANTE && (l.credited ?? '').startsWith(ANNEE_COURANTE)
    ? ANNEE_COURANTE
    : annee(l)

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
  const { ov, patch, reset, serverSync } = useCommissionsStore()
  // Commissions créées localement (depuis « Nouveau trade ») → fusionnées.
  // Celles-ci sont entièrement éditables / supprimables (elles t'appartiennent),
  // contrairement aux lignes du classeur (officielles, surcharges limitées).
  const { list: localCommissions, upsert, remove, replace } = useLocalCommissions()
  const lignesAll = useMemo(() => [...data.lignes, ...localCommissions], [data, localCommissions])
  // Clés des lignes locales — pour distinguer « tes trades » du classeur.
  const localKeys = useMemo(() => new Set(localCommissions.map((l) => rowKey(l))), [localCommissions])
  const nbSaisies = Object.keys(ov).length
  const [editFac, setEditFac] = useState<string | null>(null) // ligne dont le n° facture est en édition
  const [editLocal, setEditLocal] = useState<LocalCommission | null>(null) // commission locale en cours d'édition
  const [an, setAn] = useState<string>(ANNEE_COURANTE)
  const [statut, setStatut] = useState<StatutFacture>('toutes')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'issue', dir: 'desc' })

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
    const split = typeof l.split === 'number' ? l.split : 1
    // On ne RECALCULE que si UF/Rétro ont été saisis ; sinon on garde les montants
    // exacts du classeur (vérifiables ligne à ligne, sans erreur d'arrondi).
    const ovTaux = editable && (o.uf !== undefined || o.retro !== undefined)
    // Reversé CGP = nominal × Rétro.
    const comClient = ovTaux
      ? typeof n === 'number' && typeof retro === 'number'
        ? n * retro
        : 0
      : l.comClient ?? 0
    // Net Lolo = vrai net (après split). En saisie : (nominal·UF − Reversé CGP) × split.
    const net = ovTaux
      ? ((typeof n === 'number' && typeof uf === 'number' ? n * uf : 0) - comClient) * split
      : l.net ?? 0
    // Com. totale = Net Lolo + Reversé CGP (invariant garanti à l'affichage). Sur les
    // années clôturées on conserve la « com. totale » brute du classeur (qui peut
    // inclure une quote-part co-distributeur quand split < 100 %).
    const comTotal = editable ? net + comClient : l.comTotal ?? net + comClient
    // Surcharge année courante : `null` = valeur explicitement effacée (ex. paiement
    // annulé) ; `undefined` = pas de surcharge → on garde la valeur du classeur.
    const oCred = editable ? o.credited : undefined
    const credited = oCred === undefined ? l.credited : oCred ?? null
    // Override prioritaire en année courante (permet de modifier/effacer un n° du classeur).
    const oFac = editable ? o.facture : undefined
    const facture = (oFac === undefined ? l.facture : oFac) ?? null
    const fait = !!facture || (editable ? !!o.fait : false) || !!credited
    const isLocal = localKeys.has(rowKey(l))
    return { ...l, ufPct: uf, retroPct: retro, comTotal, comClient, net, credited, facture, factureClasseur: l.facture, fait, editable, split, isLocal }
  }

  // ── Paiement ───────────────────────────────────────────────────────────
  // « Payé » = il existe une date d'encaissement (credited). Le bouton bascule
  // simplement entre payé (aujourd'hui par défaut) et non payé. Pour une ligne
  // locale, l'état vit sur la commission elle-même ; pour une ligne du classeur,
  // dans les surcharges locales (ov).
  const setCredited = (l: ReturnType<typeof calc>, date: string | null) => {
    if (l.isLocal) {
      const base = localCommissions.find((x) => rowKey(x) === rowKey(l))
      if (base)
        upsert({
          ...base,
          credited: date,
          statutFacture: date ? 'payee' : base.facture ? 'envoyee' : 'en_attente',
        })
    } else {
      // `null` = surcharge « non payé » qui prime sur la date du classeur ;
      // une chaîne = date d'encaissement saisie. (undefined serait ignoré.)
      patch(rowKey(l), { credited: date })
    }
  }
  const togglePaid = (l: ReturnType<typeof calc>) =>
    setCredited(l, l.credited ? null : new Date().toISOString().slice(0, 10))

  // Supprime une commission locale (avec confirmation).
  const deleteLocal = (l: ReturnType<typeof calc>) => {
    if (window.confirm(`Supprimer la commission ${l.isin}${l.client ? ' — ' + l.client : ''} ?`))
      remove(l.isin, l.client)
  }

  const annees = useMemo(() => {
    const s = new Set(lignesAll.map(anneeAttr).filter((a) => a !== '—'))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [lignesAll])

  const filtered = useMemo(() => {
    let l = lignesAll.map(calc)
    if (an !== 'tous') l = l.filter((x) => anneeAttr(x) === an)
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
  }, [lignesAll, ov, an, statut, q, sort])

  const tot = useMemo(() => {
    const sum = (k: 'comClient' | 'comTotal' | 'net' | 'nominal') =>
      filtered.reduce((s, l) => s + (typeof l[k] === 'number' ? (l[k] as number) : 0), 0)
    return { net: sum('net'), retro: sum('comClient'), total: sum('comTotal'), nominal: sum('nominal') }
  }, [filtered])

  // Visuel trimestriel de l'année courante : une commission n'est « encaissée »
  // au trimestre QUE si elle a été payée (date d'encaissement) dans ce trimestre.
  const trim = useMemo(() => {
    const out = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
    // Vrai net. Deals de l'année → trimestre d'ÉMISSION (payés ou non) ; facture
    // d'année antérieure encaissée dans l'année → trimestre de PAIEMENT.
    for (const l of lignesAll.map(calc)) {
      const v = typeof l.net === 'number' ? l.net : 0
      if (annee(l) === ANNEE_COURANTE && l.issue) out[trimestre(l.issue) as 'Q1' | 'Q2' | 'Q3' | 'Q4'] += v
      else if ((l.credited ?? '').startsWith(ANNEE_COURANTE) && l.credited)
        out[trimestre(l.credited) as 'Q1' | 'Q2' | 'Q3' | 'Q4'] += v
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignesAll, ov])
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
      lignesAll
        .map(calc)
        .filter((l) => annee(l) === ANNEE_COURANTE || (l.credited ?? '').startsWith(ANNEE_COURANTE))
        .reduce((s, l) => s + (typeof l.net === 'number' ? l.net : 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lignesAll, ov],
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
        <span className="flex items-center gap-2 text-xs text-slate-400">
          {serverSync === true && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-600" title="Tes modifs (Payé, facture, UF/Rétro, trades) sont mémorisées côté serveur — sur tous tes appareils.">
              ✓ Sauvegarde serveur
            </span>
          )}
          {serverSync === false && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500" title="Aucun store KV connecté : tes modifs ne sont gardées que dans CE navigateur. Connecte un store KV dans Vercel pour la synchro multi-appareils.">
              navigateur seul
            </span>
          )}
          <span>classeur Lifecycle · MAJ {dateFr(data.majLe)}</span>
        </span>
      </div>

      {/* Cartes récap par année (chiffres officiels du classeur) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="field-label">Commissions Nettes · YTD {ANNEE_COURANTE}</div>
          <div className="text-2xl font-bold text-emerald-600">{EUR(netLoloYtd)}</div>
          <div className="text-[11px] text-slate-400">
            = somme des « Net Lolo » du tableau · classeur {EUR(ytdClasseur)}
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
        {nbSaisies > 0 && (
          <button
            onClick={() => reset()}
            className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
            title="Efface toutes les saisies locales (UF/Rétro/n° facture/date de paiement)"
          >
            Réinitialiser mes saisies ({nbSaisies})
          </button>
        )}
      </div>

      {/* Totaux du jeu filtré */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {[
          ['Net Lolo — lignes listées', EUR(tot.net), 'text-emerald-600'],
          ['Reversé CGP', EUR(tot.retro), 'text-orange-600'],
          ['Com. totale', EUR(tot.total), ''],
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
              <TH k="net" label="Net Lolo" num />
              <TH k="retroPct" label="Rétro" num />
              <TH k="comClient" label="Reversé CGP" num />
              <TH k="comTotal" label="Com. totale" num />
              <TH k="facture" label="Facture" />
              <TH k="credited" label="Payée" />
              <TH k="split" label="Split" num />
              <th className="px-2 py-1.5 font-medium text-center whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((l, i) => {
              // Non payé : commission émise (passée) sans date d'encaissement.
              const impaye = !l.credited && !!l.issue && l.issue <= TODAY
              return (
              <tr key={`${rowKey(l)}|${i}`} className={impaye ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-orange-50'}>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {dateFr(l.issue) ?? '—'}
                  {l.issue && l.issue > TODAY && (
                    <span className="ml-1.5 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-medium text-violet-700" title="Émission à venir">à venir</span>
                  )}
                  {anneeAttr(l) !== annee(l) && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700" title={`Émis en ${annee(l)}, encaissé en ${ANNEE_COURANTE} — report ponctuel`}>report {anneeAttr(l)}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap font-mono">{l.isin}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.client ?? '—'}</td>
                <td className={`px-2 py-1.5 whitespace-nowrap ${impaye ? 'font-semibold text-red-600' : ''}`}>{l.emetteur ?? '—'}</td>
                <td className="px-2 py-1.5 max-w-[220px] truncate" title={l.description ?? undefined}>{l.description ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.nominal, l.devise ?? 'EUR')}</td>
                {/* UF — éditable inline (classeur, année courante) ; les lignes
                    locales s'éditent via le crayon (➜ pas de double saisie). */}
                <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                  {l.editable && !l.isLocal ? (
                    <input key={`uf|${rowKey(l)}|${l.ufPct ?? ''}`} defaultValue={typeof l.ufPct === 'number' ? (l.ufPct * 100).toFixed(2) : ''} inputMode="decimal" placeholder="—" className={inputPct} title="Saisir l'UF total (%)" onBlur={(e) => patch(rowKey(l), { uf: parsePct(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : PCT2(l.ufPct)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap font-semibold text-emerald-700">{EUR(l.net)}</td>
                {/* Rétro — éditable inline (classeur, année courante). 0 ou absent → « — ». */}
                <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap">
                  {l.editable && !l.isLocal ? (
                    <input key={`re|${rowKey(l)}|${l.retroPct ?? ''}`} defaultValue={l.retroPct ? (l.retroPct * 100).toFixed(2) : ''} inputMode="decimal" placeholder="—" className={inputPct} title="Saisir la rétrocession (%)" onBlur={(e) => patch(rowKey(l), { retro: parsePct(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : l.retroPct ? PCT2(l.retroPct) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-orange-600">{l.comClient ? EUR(l.comClient) : <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.comTotal)}</td>
                {/* Facture : clic sur le n° pour l'ajouter/modifier (année courante).
                    Années clôturées = statique. */}
                <td className="px-2 py-1 whitespace-nowrap">
                  {!l.editable ? (
                    l.facture ?? <span className="text-slate-300">—</span>
                  ) : l.isLocal ? (
                    l.facture ? (
                      <span title="N° de facture (modifiable via le crayon)">{l.facture}</span>
                    ) : (
                      <a href={factureMailto(l)} className="inline-flex items-center gap-1 rounded border border-cmf-blue/40 bg-blue-50 px-1.5 py-0.5 font-medium text-cmf-blue hover:bg-blue-100" title="Ouvrir l’email de facture pré-rempli vers Gabrielle (office@cmf.finance)">✉ Facturer Gabrielle</a>
                    )
                  ) : editFac === rowKey(l) ? (
                    <input
                      autoFocus
                      type="text"
                      defaultValue={l.facture ?? ''}
                      placeholder="n° facture"
                      className="w-24 rounded border border-cmf-blue bg-white px-1 py-0.5 text-[11px] focus:outline-none"
                      onBlur={(e) => { patch(rowKey(l), { facture: e.target.value.trim() || undefined }); setEditFac(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditFac(null) }}
                    />
                  ) : l.facture ? (
                    <button onClick={() => setEditFac(rowKey(l))} className="hover:underline decoration-dotted" title="Cliquer pour modifier le n°">{l.facture}</button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <a href={factureMailto(l)} className="inline-flex items-center gap-1 rounded border border-cmf-blue/40 bg-blue-50 px-1.5 py-0.5 font-medium text-cmf-blue hover:bg-blue-100" title="Ouvrir l’email de facture pré-rempli vers Gabrielle (office@cmf.finance) — tu procèdes à l’envoi">✉ Facturer Gabrielle</a>
                      <button onClick={() => setEditFac(rowKey(l))} className="text-[11px] text-cmf-blue hover:underline" title="Saisir le n° de facture">+ n°</button>
                    </span>
                  )}
                </td>
                {/* Payée : bascule en un clic (année courante) ; sinon statique.
                    Vert « ✓ Payé » = encaissé ; rouge « ● Non payé » = à encaisser.
                    Quand c'est payé, on peut ajuster la date exacte à côté. */}
                <td className="px-1 py-1 whitespace-nowrap">
                  {l.editable ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => togglePaid(l)}
                        className={
                          l.credited
                            ? 'rounded px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200'
                            : 'rounded px-2 py-0.5 text-[11px] font-semibold text-red-700 bg-red-100 hover:bg-red-200'
                        }
                        title={l.credited ? 'Marquer NON payé' : 'Marquer payé (date du jour)'}
                      >
                        {l.credited ? '✓ Payé' : '● Non payé'}
                      </button>
                      {l.credited && (
                        <input
                          type="date"
                          value={l.credited}
                          onChange={(e) => setCredited(l, e.target.value || null)}
                          className="rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] hover:border-slate-300 focus:border-cmf-blue focus:bg-white focus:outline-none"
                          title="Date d'encaissement (paiement)"
                        />
                      )}
                    </span>
                  ) : l.credited ? (
                    <span className="text-emerald-600">{dateFr(l.credited)}</span>
                  ) : impaye ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">● Non payé</span>
                  ) : (
                    <span className="text-amber-600">en attente</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{typeof l.split === 'number' ? `${(l.split * 100).toFixed(0)} %` : '—'}</td>
                {/* Actions — édition / suppression réservées à TES trades (lignes locales). */}
                <td className="px-2 py-1 whitespace-nowrap text-center">
                  {l.isLocal ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setEditLocal(localCommissions.find((x) => rowKey(x) === rowKey(l)) ?? null)}
                        className="text-slate-400 hover:text-cmf-blue"
                        title="Modifier cette commission"
                      >
                        ✎
                      </button>
                      <button onClick={() => deleteLocal(l)} className="text-slate-400 hover:text-red-600" title="Supprimer cette commission">
                        ✕
                      </button>
                    </span>
                  ) : (
                    <span className="text-slate-200" title="Ligne du classeur (officielle)">·</span>
                  )}
                </td>
              </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={15} className="px-2 py-6 text-center text-slate-400">Aucune commission pour ce filtre.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Édition réservée à l&apos;année courante ({ANNEE_COURANTE}) : UF et Rétro saisis → Net Lolo
        (vrai net, base 250&nbsp;360), Reversé CGP et Com. totale recalculés depuis le nominal du
        ticket (Com. totale = Net Lolo + Reversé CGP). Les années précédentes sont clôturées
        (lecture seule). <strong>Tes trades</strong> (créés via « Nouveau trade ») se modifient (✎)
        et se suppriment (✕) directement. « Payé » se bascule en un clic. Saisies locales
        (navigateur), non versionnées.
      </p>

      {editLocal && (
        <LocalCommissionEditor
          ligne={editLocal}
          onClose={() => setEditLocal(null)}
          onSave={(next) => {
            // `replace` gère le renommage (ISIN/client modifié) en un seul passage.
            replace(editLocal.isin, editLocal.client, next)
            setEditLocal(null)
          }}
          onDelete={() => {
            remove(editLocal.isin, editLocal.client)
            setEditLocal(null)
          }}
        />
      )}
    </div>
  )
}

// ── Éditeur d'une commission locale (« ton » trade) ────────────────────────
// Tous les champs sont modifiables ; les montants (Com. totale / Reversé CGP /
// Net) sont recalculés depuis Nominal × UF / Rétro. « Payé » coche la date du
// jour (ajustable). Pas de double mécanisme : l'état vit sur la commission.
function LocalCommissionEditor({
  ligne,
  onClose,
  onSave,
  onDelete,
}: {
  ligne: LocalCommission
  onClose: () => void
  onSave: (next: LocalCommission) => void
  onDelete: () => void
}) {
  const [client, setClient] = useState(ligne.client ?? '')
  const [description, setDescription] = useState(ligne.description ?? '')
  const [emetteur, setEmetteur] = useState(ligne.emetteur ?? '')
  const [devise, setDevise] = useState(ligne.devise ?? 'EUR')
  const [nominal, setNominal] = useState(typeof ligne.nominal === 'number' ? String(ligne.nominal) : '')
  const [issue, setIssue] = useState(ligne.issue ?? '')
  const [uf, setUf] = useState(typeof ligne.ufPct === 'number' ? (ligne.ufPct * 100).toFixed(2) : '')
  const [retro, setRetro] = useState(ligne.retroPct ? (ligne.retroPct * 100).toFixed(2) : '')
  const [facture, setFacture] = useState(ligne.facture ?? '')
  const [paid, setPaid] = useState(!!ligne.credited)
  const [credited, setCreditedDate] = useState(ligne.credited ?? new Date().toISOString().slice(0, 10))

  // Aperçu en direct des montants recalculés.
  const toNum = (s: string) => {
    const v = parseFloat((s || '').replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(v) ? v : 0
  }
  const nNum = toNum(nominal)
  const ufDec = parsePct(uf) ?? 0
  const retroDec = parsePct(retro) ?? 0
  const comTotal = nNum * ufDec
  const comClient = nNum * retroDec
  const net = comTotal - comClient // split local = 1 (100 % LS)

  const submit = () => {
    if (!nominal.trim()) {
      alert('Renseigne le nominal.')
      return
    }
    const r2 = (x: number) => Math.round(x * 100) / 100
    const r6 = (x: number) => Math.round(x * 1e6) / 1e6
    const isPaid = paid && !!credited
    const next: LocalCommission = {
      ...ligne,
      client: client.trim() || null,
      description: description.trim() || null,
      emetteur: emetteur.trim() || null,
      devise: devise.trim() || 'EUR',
      nominal: nNum,
      issue: issue || null,
      ufPct: r6(ufDec),
      retroPct: r6(retroDec),
      comTotal: r2(comTotal),
      comClient: r2(comClient),
      net: r2(net),
      facture: facture.trim() || null,
      credited: isPaid ? credited : null,
      statutFacture: isPaid ? 'payee' : facture.trim() ? 'envoyee' : 'en_attente',
      histo: [
        ...(ligne.histo ?? []),
        { action: 'Modifié dans Commissions', date: new Date().toLocaleString('fr-FR'), user: 'Laurent' },
      ],
    }
    onSave(next)
  }

  const fieldCls = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-cmf-blue focus:outline-none'
  const lab = 'text-[11px] font-medium uppercase tracking-wide text-slate-500'

  return (
    <Modal open onClose={onClose} title="Modifier la commission">
      <div className="rounded-lg bg-white p-5 shadow-xl">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label className={lab}>ISIN</label>
            <input value={ligne.isin} readOnly className={`${fieldCls} bg-slate-50 font-mono text-slate-500`} title="L'ISIN identifie la ligne — non modifiable ici" />
          </div>
          <div>
            <label className={lab}>Client</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} className={fieldCls} placeholder="NOM - 00000" />
          </div>
          <div>
            <label className={lab}>Émetteur</label>
            <input value={emetteur} onChange={(e) => setEmetteur(e.target.value)} className={fieldCls} />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className={lab}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={lab}>Nominal</label>
            <input value={nominal} onChange={(e) => setNominal(e.target.value)} inputMode="numeric" className={`${fieldCls} text-right tabular-nums`} placeholder="200000" />
          </div>
          <div>
            <label className={lab}>Devise</label>
            <input value={devise} onChange={(e) => setDevise(e.target.value.toUpperCase())} className={fieldCls} />
          </div>
          <div>
            <label className={lab}>Date d&apos;émission</label>
            <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={lab}>UF %</label>
            <input value={uf} onChange={(e) => setUf(e.target.value)} inputMode="decimal" className={`${fieldCls} text-right tabular-nums`} placeholder="5.65" />
          </div>
          <div>
            <label className={lab}>Rétro %</label>
            <input value={retro} onChange={(e) => setRetro(e.target.value)} inputMode="decimal" className={`${fieldCls} text-right tabular-nums`} placeholder="4" />
          </div>
          <div>
            <label className={lab}>N° facture</label>
            <input value={facture} onChange={(e) => setFacture(e.target.value)} className={fieldCls} placeholder="(optionnel)" />
          </div>
        </div>

        {/* Aperçu des montants recalculés */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-sm">
          <div>
            <div className={lab}>Com. totale</div>
            <div className="font-semibold tabular-nums">{EUR(comTotal, devise)}</div>
          </div>
          <div>
            <div className={lab}>Reversé CGP</div>
            <div className="font-semibold tabular-nums text-orange-600">{EUR(comClient, devise)}</div>
          </div>
          <div>
            <div className={lab}>Net Lolo</div>
            <div className="font-semibold tabular-nums text-emerald-600">{EUR(net, devise)}</div>
          </div>
        </div>

        {/* Paiement */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
            Payé (encaissé)
          </label>
          {paid && (
            <input type="date" value={credited} onChange={(e) => setCreditedDate(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-cmf-blue focus:outline-none" />
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <button onClick={onDelete} className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
            Supprimer
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={submit} className="rounded-md bg-cmf-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0b1d36]">
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
