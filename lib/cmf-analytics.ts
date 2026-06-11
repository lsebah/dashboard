// ─────────────────────────────────────────────────────────────────────────
//  Analytics « terminal CMF » (Lifecycle 2) — dérivations de portefeuille à
//  partir de la liste de Produits. Fonctions PURES (aucune dépendance React),
//  réutilisables côté serveur et client. Tous les montants sont ramenés en EUR
//  via une table de change statique (les nominaux sont majoritairement en EUR ;
//  quelques tickets USD/CHF/GBP). Les métriques dérivées/reconstruites sont
//  signalées comme telles dans l'UI (carry couru, dispersion, encours reconstruit).
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'
import { couponPa, pnlAvecCoupons } from './lifecycle'

// ── Change statique (EUR base) ───────────────────────────────────────────────
const FX: Record<string, number> = {
  EUR: 1,
  '€': 1,
  USD: 0.92,
  '$US': 0.92,
  '$': 0.92,
  USc: 0.0092,
  GBP: 1.17,
  '£': 1.17,
  GBp: 0.0117,
  CHF: 1.06,
  SEK: 0.088,
  NOK: 0.086,
  DKK: 0.134,
  JPY: 0.0061,
}
export const fxEur = (devise?: string): number =>
  (devise && (FX[devise] ?? FX[devise.toUpperCase()])) || 1

export const eurNominal = (p: Product): number => p.nominal * fxEur(p.devise)

// Statut effectif (défaut « vivant »).
export const statut = (p: Product): string => p.statut ?? 'vivant'
export const estVivant = (p: Product): boolean => statut(p) === 'vivant'

// Prix MtM (% du pair) et P&L (%) — robustes aux champs manquants.
export const prixOf = (p: Product): number =>
  typeof p.prixMarche === 'number' ? p.prixMarche : 100 + (p.pnlPct ?? 0)
export const pnlOf = (p: Product): number =>
  pnlAvecCoupons(p) ?? p.pnlPct ?? (typeof p.prixMarche === 'number' ? p.prixMarche - 100 : 0)

// ── Formatage ────────────────────────────────────────────────────────────────
export const eur = (n: number): string =>
  Math.round(n).toLocaleString('fr-FR') + ' €'
