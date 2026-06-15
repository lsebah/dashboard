'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import { useAugmentedProduct } from '@/lib/useProductLevels'
import {
  prochainEvenement,
  prochaineObservation,
  situation,
  type Situation,
  couponPa,
  couponsEncaissesPct,
  pnlAvecCoupons,
  rappelConstate,
  formatDateFr,
  formatPct,
} from '@/lib/lifecycle'
import { useAllocations, tousLesClients, type ClientAlloc } from '@/lib/allocations'
import { useLocalProducts } from '@/lib/local-products'
import ClientReport from './ClientReport'
import { canonicalForProduct, termsheetFile } from '@/lib/termsheets'
import tsPdfs from '@/lib/ts-pdfs.json'

// PDF de la TS déposé dans public/ts/<ISIN>.pdf (cf. scripts/index-ts-pdfs.mjs).
const TS_PDFS = tsPdfs as Record<string, string>
import { SITUATION_COLOR, SITUATION_LABEL, freqLabel, assetLabel } from './labels'
import ProductSynopsis from './ProductSynopsis'
import ProductReconstruction from './ProductReconstruction'
import ClientAssign from './ClientAssign'
import Modal from './Modal'

function annees(p: Product): number | null {
  const d0 = new Date(p.dateConstatationInitiale).getTime()
  const d1 = new Date(p.dateEcheance).getTime()
  if (Number.isNaN(d0) || Number.isNaN(d1)) return null
  return Math.round((d1 - d0) / (365.25 * 86_400_000))
}

function ticker(s: string): string {
  return s.split(' ')[0]
}

// Produit "en cours" : ni rappelé, ni vendu, ni arrivé à maturité.
function estEnCours(p: Product): boolean {
  return p.statut !== 'rappele' && p.statut !== 'vendu' && p.statut !== 'echu'
}

// Autocall probable à la PROCHAINE observation : worst-of courant (niveaux Yahoo
// injectés dans p.sousJacents) vs barrière de rappel. Pour un autocall INVERSE
// (reverse), le rappel se déclenche quand le sous-jacent BAISSE (worst ≤ barrière).
function autocallProbable(p: Product): boolean {
  const obs = prochaineObservation(p)
  if (!obs || obs.autocallActif === false || typeof obs.niveauRappelPct !== 'number') return false
  const perfs = p.sousJacents
    .map((u) => u.perf)
    .filter((x): x is number => typeof x === 'number')
  if (perfs.length === 0) return false
  const worst = 100 + Math.min(...perfs)
  const inverse = p.terms?.kind === 'autocall' && p.terms.sens === 'inverse'
  return inverse ? worst <= obs.niveauRappelPct : worst >= obs.niveauRappelPct
}

