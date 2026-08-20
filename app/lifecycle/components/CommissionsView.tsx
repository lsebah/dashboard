'use client'

import { useMemo, useState } from 'react'
import type { CommissionsData, CommissionLigne } from '@/lib/commissions'
import { ligneKey, ligneKeyLegacy, clesLegacyAmbigues, doublonsRegistreLocal } from '@/lib/commissions'
import { useCommissionsStore } from '@/lib/commissions-store'
import { useLocalCommissions, type LocalCommission } from '@/lib/local-commissions'
import type { LigneAFacturer } from '@/lib/facturation'
import { useAllocations } from '@/lib/allocations'
import { factureMailto as buildFactureMailto } from '@/lib/facture'
import Modal from './Modal'
import { IsinLink } from './FicheProduit'
import { dateFr as dateIso } from '@/lib/dates'
import { codeEmetteur } from '@/lib/emetteurs'
import { pourcent } from '@/lib/pourcentage'

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
  typeof n === 'number' ? pourcent(n * 100, 2) : '—'
const dateFr = (iso: string | null | undefined) => (iso ? dateIso(iso) : null)
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

// % saisi (« 6 », « 6,5 », « 6.00 ») → décimal (0.06 / 0.065).
const parsePct = (raw: string): number | undefined => {
  const v = parseFloat(raw.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(v) ? v / 100 : undefined
}

const rowKey = ligneKey

type StatutFacture = 'toutes' | 'sans_ligne' | 'a_facturer' | 'envoyee' | 'payee'

export default function CommissionsView({
  data,
  aFacturer = [],
}: {
  data: CommissionsData
  /**
   * Tickets clients d'un deal qui n'ont AUCUNE ligne au registre — construits
   * à partir de l'ISIN, du client et du nominal réels (cf. lib/facturation.ts).
   * Tout ce qui relève de la facturation y est vide : ce sont précisément les
   * lignes qu'il reste à établir. Elles pèsent donc zéro dans tous les totaux.
   */
  aFacturer?: LigneAFacturer[]
}) {
  const { ov, patch, reset, restore, backup, serverSync } = useCommissionsStore()
  // Commissions créées localement (depuis « Nouveau trade ») → fusionnées.
  // Celles-ci sont entièrement éditables / supprimables (elles t'appartiennent),
  // contrairement aux lignes du classeur (officielles, surcharges limitées).
  const { list: localCommissions, upsert, remove, replace } = useLocalCommissions()
  // Noms d'affichage renommés manuellement (par ISIN) dans le Portefeuille →
  // on les applique aussi ici pour que la description suive le renommage.
  const { noms } = useAllocations()
  // Les lignes à établir sont calculées côté serveur, qui ne voit QUE le
  // registre versionné. Un deal facturé par un ticket saisi dans Lifecycle
  // (KV, invisible du serveur) en ressortirait donc « à facturer » alors qu'il
  // l'est déjà — et la ligne apparaîtrait deux fois. On écarte ici tout ISIN
  // déjà porté par une facturation, d'où qu'elle vienne.
  const isinsFactures = useMemo(
    () => new Set([...data.lignes, ...localCommissions].map((l) => l.isin)),
    [data, localCommissions],
  )
  const aEtablir = useMemo(
    () => aFacturer.filter((l) => !isinsFactures.has(l.isin)),
    [aFacturer, isinsFactures],
  )
  // L'onglet repart de l'ISIN : au registre et aux saisies locales s'ajoutent
  // les deals dont RIEN n'est encore facturé. Sans eux, un trade fait mais non
  // encore facturé n'apparaissait nulle part — ni ligne, ni trou, ni rappel.
  const lignesAll = useMemo(
    () => [...data.lignes, ...localCommissions, ...aEtablir],
    [data, localCommissions, aEtablir],
  )
  // Clés des lignes à établir — elles ne sont ni du registre, ni des saisies.
  const clesAFacturer = useMemo(() => new Set(aEtablir.map((l) => rowKey(l))), [aEtablir])
  // Clés des lignes locales — pour distinguer « tes trades » du classeur.
  const localKeys = useMemo(() => new Set(localCommissions.map((l) => rowKey(l))), [localCommissions])
  // Anciennes clés que plusieurs lignes se partagent : leur surcharge n'est
  // attribuable à personne (cf. clesLegacyAmbigues).
  const legacyAmbigu = useMemo(() => clesLegacyAmbigues(lignesAll), [lignesAll])
  // Saisies locales qui font double emploi avec une ligne du registre : les
  // deux s'additionnent dans les totaux (cf. doublonsRegistreLocal).
  const doublons = useMemo(
    () => doublonsRegistreLocal(data.lignes, localCommissions),
    [data, localCommissions],
  )
  const nbSaisies = Object.keys(ov).length
  const nbRestaurables = Object.keys(backup).length
  // Ligne en cours d'édition (locale OU registre) — UNE seule mécanique.
  const [edit, setEdit] = useState<ReturnType<typeof calc> | null>(null)
  const [an, setAn] = useState<string>(ANNEE_COURANTE)
  const [statut, setStatut] = useState<StatutFacture>('toutes')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'issue', dir: 'desc' })

  // Ligne « calculée » : applique les surcharges locales (UF/Rétro saisis → on
  // recalcule Com. totale, Reversé CGP, Perçue CMF et P&L depuis le nominal ;
  // date de paiement et marquage facturé manuels). Édition ouverte à TOUTE ligne
  // rattachée à l'année courante (anneeAttr) — y compris un report émis une année
  // antérieure mais encaissé en 2026 —, quel que soit le filtre actif.
  const calc = (l: CommissionLigne) => {
    const isLocal = localKeys.has(rowKey(l))
    // Les surcharges ne concernent QUE les lignes du registre. Une ligne locale
    // porte ses propres valeurs, éditées via le crayon : lui appliquer une
    // surcharge ne peut être qu'un résidu, jamais une intention.
    //
    // Lecture : clé courante d'abord, ancienne clé ensuite — une saisie faite
    // avant l'ajout du nominal reste appliquée —, MAIS jamais une ancienne clé
    // ambiguë, qui recopierait la valeur d'une ligne sur sa voisine.
    // L'écriture, elle, est toujours en clé courante (patch(rowKey(l))).
    const kLegacy = ligneKeyLegacy(l)
    const oLegacy = legacyAmbigu.has(kLegacy) ? undefined : ov[kLegacy]
    const o = isLocal ? {} : (ov[rowKey(l)] ?? oLegacy ?? {})
    const editable = anneeAttr(l) === ANNEE_COURANTE
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
    // Renommage manuel (Portefeuille) prioritaire sur la description du classeur.
    const description = noms[l.isin] ?? l.description
    return { ...l, description, ufPct: uf, retroPct: retro, comTotal, comClient, net, credited, facture, factureClasseur: l.facture, fait, editable, split, isLocal, aFacturer: clesAFacturer.has(rowKey(l)) }
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
    // « Sans ligne » : le deal existe, sa facturation n'a jamais été établie.
    if (statut === 'sans_ligne') l = l.filter((x) => x.aFacturer)
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
  }, [lignesAll, ov, noms, an, statut, q, sort])

  // Lignes « à établir » présentes dans le jeu affiché — le total de nominal
  // les inclut, il faut donc pouvoir les compter.
  const nbAEtablir = useMemo(() => filtered.filter((l) => l.aFacturer).length, [filtered])

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

  // Gabarit partagé (lib/facture.ts) — évite qu'une correction faite ici (le
  // détail Rétro/Net, le bug d'encodage « + ») ne divergent d'une copie oubliée
  // ailleurs, comme c'était le cas jusqu'ici.
  const factureMailto = (l: ReturnType<typeof calc>): string => buildFactureMailto(l)

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
          <div className="text-[11px] text-slate-400">somme des « Net Lolo » {ANNEE_COURANTE}</div>
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
          {([['toutes', 'Toutes'], ['sans_ligne', 'Sans ligne'], ['a_facturer', 'À facturer'], ['envoyee', 'En attente'], ['payee', 'Payée']] as [StatutFacture, string][]).map(([v, lab]) => (
            <button key={v} onClick={() => setStatut(v)} className={`px-3 py-1.5 ${statut === v ? 'bg-cmf-blue text-white' : 'bg-white text-slate-600'}`}>{lab}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (ISIN, client, émetteur, facture…)" className="input w-[280px]" />
        {nbSaisies > 0 && (
          <button
            onClick={() => {
              // Un clic effaçait tout, sans question et sans retour possible.
              if (
                window.confirm(
                  `Effacer ${nbSaisies} saisie(s) — UF, rétro, n° de facture, dates de paiement ?\n\n` +
                    'Une copie est conservée : « Annuler la réinitialisation » les remettra.',
                )
              )
                reset()
            }}
            className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
            title="Efface toutes les saisies locales (UF/Rétro/n° facture/date de paiement) — annulable"
          >
            Réinitialiser mes saisies ({nbSaisies})
          </button>
        )}
        {/* Filet : tant que la copie existe, la réinitialisation est annulable. */}
        {nbRestaurables > 0 && (
          <button
            onClick={() => restore()}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            title="Remet les saisies effacées par la dernière réinitialisation"
          >
            ↩ Annuler la réinitialisation ({nbRestaurables})
          </button>
        )}
      </div>

      {doublons.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
          <strong>{doublons.length} saisie(s) locale(s) font double emploi avec le registre</strong> —
          même ISIN, même client, même date d&apos;émission et même nominal. Les deux lignes s&apos;additionnent
          dans les totaux : la commission est comptée deux fois. Supprime la saisie locale (✕) pour ne
          garder que la ligne du registre.
          <ul className="mt-1 space-y-0.5">
            {doublons.map((k) => (
              <li key={k} className="font-mono text-[11px]">{k.split('|').filter(Boolean).join(' · ')}</li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Le nominal ci-dessus inclut les deals dont la facturation reste à
          établir : leur commission est nulle, pas leur montant placé. Le dire
          évite de lire « Nominal placé » comme « nominal facturé ». */}
      {nbAEtablir > 0 && (
        <p className="text-[11px] text-sky-700">
          Dont <strong>{nbAEtablir}</strong> ligne(s) « à établir » — le deal existe au
          portefeuille, aucune facturation n&apos;y est encore rattachée. Elles comptent pour zéro
          en commission ; leur nominal, lui, est réel.{' '}
          <button onClick={() => setStatut('sans_ligne')} className="underline">
            Les afficher seules
          </button>
        </p>
      )}

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
              <tr
                key={`${rowKey(l)}|${i}`}
                className={
                  l.aFacturer
                    ? 'bg-sky-50/70 hover:bg-sky-100'
                    : impaye
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-orange-50'
                }
              >
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {dateFr(l.issue) ?? '—'}
                  {l.issue && l.issue > TODAY && (
                    <span className="ml-1.5 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-medium text-violet-700" title="Émission à venir">à venir</span>
                  )}
                  {l.aFacturer && (
                    <span
                      className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium text-sky-700"
                      title="Deal du portefeuille sans aucune ligne au registre — la facturation reste à établir. ISIN, client et nominal viennent de l'allocation réelle ; rien d'autre n'est renseigné."
                    >
                      à établir
                    </span>
                  )}
                  {anneeAttr(l) !== annee(l) && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700" title={`Émis en ${annee(l)}, encaissé en ${ANNEE_COURANTE} — report ponctuel`}>report {anneeAttr(l)}</span>
                  )}
                </td>
                {/* ISIN cliquable comme dans tous les onglets — depuis le seul registre, le produit était jusqu'ici inatteignable. */}
                <td className="px-2 py-1.5 whitespace-nowrap"><IsinLink isin={l.isin} /></td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l.client ?? '—'}</td>
                <td
                  className={`px-2 py-1.5 whitespace-nowrap ${impaye ? 'font-semibold text-red-600' : ''}`}
                  title={l.emetteur ?? undefined}
                >
                  {l.emetteur ? codeEmetteur(l.emetteur) : '—'}
                </td>
                <td className="px-2 py-1.5 max-w-[220px] truncate" title={l.description ?? undefined}>{l.description ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.nominal, l.devise ?? 'EUR')}</td>
                {/* UF, Rétro, facture et paiement se modifient TOUS par le crayon
                    (une seule mécanique d'édition). Ici : affichage seul. */}
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{PCT2(l.ufPct)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap font-semibold text-emerald-700">{EUR(l.net)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                  {l.retroPct ? PCT2(l.retroPct) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-orange-600">{l.comClient ? EUR(l.comClient) : <span className="text-slate-300">—</span>}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{EUR(l.comTotal)}</td>
                {/* Facture : n° en lecture seule. L'ajout/la modification passent par le
                    crayon, comme tout le reste. « Facturer Gabrielle » reste : c'est
                    une ACTION (ouvrir l'email), pas une saisie. */}
                <td className="px-2 py-1 whitespace-nowrap">
                  {l.facture ? (
                    l.facture
                  ) : l.editable ? (
                    <a
                      href={factureMailto(l)}
                      className="inline-flex items-center gap-1 rounded border border-cmf-blue/40 bg-blue-50 px-1.5 py-0.5 font-medium text-cmf-blue hover:bg-blue-100"
                      title="Ouvrir l’email de facture pré-rempli vers Gabrielle (office@cmf.finance) — tu procèdes à l’envoi"
                    >
                      ✉ Facturer Gabrielle
                    </a>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Paiement : état seul. Le bascule se fait dans le crayon. */}
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {l.credited ? (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      ✓ Payé {dateFr(l.credited)}
                    </span>
                  ) : impaye ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">● Non payé</span>
                  ) : (
                    <span className="text-amber-600">en attente</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{typeof l.split === 'number' ? pourcent(l.split * 100, 0) : '—'}</td>
                {/* Actions — le crayon est le SEUL point d'entrée pour modifier une
                    commission, ligne locale ou ligne du registre. La croix reste
                    réservée aux lignes locales : une ligne du registre ne se
                    supprime pas depuis le navigateur. */}
                <td className="px-2 py-1 whitespace-nowrap text-center">
                  {l.editable ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setEdit(l)}
                        className="text-slate-400 hover:text-cmf-blue"
                        title={l.isLocal ? 'Modifier cette commission (saisie locale)' : 'Modifier cette commission (ligne du registre)'}
                      >
                        ✎
                      </button>
                      {l.isLocal && (
                        <button onClick={() => deleteLocal(l)} className="text-slate-400 hover:text-red-600" title="Supprimer cette saisie locale — seules les lignes créées via « Nouveau trade » se suppriment ici">
                          ✕
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-200" title="Année clôturée — non modifiable">·</span>
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

      {edit && (
        <CommissionEditor
          ligne={edit}
          // Une ligne du REGISTRE ne se réécrit pas depuis le navigateur : son
          // identité (ISIN, client, nominal, dates…) vient de commissions.json.
          // Seuls UF, rétro, n° de facture et paiement sont surchargeables.
          registre={!edit.isLocal}
          onClose={() => setEdit(null)}
          onSave={(next) => {
            if (edit.isLocal) {
              const base = localCommissions.find((x) => rowKey(x) === rowKey(edit))
              if (base) replace(base.isin, base.client, { ...base, ...next } as LocalCommission)
            } else {
              patch(rowKey(edit), {
                uf: next.ufPct ?? undefined,
                retro: next.retroPct ?? undefined,
                facture: next.facture,
                credited: next.credited,
              })
            }
            setEdit(null)
          }}
          onDelete={
            edit.isLocal
              ? () => {
                  remove(edit.isin, edit.client)
                  setEdit(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

// ── Éditeur de commission — L'UNIQUE mécanique de modification ─────────────
//
//  Il en existait DEUX : des champs éditables directement dans le tableau (UF,
//  rétro, n° de facture, bascule « payé ») pour les lignes du registre, et cette
//  modale pour les lignes locales. Deux chemins pour un même geste, deux rendus
//  différents du même chiffre — le tableau affichait « 5.00 » dans un input là
//  où la ligne voisine affichait « 5,00 % ».
//
//  Tout passe désormais par ici. Le tableau ne fait plus qu'afficher.
//
//  Deux natures de lignes, un seul écran :
//    • ligne LOCALE (« Nouveau trade ») — tout est modifiable, suppression
//      possible : la donnée n'existe qu'ici ;
//    • ligne du REGISTRE (commissions.json) — l'identité est en lecture seule.
//      Le navigateur ne réécrit pas le registre ; il pose une surcharge sur les
//      quatre champs qui en admettent une : UF, rétro, n° de facture, paiement.
//
//  Les montants (Com. totale / Reversé CGP / Net) sont recalculés en direct
//  depuis Nominal × UF / Rétro — on voit ce qu'on enregistre avant de le faire.
function CommissionEditor({
  ligne,
  registre = false,
  onClose,
  onSave,
  onDelete,
}: {
  ligne: CommissionLigne
  registre?: boolean
  onClose: () => void
  onSave: (next: Partial<LocalCommission>) => void
  onDelete?: () => void
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
    if (!registre && !nominal.trim()) {
      alert('Renseigne le nominal.')
      return
    }
    const r2 = (x: number) => Math.round(x * 100) / 100
    const r6 = (x: number) => Math.round(x * 1e6) / 1e6
    const isPaid = paid && !!credited
    // Les champs d'IDENTITÉ ne sont renvoyés que pour une ligne locale : sur une
    // ligne du registre ils sont verrouillés, et les réémettre laisserait croire
    // qu'ils ont été enregistrés.
    const identite = registre
      ? {}
      : {
          client: client.trim() || null,
          description: description.trim() || null,
          emetteur: emetteur.trim() || null,
          devise: devise.trim() || 'EUR',
          nominal: nNum,
          issue: issue || null,
          comTotal: r2(comTotal),
          comClient: r2(comClient),
          net: r2(net),
          statutFacture: (isPaid ? 'payee' : facture.trim() ? 'envoyee' : 'en_attente') as LocalCommission['statutFacture'],
          histo: [
            ...(((ligne as LocalCommission).histo) ?? []),
            { action: 'Modifié dans Commissions', date: new Date().toLocaleString('fr-FR'), user: 'Laurent' },
          ],
        }
    onSave({
      ...identite,
      ufPct: r6(ufDec),
      retroPct: r6(retroDec),
      facture: facture.trim() || null,
      credited: isPaid ? credited : null,
    })
  }

  const fieldCls = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-cmf-blue focus:outline-none'
  const lab = 'text-[11px] font-medium uppercase tracking-wide text-slate-500'

  return (
    <Modal open onClose={onClose} title="Modifier la commission">
      <div className="rounded-lg bg-white p-5 shadow-xl">
        {registre && (
          <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            Ligne du <strong>registre Lifecycle</strong> : l&apos;identité (client, émetteur, nominal, dates)
            vient de <code>commissions.json</code> et n&apos;est pas modifiable ici. Tes modifications d&apos;UF,
            de rétro, de n° de facture et de paiement sont enregistrées <strong>par-dessus</strong> le registre.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label className={lab}>ISIN</label>
            <input value={ligne.isin} readOnly className={`${fieldCls} bg-slate-50 font-mono text-slate-500`} title="L'ISIN identifie la ligne — non modifiable ici" />
          </div>
          <div>
            <label className={lab}>Client</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} readOnly={registre} className={registre ? `${fieldCls} bg-slate-50 text-slate-500` : fieldCls} placeholder="NOM - 00000" />
          </div>
          <div>
            <label className={lab}>Émetteur</label>
            <input value={emetteur} onChange={(e) => setEmetteur(e.target.value)} readOnly={registre} className={registre ? `${fieldCls} bg-slate-50 text-slate-500` : fieldCls} />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className={lab}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} readOnly={registre} className={registre ? `${fieldCls} bg-slate-50 text-slate-500` : fieldCls} />
          </div>
          <div>
            <label className={lab}>Nominal</label>
            <input value={nominal} onChange={(e) => setNominal(e.target.value)} readOnly={registre} inputMode="numeric" className={`${registre ? `${fieldCls} bg-slate-50 text-slate-500` : fieldCls} text-right tabular-nums`} placeholder="200000" />
          </div>
          <div>
            <label className={lab}>Devise</label>
            <input value={devise} onChange={(e) => setDevise(e.target.value.toUpperCase())} readOnly={registre} className={registre ? `${fieldCls} bg-slate-50 text-slate-500` : fieldCls} />
          </div>
          <div>
            <label className={lab}>Date d&apos;émission</label>
            <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} readOnly={registre} className={registre ? `${fieldCls} bg-slate-50 text-slate-500` : fieldCls} />
          </div>
          <div>
            <label className={lab}>UF %</label>
            <input value={uf} onChange={(e) => setUf(e.target.value)} inputMode="decimal" className={`${fieldCls} text-right tabular-nums`} placeholder="5.65" />
          </div>
          <div>
            <label className={lab}>Rétro %</label>
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
          {/* Une ligne du registre ne se supprime pas depuis le navigateur. */}
          {onDelete ? (
            <button onClick={onDelete} className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
              Supprimer
            </button>
          ) : (
            <span />
          )}
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