export const eurCompact = (n: number): string => {
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M€'
  if (a >= 1e4) return (n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k€'
  return Math.round(n).toLocaleString('fr-FR') + ' €'
}
export const pct = (n: number, d = 2): string => `${n >= 0 ? '+' : ''}${n.toFixed(d)} %`
export const pctAbs = (n: number, d = 1): string => `${n.toFixed(d)} %`

// ── Totaux du portefeuille (livre vivant) ────────────────────────────────────
export interface Totaux {
  nominal: number // encours nominal (vivant), EUR
  valorisation: number // valorisation MtM (vivant), EUR
  pnlEur: number // P&L latent (vivant), EUR
  pnlPct: number // P&L pondéré nominal, %
  carryPa: number // coupon p.a. moyen pondéré, % (rendement cible)
  carryYtd: number // carry couru depuis le 1ᵉʳ janv., % (couru, indicatif)
  dispersion: number // dispersion (écart-type pondéré) des P&L, points
  ratio: number // rendement / dispersion (Sharpe-like, indicatif)
  nbTotal: number
  nbVivant: number
  nbRappele: number
  nbEchu: number
  nbAutre: number
}

const ANNEE = new Date().getFullYear()

export function totaux(products: Product[]): Totaux {
  const vivants = products.filter(estVivant)
  let nominal = 0
  let valorisation = 0
  let pnlEur = 0
  let wPnl = 0 // Σ nom·pnl
  let wCarry = 0 // Σ nom·couponPa
  let wCarryYtd = 0 // Σ nom·couponPa·fractionAnnée
  for (const p of vivants) {
    const nom = eurNominal(p)
    nominal += nom
    valorisation += nom * (prixOf(p) / 100)
    pnlEur += nom * (pnlOf(p) / 100)
    wPnl += nom * pnlOf(p)
    const cpa = couponPa(p) ?? 0
    wCarry += nom * cpa
    // Fraction de l'année écoulée pendant laquelle le produit était actif.
    const emis = new Date(p.dateEmission || p.dateConstatationInitiale).getTime()
    const debutAnnee = new Date(`${ANNEE}-01-01`).getTime()
    const depart = Math.max(emis, debutAnnee)
    const ecoule = Math.max(0, Date.now() - depart) / (365 * 86400e3)
    wCarryYtd += nom * cpa * Math.min(1, ecoule)
  }
  const pnlPct = nominal ? wPnl / nominal : 0
  const carryPa = nominal ? wCarry / nominal : 0
  const carryYtd = nominal ? wCarryYtd / nominal : 0
  // Dispersion pondérée des P&L (cross-section) — proxy de risque, indicatif.
  let varAcc = 0
  for (const p of vivants) varAcc += eurNominal(p) * Math.pow(pnlOf(p) - pnlPct, 2)
  const dispersion = nominal ? Math.sqrt(varAcc / nominal) : 0
  const ratio = dispersion ? pnlPct / dispersion : 0
  const cnt = (s: string) => products.filter((p) => statut(p) === s).length
  return {
    nominal,
    valorisation,
    pnlEur,
    pnlPct,
    carryPa,
    carryYtd,
    dispersion,
    ratio,
    nbTotal: products.length,
    nbVivant: vivants.length,
    nbRappele: cnt('rappele'),
    nbEchu: cnt('echu'),
    nbAutre: products.length - vivants.length - cnt('rappele') - cnt('echu'),
  }
}

// ── Répartitions (Σ nominal EUR par clé) ─────────────────────────────────────
export interface Part {
  label: string
  montant: number
  pct: number
  n: number
}

function repartition(
  products: Product[],
  keyOf: (p: Product) => string | undefined,
): Part[] {
  const m = new Map<string, { montant: number; n: number }>()
  let total = 0
  for (const p of products) {
    const k = keyOf(p) || '—'
    const nom = eurNominal(p)
    total += nom
    const cur = m.get(k) ?? { montant: 0, n: 0 }
    cur.montant += nom
    cur.n += 1
    m.set(k, cur)
  }
  return Array.from(m.entries())
    .map(([label, v]) => ({ label, montant: v.montant, n: v.n, pct: total ? (v.montant / total) * 100 : 0 }))
    .sort((a, b) => b.montant - a.montant)
}

const CLASSE_LABEL: Record<string, string> = {
  equity: 'Actions',
  rates: 'Taux',
  credit: 'Crédit',
  commodity: 'Matières prem.',
  fx: 'Change',
  hybrid: 'Hybride',
}

export const parClasse = (ps: Product[]): Part[] =>
  repartition(ps, (p) => CLASSE_LABEL[p.assetClass] ?? p.assetClass)
export const parEmetteur = (ps: Product[]): Part[] =>
  repartition(ps, (p) => (p.emetteur || '—').replace(/\s+(Financial|Bank|International|S\.?A\.?|PLC|N\.?V\.?).*$/i, '').trim())
export const parType = (ps: Product[]): Part[] =>
  repartition(ps, (p) => p.productType || p.family)
export const parDevise = (ps: Product[]): Part[] =>
  repartition(ps, (p) => (p.devise || 'EUR').replace('$US', 'USD'))

const SIT_LABEL: Record<string, string> = {
  positive: 'En gain',
  sans_stress: 'Sans stress',
  proche_protection: 'Proche barrière',
  sous_protection: 'Sous barrière',
  non_classe: 'Non classé',
}
export function parSituation(ps: Product[], sitOf: (p: Product) => string): Part[] {
  return repartition(ps, (p) => SIT_LABEL[sitOf(p)] ?? sitOf(p))
}

// Allocation par client (depuis le feed) — montants réels investis si dispo,
// sinon nominal réparti à parts égales entre les clients alloués.
export function parClient(products: Product[]): Part[] {
  const m = new Map<string, { montant: number; n: number }>()
  let total = 0
  for (const p of products) {
    const allocs = p.allocations?.length
      ? p.allocations
      : (p.clients ?? []).map((c) => ({ client: c, montant: undefined as number | undefined }))
    if (allocs.length === 0) continue
    const nomEur = eurNominal(p)
    const fxr = fxEur(p.devise)
    for (const a of allocs) {
      const montant = typeof a.montant === 'number' ? a.montant * fxr : nomEur / allocs.length
      total += montant
      const cur = m.get(a.client) ?? { montant: 0, n: 0 }
      cur.montant += montant
      cur.n += 1
      m.set(a.client, cur)
    }
  }
  return Array.from(m.entries())
    .map(([label, v]) => ({ label, montant: v.montant, n: v.n, pct: total ? (v.montant / total) * 100 : 0 }))
    .sort((a, b) => b.montant - a.montant)
}

// ── Classification sectorielle & géographique (depuis les sous-jacents) ───────
const SECTEURS: [string, RegExp][] = [
  ['Banques & Finance', /\b(BNP|GLE|ACA|ISP|UCG|SAN FP|SAB|BARC|DBK|CBK|HSBA|UBSG|INGA|ABN|CABK|KBC|NDA|EBS|BG|santander|barclays|deutsche|intesa|unicredit|caixa|sabadell|soci[ée]t[ée]|cr[ée]dit agricole)\b/i],
  ['Technologie', /\b(MSTR|MU|MRVL|NVDA|AAPL|MSFT|GOOGL?|AMZN|META|AMD|INTC|ASML|IFX|SAP|STM|ORCL|CRM|ADBE|PLTR|SMCI|TSM|AVGO|micron|marvell|nvidia|microstrategy|broadcom|palantir)\b/i],
  ['Défense & Aéro.', /\b(RHM|LDO|SAF|HO FP|AIR|BAES|AM FP|rheinmetall|leonardo|safran|thales|airbus|dassault)\b/i],
  ['Industrie', /\b(SIE|SU FP|ALO|EN FP|ABBN|HOLN|SGO|DG FP|PHIA|MT|siemens|schneider|alstom|bouygues|holcim|saint.?gobain|vinci|arcelor)\b/i],
  ['Énergie', /\b(TTE|ENR GY|SHEL|BP|ENGI|ENEL|IBE|EDF|USO|XOM|CVX|totalenergies|shell|engie|enel|iberdrola)\b/i],
  ['Santé', /\b(ROG|NOVOB|SAN |NOVN|MRK|PFE|GSK|AZN|SAN FP|roche|novo|sanofi|pfizer|novartis|astrazeneca)\b/i],
  ['Conso & Luxe', /\b(MC FP|OR FP|RMS|CDI|KER|BN FP|EL FP|NESN|ABI|lvmh|herm[èe]s|kering|or[ée]al|nestl[ée]|danone)\b/i],
  ['Automobile', /\b(VOW|MBG|BMW|STLA|RACE|P911|RNO|volkswagen|stellantis|ferrari|porsche|renault|mercedes)\b/i],
]

function secteurUnderlying(nom: string, bbg?: string): string {
  const hay = `${nom} ${bbg ?? ''}`
  if (/index/i.test(bbg ?? '') || /stoxx|s&p|sp\s?500|nasdaq|nikkei|cac|dax|euro\s?stoxx|msci|csi/i.test(nom))
    return 'Indices'
  for (const [label, re] of SECTEURS) if (re.test(hay)) return label
  return 'Autres actions'
}

/** Secteur dominant d'un produit (majorité des sous-jacents, override par classe). */
export function secteurProduit(p: Product): string {
  if (p.assetClass === 'rates') return 'Taux'
  if (p.assetClass === 'credit') return 'Crédit'
  if (p.assetClass === 'commodity') return 'Matières prem.'
  if (p.sousJacents.length === 0) return 'Autres'
  const counts = new Map<string, number>()
  for (const u of p.sousJacents) {
    const s = secteurUnderlying(u.nom, u.bloomberg)
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

const PLACE_REGION: Record<string, string> = {
  FP: 'Europe', IM: 'Europe', GY: 'Europe', GR: 'Europe', SW: 'Europe', SE: 'Europe',
  LN: 'Europe', NA: 'Europe', SM: 'Europe', BB: 'Europe', DC: 'Europe', PL: 'Europe',
  US: 'Amérique', UN: 'Amérique', UW: 'Amérique', UQ: 'Amérique', UP: 'Amérique', UA: 'Amérique',
  JT: 'Asie', JP: 'Asie', HK: 'Asie', C1: 'Asie', CH: 'Asie',
}

function regionUnderlying(nom: string, bbg?: string): string {
  if (/SPX|NDX|S&P|nasdaq|dow|russell/i.test(`${nom} ${bbg ?? ''}`)) return 'Amérique'
  if (/SX5E|stoxx|cac|dax|euro|FTSE|SMI/i.test(`${nom} ${bbg ?? ''}`)) return 'Europe'
  if (/NKY|nikkei|topix|hang|HSI|CSI|SH000|shanghai/i.test(`${nom} ${bbg ?? ''}`)) return 'Asie'
  const parts = (bbg ?? '').trim().split(/\s+/)
  const place = parts.length >= 2 ? parts[parts.length - 1].toUpperCase() : ''
  return PLACE_REGION[place] ?? 'Multi / Indices'
}

/** Région dominante d'un produit. */
export function regionProduit(p: Product): string {
  if (p.assetClass === 'rates' || p.assetClass === 'credit') return 'Europe'
  if (p.sousJacents.length === 0) return 'Multi / Indices'
  const counts = new Map<string, number>()
  for (const u of p.sousJacents) {
    const r = regionUnderlying(u.nom, u.bloomberg)
    counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

export const parSecteur = (ps: Product[]): Part[] => repartition(ps, secteurProduit)
export const parRegion = (ps: Product[]): Part[] => repartition(ps, regionProduit)

// ── Contributeurs au P&L (€) ─────────────────────────────────────────────────
export interface Contrib {
  isin: string
  label: string
  emetteur: string
  contribEur: number
  pnlPct: number
}
export function contributeurs(products: Product[]): Contrib[] {
  return products
    .filter(estVivant)
    .map((p) => ({
      isin: p.isin,
      label: p.productType || p.nom,
      emetteur: p.emetteur,
      contribEur: eurNominal(p) * (pnlOf(p) / 100),
      pnlPct: pnlOf(p),
    }))
    .sort((a, b) => b.contribEur - a.contribEur)
}

// ── Échéancier (maturity ladder) par année ───────────────────────────────────
export function echeancierParAnnee(products: Product[]): Part[] {
  const m = new Map<string, { montant: number; n: number }>()
  let total = 0
  for (const p of products.filter(estVivant)) {
    const y = (p.dateEcheance || '').slice(0, 4) || '—'
    const nom = eurNominal(p)
    total += nom
    const cur = m.get(y) ?? { montant: 0, n: 0 }
    cur.montant += nom
    cur.n += 1
    m.set(y, cur)
  }
  return Array.from(m.entries())
    .map(([label, v]) => ({ label, montant: v.montant, n: v.n, pct: total ? (v.montant / total) * 100 : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// ── Concentration ────────────────────────────────────────────────────────────
export interface Concentration {
  topEmetteur: Part | undefined
  topSousJacent: { nom: string; montant: number; pct: number } | undefined
  hhiEmetteur: number // indice Herfindahl-Hirschman (0..10000)
  nbEmetteurs: number
}
export function concentration(products: Product[]): Concentration {
  const vivants = products.filter(estVivant)
  const emet = parEmetteur(vivants)
  // HHI sur la part de chaque émetteur (en %).
  const hhi = emet.reduce((s, e) => s + e.pct * e.pct, 0)
  // Top sous-jacent par exposition nominale (réparti à parts égales du panier).
  const su = new Map<string, number>()
  let totalSu = 0
  for (const p of vivants) {
    const nom = eurNominal(p)
    const k = p.sousJacents.length
    if (k === 0) continue
    for (const u of p.sousJacents) {
      su.set(u.nom, (su.get(u.nom) ?? 0) + nom / k)
      totalSu += nom / k
    }
  }
  const topSu = Array.from(su.entries()).sort((a, b) => b[1] - a[1])[0]
  return {
    topEmetteur: emet[0],
    topSousJacent: topSu ? { nom: topSu[0], montant: topSu[1], pct: totalSu ? (topSu[1] / totalSu) * 100 : 0 } : undefined,
    hhiEmetteur: Math.round(hhi),
    nbEmetteurs: emet.length,
  }
}

// ── Encours reconstruit (mensuel) ────────────────────────────────────────────
export interface PointTemps {
  label: string // MM/AA
  iso: string // yyyy-mm
  encours: number // Σ nominal EUR actif ce mois
  cumulEmis: number // Σ nominal EUR émis à date (déploiement brut)
}
export function historiqueEncours(products: Product[], maxMois = 42): PointTemps[] {
  const dates = products
    .map((p) => p.dateEmission || p.dateConstatationInitiale)
    .filter(Boolean)
    .sort()
  if (dates.length === 0) return []
  const start = new Date(dates[0])
  start.setDate(1)
  const now = new Date()
  const out: PointTemps[] = []
  const cur = new Date(start)
  while (cur <= now) {
    const finMois = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const isoFin = finMois.toISOString().slice(0, 10)
    let encours = 0
    let cumulEmis = 0
    for (const p of products) {
      const emis = p.dateEmission || p.dateConstatationInitiale
      const ech = p.dateEcheance
      if (!emis) continue
      const nom = eurNominal(p)
      if (emis <= isoFin) cumulEmis += nom
      if (emis <= isoFin && (!ech || ech >= isoFin)) encours += nom
    }
    out.push({
      label: `${String(cur.getMonth() + 1).padStart(2, '0')}/${String(cur.getFullYear()).slice(2)}`,
      iso: cur.toISOString().slice(0, 7),
      encours,
      cumulEmis,
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out.slice(-maxMois)
}