function lastLabel(p: Product): { text: string; cls: string } {
  if (p.statut === 'rappele') return { text: 'CALLED', cls: 'text-emerald-600 font-semibold' }
  if (p.statut === 'vendu') return { text: 'SOLD', cls: 'text-blue-600 font-semibold' }
  if (p.statut === 'echu') return { text: 'ÉCHU', cls: 'text-slate-400' }
  if (typeof p.prixMarche === 'number') {
    // Prix : vert au-dessus de 100, noir à 100, rouge en dessous.
    const cls =
      p.prixMarche > 100
        ? 'text-emerald-600'
        : p.prixMarche < 100
          ? 'text-red-600'
          : 'text-slate-900'
    return { text: p.prixMarche.toFixed(2), cls }
  }
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
  const t = p.terms
  if (t?.kind === 'autocall') return t.protectionPct // PDI = barrière de protection (TS)
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
type Col = { label: string; key?: string; align?: 'center'; noSort?: boolean }
const COLUMNS: Col[] = [
  { label: 'RR', key: 'rr' },
  { label: 'Issue', key: 'issue' },
  { label: 'ISIN', key: 'isin' },
  { label: 'TS', key: 'ts', noSort: true },
  { label: 'Last', key: 'last' },
  { label: 'P&L', key: 'pnl' },
  { label: 'Next event', key: 'next' },
  { label: 'CY', key: 'cy' },
  { label: 'Amount', key: 'amount' },
  { label: 'Issuer', key: 'issuer' },
  { label: 'Freq.', key: 'freq' },
  { label: 'Y', key: 'y' },
  { label: 'Description', key: 'desc' },
  { label: 'Cpn p.a.', key: 'cpn' },
  { label: 'Eq/Cr', key: 'asset' },
  { label: 'Type', key: 'type' },
  { label: 'Mém.', key: 'mem', align: 'center' },
  { label: 'B. Autocall', key: 'bauto' },
  { label: 'B. Coupon', key: 'bcoupon' },
  { label: 'PDI', key: 'pdi' },
  { label: 'Client', key: 'client' },
  { label: 'Sous-jacents', key: 'sj' },
]

// Colonnes figées à gauche : largeurs px fixes → offsets `left` cumulés. Chaque
// cellule figée porte SON fond opaque (pas de transparence) ⇒ aucun caractère du
// panneau défilant ne transparaît derrière au scroll horizontal.
const FROZEN_W: Record<string, number> = {
  rr: 40,
  issue: 88,
  isin: 118,
  ts: 26,
  last: 62,
  pnl: 74,
}

// Couleur par classe d'actif : Equity en noir, une couleur distincte sinon.
const ASSET_COLOR: Record<string, string> = {
  equity: 'text-slate-900',
  rates: 'text-indigo-600',
  credit: 'text-orange-600',
  commodity: 'text-amber-700',
  fx: 'text-teal-600',
  hybrid: 'text-fuchsia-600',
}
const FROZEN_ORDER = ['rr', 'issue', 'isin', 'ts', 'last', 'pnl']
const FROZEN_LEFT: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  let x = 0
  for (const k of FROZEN_ORDER) {
    m[k] = x
    x += FROZEN_W[k]
  }
  return m
})()
const isFrozen = (key?: string) => !!key && key in FROZEN_W

function compare(a: SortVal, b: SortVal): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'fr')
}

export default function PortfolioExplorer({ products }: { products: Product[] }) {
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [client, setClient] = useState<string>('')
  const [showReport, setShowReport] = useState(false)
  const [liveOnly, setLiveOnly] = useState(false)
  const [situ, setSitu] = useState<Situation | null>(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  // « Par compte » : une ligne par (produit × compte) avec le montant du compte ;
  // sinon une ligne par produit avec le montant agrégé.
  const [parCompte, setParCompte] = useState(true)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'next',
    dir: 'asc',
  })

  const { map, setClients, statut: statutMap, setStatut, noms, setNom } = useAllocations()

  // Produits créés/importés localement (masque « Nouveau produit ») → fusionnés
  // au feed pour une mise à jour instantanée du portefeuille.
  const localProducts = useLocalProducts()
  const productsAll = useMemo(() => {
    const seen = new Set(products.map((p) => p.isin))
    return [...products, ...localProducts.filter((p) => !seen.has(p.isin))]
  }, [products, localProducts])

  // Surcouches locales appliquées par-dessus le feed, avant tout calcul (en-cours,
  // situation, libellé prix, synthèse) : statut forcé (Vendu/Rappelé…) et nom
  // d'affichage renommé manuellement.
  const productsO = useMemo(
    () =>
      productsAll.map((p) => {
        const s = statutMap[p.isin]
        const n = noms[p.isin]
        return s || n ? { ...p, statut: s ?? p.statut, nom: n ?? p.nom } : p
      }),
    [productsAll, statutMap, noms],
  )

  // Allocations effectives d'un produit : localStorage, sinon seed `clients`.
  const allocsOf = useMemo(
    () =>
      (p: Product): ClientAlloc[] =>
        map[p.isin] ?? p.allocations ?? p.clients?.map((c) => ({ client: c })) ?? [],
    [map],
  )

  const clients = useMemo(
    () => tousLesClients(map, products.flatMap((p) => p.clients ?? [])),
    [map, products],
  )

  const filtered = useMemo(() => {
    let l = productsO
    if (client) l = l.filter((p) => allocsOf(p).some((a) => a.client === client))
    if (liveOnly) l = l.filter(estEnCours)
    const needle = q.trim().toLowerCase()
    if (needle)
      l = l.filter((p) =>
        [
          p.isin,
          p.nom,
          p.description,
          p.productType,
          p.emetteur,
          p.termsheetFichier,
          ...p.sousJacents.flatMap((u) => [u.nom, u.bloomberg, u.isin]),
        ].some((s) => (s ?? '').toLowerCase().includes(needle)),
      )
    return l
  }, [productsO, client, liveOnly, q, allocsOf])

  const nbLive = useMemo(() => productsO.filter(estEnCours).length, [productsO])

  const sorters: Record<string, (p: Product) => SortVal> = useMemo(
    () => ({
      rr: (p) => p.rr,
      issue: (p) => p.dateEmission,
      isin: (p) => p.isin,
      last: (p) => p.prixMarche,
      pnl: (p) => pnlAvecCoupons(p) ?? p.pnlPct,
      next: (p) => prochainEvenement(p),
      cy: (p) => p.devise,
      amount: (p) => p.nominal,
      issuer: (p) => p.emetteur,
      freq: (p) => freqLabel(p.frequence),
      y: (p) => annees(p) ?? undefined,
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

  // Niveaux courants des sous-jacents (Yahoo, batché) → injectés dans `list` pour
  // afficher la variation en % sur les cartes et la colonne Sous-jacents.
  const [perfMap, setPerfMap] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => {
    const isins = products.map((p) => p.isin)
    if (isins.length === 0) return
    let annule = false
    fetch(`/api/lifecycle/courant?isins=${encodeURIComponent(isins.join(','))}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return
        const m: Record<string, Record<string, number>> = {}
        for (const [isin, v] of Object.entries(d?.courant ?? {})) {
          const inner: Record<string, number> = {}
          for (const x of (v as { sj: { nom: string; pct: number | null }[] }).sj ?? [])
            if (typeof x.pct === 'number') inner[x.nom] = x.pct
          m[isin] = inner
        }
        setPerfMap(m)
      })
      .catch(() => {})
    return () => {
      annule = true
    }
  }, [products])

  const augment = (p: Product): Product => {
    const pm = perfMap[p.isin]
    if (!pm) return p
    return {
      ...p,
      sousJacents: p.sousJacents.map((u) =>
        typeof pm[u.nom] === 'number'
          ? { ...u, perf: Math.round((pm[u.nom] - 100) * 100) / 100 }
          : u,
      ),
    }
  }

  const listAug = useMemo(() => list.map(augment), [list, perfMap])

  // Positions du client sélectionné (toutes, hors filtres live/texte) → reporting.
  const reportRows = useMemo(
    () =>
      client
        ? productsAll
            .filter((p) => allocsOf(p).some((a) => a.client === client))
            .map((p) => ({ p: augment(p), montant: allocsOf(p).find((a) => a.client === client)?.montant }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, productsAll, allocsOf, perfMap],
  )

  // Filtre « situation » (bulles cliquables de la synthèse) — appliqué sur la
  // liste augmentée car la situation dépend des niveaux courants injectés.
  const listFinal = useMemo(
    () => (situ ? listAug.filter((p) => situation(p) === situ) : listAug),
    [listAug, situ],
  )

  // Montant total d'un produit = somme des allocations (reflète les ajustements
  // locaux), sinon le nominal du feed.
  const montantTotal = (p: Product): number => {
    const a = allocsOf(p)
    const ms = a.map((x) => x.montant).filter((m): m is number => typeof m === 'number')
    return a.length > 0 && ms.length === a.length ? ms.reduce((s, m) => s + m, 0) : p.nominal
  }

  // Ajuste (localement) le montant investi du compte d'index `idx` d'un produit.
  const commitMontant = (p: Product, idx: number, raw: string) => {
    const m = Number(raw.replace(/[^\d.,]/g, '').replace(',', '.'))
    const next = allocsOf(p).map((a, j) =>
      j === idx ? { ...a, montant: Number.isFinite(m) && m > 0 ? m : undefined } : a,
    )
    setClients(p.isin, next)
  }

  // Lignes affichées : éclatées par compte (une ligne par allocation) si
  // `parCompte`, sinon une ligne par produit (montant agrégé).
  const rowsFinal = useMemo<{ p: Product; alloc?: ClientAlloc; i: number }[]>(() => {
    if (!parCompte) return listFinal.map((p) => ({ p, i: 0 }))
    return listFinal.flatMap((p) => {
      const allocs = allocsOf(p)
      return allocs.length > 0
        ? allocs.map((alloc, i) => ({ p, alloc, i }))
        : [{ p, i: 0 }]
    })
  }, [listFinal, parCompte, allocsOf])

  // Synthèse « Analyse de risques » calculée sur TOUS les produits en cours, avec
  // les niveaux courants injectés (sinon la situation serait « non classé » côté
  // serveur, faute de perf). Indépendante des filtres de la table.
  const synthese = useMemo(() => {
    const enCours = productsO.filter(estEnCours)
    const total = enCours.reduce((s, p) => s + p.nominal, 0)
    const counts = new Map<Situation, number>()
    for (const p of enCours) {
      const s = situation(augment(p))
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return { n: enCours.length, total, counts }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsO, perfMap])

  const toggleSort = (key?: string) => {
    if (!key) return
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  // En-tête d'une colonne (triable sauf `noSort`). Figée + sticky top si gauche.
  const headerCell = (c: Col) => {
    const active = !c.noSort && c.key && sort.key === c.key
    const frozen = isFrozen(c.key)
    return (
      <th
        key={c.label}
        onClick={c.noSort ? undefined : () => toggleSort(c.key)}
        style={
          frozen
            ? { left: FROZEN_LEFT[c.key!], width: FROZEN_W[c.key!], minWidth: FROZEN_W[c.key!] }
            : undefined
        }
        className={`font-medium px-2 py-1.5 whitespace-nowrap border-b border-slate-200 bg-slate-50 sticky top-0 ${
          frozen ? 'z-30' : 'z-10'
        }${c.key === 'pnl' ? ' border-r border-slate-200' : ''} ${
          c.align === 'center' ? 'text-center' : 'text-left'
        } ${c.key && !c.noSort ? 'cursor-pointer select-none hover:text-cmf-navy' : ''}`}
        title={c.key && !c.noSort ? 'Trier' : undefined}
      >
        <span className="inline-flex items-center gap-1">
          {c.label}
          {active && <span className="text-cmf-blue">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
          {c.key && !c.noSort && !active && <span className="text-slate-300">↕</span>}
        </span>
      </th>
    )
  }

  // Attributs d'une cellule figée : offset `left`, largeur fixe, z-index, et
  // fond opaque (blanc, ou orange sur la ligne survolée) pour masquer le défilant.
  const frozenAttrs = (key: string, p: Product) => ({
    style: {
      left: FROZEN_LEFT[key],
      width: FROZEN_W[key],
      minWidth: FROZEN_W[key],
    } as React.CSSProperties,
    cls: `sticky z-20 ${hoverId === p.id ? 'bg-orange-50' : 'bg-white'}${
      key === 'pnl' ? ' border-r border-slate-200' : ''
    }`,
  })

  // Cellule de corps pour une colonne donnée. `alloc` = allocation de la ligne
  // (mode « par compte ») : la cellule Amount/Client affiche alors le compte.
  const bodyCell = (p: Product, key?: string, alloc?: ClientAlloc, i = 0) => {
    const t = p.terms
    switch (key) {
      case 'rr': {
        const f = frozenAttrs('rr', p)
        return <td key="rr" style={f.style} className={`px-2 py-1.5 text-slate-500 ${f.cls}`}>{p.rr ?? '—'}</td>
      }
      case 'issue': {
        const f = frozenAttrs('issue', p)
        return <td key="issue" style={f.style} className={`px-2 py-1.5 whitespace-nowrap text-slate-500 ${f.cls}`}>{formatDateFr(p.dateEmission)}</td>
      }
      case 'isin': {
        const s = situation(p)
        const f = frozenAttrs('isin', p)
        const prob = autocallProbable(p)
        return (
          <td key="isin" style={f.style} className={`pl-2 pr-0.5 py-1.5 font-mono whitespace-nowrap ${f.cls}`}>
            <span
              className={`inline-flex items-center gap-1.5 ${prob ? 'font-bold text-emerald-600' : ''}`}
              title={prob ? 'Autocall probable à la prochaine observation' : undefined}
            >
              <span className={`w-2 h-2 rounded-full ${SITUATION_COLOR[s]}`} title={SITUATION_LABEL[s]} />
              {p.isin}
            </span>
          </td>
        )
      }
      case 'ts': {
        const f = frozenAttrs('ts', p)
        // PDF local prioritaire (ouverture directe, plus de détour par le cloud) ;
        // repli sur le lien OneDrive si le PDF n'est pas encore déposé.
        const local = TS_PDFS[p.isin]
        const href = local ?? p.termsheetUrl
        return (
          <td key="ts" style={f.style} className={`px-0.5 py-1.5 text-center ${f.cls}`}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-cmf-blue hover:underline font-medium"
                title={local ? 'Ouvrir la termsheet (PDF)' : 'Ouvrir la termsheet (OneDrive)'}
              >
                TS
              </a>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
        )
      }
      case 'last': {
        const last = lastLabel(p)
        const f = frozenAttrs('last', p)
        return <td key="last" style={f.style} className={`px-2 py-1.5 tabular-nums ${last.cls} ${f.cls}`}>{last.text}</td>
      }
      case 'pnl': {
        const f = frozenAttrs('pnl', p)
        // P&L du portefeuille = prix + coupons encaissés − 100 (cumule les coupons versés).
        const pnl = pnlAvecCoupons(p) ?? p.pnlPct
        const coupons = couponsEncaissesPct(p)
        const hasCoupons = typeof coupons === 'number' && coupons > 0
        return (
          <td
            key="pnl"
            style={f.style}
            title={
              hasCoupons && typeof pnl === 'number'
                ? `Prix ${p.prixMarche?.toFixed(2)} + coupons ${coupons.toFixed(2)} − 100`
                : undefined
            }
            className={`px-2 py-1.5 tabular-nums ${
              typeof pnl === 'number'
                ? pnl >= 0
                  ? 'text-emerald-600'
                  : 'text-red-600'
                : 'text-slate-400'
            } ${f.cls}`}
          >
            {typeof pnl === 'number' ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%` : '—'}
            {hasCoupons && <span className="text-[10px] text-slate-400 ml-0.5" title="coupons inclus">¢</span>}
          </td>
        )
      }
      case 'next':
        return <td key="next" className="px-2 py-1.5 whitespace-nowrap text-slate-600">{prochainEvenement(p) ? formatDateFr(prochainEvenement(p)) : '—'}</td>
      case 'cy':
        return <td key="cy" className="px-2 py-1.5 text-slate-500">{p.devise}</td>
      case 'amount': {
        // Par compte : montant du compte ÉDITABLE en place (clic → saisie, commit
        // à la sortie / Entrée). Sinon (agrégé) : total en lecture seule.
        if (alloc) {
          return (
            <td key="amount" className="px-1 py-1 tabular-nums whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              <input
                key={`${p.isin}|${i}|${alloc.montant ?? ''}`}
                defaultValue={typeof alloc.montant === 'number' ? alloc.montant : ''}
                inputMode="numeric"
                placeholder="—"
                title="Ajuster le montant investi (local)"
                className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums hover:border-slate-300 focus:border-cmf-blue focus:bg-white focus:outline-none"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => commitMontant(p, i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
            </td>
          )
        }
        return (
          <td key="amount" className="px-2 py-1.5 tabular-nums whitespace-nowrap">
            {montantTotal(p).toLocaleString('fr-FR')}
          </td>
        )
      }
      case 'issuer':
        return <td key="issuer" className="px-2 py-1.5 whitespace-nowrap">{p.emetteur.split(' ')[0]}</td>
      case 'freq':
        return <td key="freq" className="px-2 py-1.5 text-slate-500">{freqLabel(p.frequence)}</td>
      case 'y':
        return <td key="y" className="px-2 py-1.5 tabular-nums">{annees(p) != null ? `${annees(p)}Y` : '—'}</td>
      case 'desc':
        return <td key="desc" className="px-2 py-1.5 max-w-[260px] truncate" title={p.description ?? p.nom}>{p.description ?? p.nom}</td>
      case 'asset':
        return <td key="asset" className={`px-2 py-1.5 font-medium ${ASSET_COLOR[p.assetClass] ?? 'text-slate-500'}`}>{assetLabel(p.assetClass)}</td>
      case 'type':
        return <td key="type" className="pl-2 pr-1 py-1.5 max-w-[120px] truncate" title={p.productType ?? undefined}>{p.productType ?? '—'}</td>
      case 'mem':
        return <td key="mem" className="px-1 py-1.5 text-center">{(t?.kind === 'autocall' && t.effetMemoire) || /[ée]moire/i.test(p.description ?? '') ? '✓' : ''}</td>
      case 'cpn':
        return <td key="cpn" className="px-2 py-1.5 tabular-nums">{formatPct(couponPa(p))}</td>
      case 'bauto':
        return <td key="bauto" className="px-2 py-1.5 tabular-nums whitespace-nowrap">{p.barriereAutocall ?? (t?.kind === 'autocall' ? (t.degressif ? 'Dégr.' : `${t.barriereRappelPct ?? 100}%`) : '—')}</td>
      case 'bcoupon':
        return (
          <td key="bcoupon" className="px-2 py-1.5 tabular-nums whitespace-nowrap">
            {(() => {
              const cb =
                t?.kind === 'autocall' && typeof t.barriereCouponPct === 'number'
                  ? `${t.barriereCouponPct}%`
                  : p.barriereCoupon
              const air = t?.kind === 'autocall' && t.airbag
              if (air)
                return (
                  <span>
                    <span className="text-amber-600">Airbag</span>
                    {cb ? ` · ${cb}` : ''}
                  </span>
                )
              return cb ?? '—'
            })()}
          </td>
        )
      case 'pdi': {
        const v = pdiVal(p)
        return <td key="pdi" className="px-2 py-1.5 tabular-nums whitespace-nowrap">{typeof v === 'number' ? `${v}%` : '—'}</td>
      }
      case 'client': {
        // Par compte : le compte de la ligne ; sinon tous les comptes (agrégé).
        if (alloc) return <td key="client" className="px-2 py-1.5 whitespace-nowrap text-slate-600">{alloc.client}</td>
        const allocs = allocsOf(p)
        return (
          <td key="client" className="px-2 py-1.5 whitespace-nowrap text-slate-600">
            {allocs.length > 0 ? allocs.map((a) => a.client).join(', ') : <span className="text-slate-300">+ affecter</span>}
          </td>
        )
      }
      case 'sj': {
        // Tri alphabétique par ticker, puis placement dans 3 colonnes de largeur
        // fixe ⇒ les sous-jacents s'alignent verticalement d'une ligne à l'autre
        // (1er sous-jacent dans la 1re colonne, etc.), même nombre variable.
        const sj = [...p.sousJacents]
          .sort((a, b) =>
            ticker(a.bloomberg ?? a.nom).localeCompare(ticker(b.bloomberg ?? b.nom)),
          )
          .slice(0, 3)
        return (
          <td key="sj" className="px-2 py-1.5 whitespace-nowrap">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => {
                const u = sj[i]
                return (
                  <span key={i} className="inline-flex items-center gap-1 w-[80px]">
                    {u && (
                      <>
                        <span className="text-slate-500 truncate min-w-0">
                          {ticker(u.bloomberg ?? u.nom)}
                        </span>
                        <span
                          className={`ml-auto shrink-0 tabular-nums ${
                            typeof u.perf === 'number'
                              ? u.perf >= 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
                              : 'text-slate-300'
                          }`}
                        >
                          {typeof u.perf === 'number' ? `${(100 + u.perf).toFixed(0)}%` : '—'}
                        </span>
                      </>
                    )}
                  </span>
                )
              })}
            </div>
          </td>
        )
      }
      default:
        return <td key={key} className="px-2 py-1.5" />
    }
  }

  // Survol synchronisé entre les deux panneaux (même produit surligné).
  const rowProps = (p: Product) => ({
    onClick: () => setOpenId(p.id),
    onMouseEnter: () => setHoverId(p.id),
    onMouseLeave: () => setHoverId(null),
    className: `cursor-pointer ${hoverId === p.id ? 'bg-orange-50' : ''}`,
  })

  const opened = openId ? productsO.find((p) => p.id === openId) ?? null : null

  // Produit ouvert augmenté des niveaux Yahoo : niveaux du worst-of constatés aux
  // observations passées (suivi des coupons + P&L coupons inclus) ET niveaux
  // courants des sous-jacents en % (affichés dans la fiche).
  const openedAug = useAugmentedProduct(opened)

  return (
    // Hauteur fixée à la fenêtre (sous l'en-tête + le titre, éléments stables) :
    // la table occupe le reste en flex-1 ⇒ sa barre de défilement HORIZONTALE
    // reste collée en bas de l'écran, quelle que soit la hauteur de la synthèse
    // ou de la barre d'outils (qui peuvent s'enrouler). Plus besoin de scroller.
    <div className="flex flex-col h-[calc(100vh_-_10rem)]">
      {/* Synthèse « Analyse de risques » (situations calculées en live) */}
      <div className="card p-4 mb-5 shrink-0">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-2xl font-bold text-cmf-navy">{synthese.n}</div>
            <div className="text-xs text-slate-500">Produits en cours</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-cmf-navy tabular-nums">
              {synthese.total.toLocaleString('fr-FR')}
            </div>
            <div className="text-xs text-slate-500">Nominal total (toutes devises)</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SITUATION_LABEL) as Situation[]).map((s) => {
              const n = synthese.counts.get(s) ?? 0
              if (n === 0) return null
              const active = situ === s
              return (
                <button
                  key={s}
                  onClick={() => setSitu(active ? null : s)}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-1 transition-colors ${
                    active
                      ? 'border-cmf-blue bg-cmf-blue/10'
                      : 'border-slate-200 hover:bg-slate-100'
                  }`}
                  title={active ? 'Cliquer pour retirer le filtre' : `Filtrer : ${SITUATION_LABEL[s]}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${SITUATION_COLOR[s]}`} />
                  <span className="text-sm text-slate-700">{SITUATION_LABEL[s]}</span>
                  <span className="text-sm font-semibold text-slate-900">{n}</span>
                </button>
              )
            })}
            {situ && (
              <button
                onClick={() => setSitu(null)}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                tout afficher
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
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
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
            <button
              onClick={() => setLiveOnly(false)}
              className={`px-3 py-1.5 ${!liveOnly ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
              title="Tout le portefeuille"
            >
              Tous <span className="opacity-60">{productsAll.length}</span>
            </button>
            <button
              onClick={() => setLiveOnly(true)}
              className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${
                liveOnly ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'
              }`}
              title="En cours uniquement (exclut rappelés / vendus / échus)"
            >
              <span className={`w-2 h-2 rounded-full ${liveOnly ? 'bg-white' : 'bg-emerald-500'}`} />
              LIVE <span className="opacity-70">{nbLive}</span>
            </button>
          </div>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-sm">
            <button
              onClick={() => setParCompte(true)}
              className={`px-3 py-1.5 ${parCompte ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
              title="Une ligne par compte (montant par compte)"
            >
              Par compte
            </button>
            <button
              onClick={() => setParCompte(false)}
              className={`px-3 py-1.5 ${!parCompte ? 'bg-cmf-navy text-white' : 'bg-white text-slate-600'}`}
              title="Une ligne par produit (montant agrégé)"
            >
              Agrégé
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (ISIN, sous-jacent, TS, émetteur…)"
              className="input w-[300px] pr-7"
              title="Filtre texte : ISIN, nom/description, sous-jacent, fichier TS, émetteur"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Effacer"
              >
                ×
              </button>
            )}
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
          {client && (
            <button
              onClick={() => setShowReport(true)}
              className="rounded-md bg-cmf-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0b1d36]"
              title="Générer le reporting mensuel (PDF) du client"
            >
              Reporting PDF
            </button>
          )}
        </div>
      </div>

      {showReport && client && (
        <ClientReport client={client} rows={reportRows} perfMap={perfMap} onClose={() => setShowReport(false)} />
      )}

      {view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start flex-1 min-h-0 overflow-auto pr-1">
          {listFinal.map((p) => (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="text-left block w-full">
              <ProductSynopsis product={p} compact />
            </button>
          ))}
        </div>
      ) : (
        // Un seul conteneur défilant (x ET y) ⇒ la barre de défilement horizontale
        // reste collée en bas de la fenêtre visible (plus besoin de descendre tout
        // en bas de la liste). Les 6 premières colonnes sont figées à gauche
        // (sticky + fond opaque), le reste défile sous elles sans transparence.
        <div className="card overflow-auto flex-1 min-h-0">
          <table className="text-[13px] border-separate border-spacing-0 w-max min-w-full">
            <thead className="text-slate-500">
              <tr>{COLUMNS.map(headerCell)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowsFinal.map(({ p, alloc, i }) => (
                <tr key={`${p.id}|${alloc?.client ?? '∅'}|${i}`} {...rowProps(p)}>
                  {COLUMNS.map((c) => bodyCell(p, c.key, alloc, i))}
                </tr>
              ))}
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
        {opened && openedAug && (
          <div className="flex flex-col gap-3">
            {/* Rappel détecté : à une observation passée (active), le worst-of
                constaté (niveaux Yahoo) a franchi la barrière d'autocall → on
                propose de marquer le produit « rappelé » (statut local). */}
            {(() => {
              const r = opened.statut !== 'rappele' ? rappelConstate(openedAug) : undefined
              if (!r) return null
              return (
                <div className="rounded-md border border-violet-200 bg-violet-50 p-2.5 text-[12px] text-violet-800 flex items-center justify-between gap-2">
                  <span>
                    ↑ <strong>Rappel probable</strong> : worst-of {r.niveauPct}% ≥ barrière
                    d&apos;autocall {r.barrierePct}% à l&apos;observation #{r.n} du{' '}
                    {formatDateFr(r.date)}.
                  </span>
                  <button
                    onClick={() => setStatut(opened.isin, 'rappele')}
                    className="shrink-0 rounded bg-violet-600 px-2 py-1 font-medium text-white hover:bg-violet-700"
                  >
                    Marquer rappelé
                  </button>
                </div>
              )
            })()}
            <ProductSynopsis product={openedAug} />
            <ClientAssign
              allocs={allocsOf(opened)}
              devise={opened.devise}
              onChange={(next) => setClients(opened.isin, next)}
              statut={opened.statut}
              onStatut={(s) => setStatut(opened.isin, s)}
              nom={opened.nom}
              onNom={(s) => setNom(opened.isin, s)}
              tsCible={canonicalForProduct(opened)}
              tsActuel={termsheetFile(opened.isin)}
            />
            <ProductReconstruction product={openedAug} />
          </div>
        )}
      </Modal>
    </div>
  )
}
