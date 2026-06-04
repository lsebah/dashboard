// ─────────────────────────────────────────────────────────────────────────
//  Helpers "lifecycle" — dérivations à partir d'un Produit.
//  Aucune dépendance externe : ces fonctions servent autant à l'affichage
//  qu'au futur moteur de monitoring (prochaine observation, statut, distances
//  aux barrières…).
// ─────────────────────────────────────────────────────────────────────────
import type { Product, Observation, Underlying } from './types'

/** Construit un calendrier d'observations à partir de listes de dates. */
export function buildObservations(
  obsDates: string[],
  payDates: string[],
  opts: {
    /** Niveau de rappel (% initial) — constant ou fonction de n (1-based). */
    niveauRappelPct?: number | ((n: number) => number)
    /** Montant de remboursement si rappelé (% nominal) — constant ou f(n). */
    montantRemboursementPct?: number | ((n: number) => number)
    /** Coupon de la période (% nominal) — constant ou f(n). */
    couponPct?: number | ((n: number) => number)
    /** Barrière de coupon (% initial). */
    niveauCouponPct?: number
    /** Première période où le rappel devient actif (Oxygène). 1 = dès le départ. */
    rappelActifAPartirDe?: number
  } = {},
): Observation[] {
  const val = (
    v: number | ((n: number) => number) | undefined,
    n: number,
  ): number | undefined => (typeof v === 'function' ? v(n) : v)

  return obsDates.map((dateObservation, i) => {
    const n = i + 1
    return {
      n,
      dateObservation,
      datePaiement: payDates[i],
      autocallActif: n >= (opts.rappelActifAPartirDe ?? 1),
      niveauRappelPct: val(opts.niveauRappelPct, n),
      montantRemboursementPct: val(opts.montantRemboursementPct, n),
      couponPct: val(opts.couponPct, n),
      niveauCouponPct: opts.niveauCouponPct,
    }
  })
}

/** Sous-jacent le moins performant (pertinent pour les worst-of). */
export function worstOf(product: Product): Underlying | undefined {
  const withPerf = product.sousJacents.filter((u) => typeof u.perf === 'number')
  if (withPerf.length === 0) return product.sousJacents[0]
  return withPerf.reduce((a, b) => ((a.perf ?? 0) <= (b.perf ?? 0) ? a : b))
}

/** Prochaine observation à venir (>= aujourd'hui). */
export function prochaineObservation(
  product: Product,
  now: Date = new Date(),
): Observation | undefined {
  const today = now.toISOString().slice(0, 10)
  return product.observations.find((o) => o.dateObservation >= today)
}

/** Nombre de mois (arrondi) entre aujourd'hui et la maturité. */
export function moisRestants(product: Product, now: Date = new Date()): number {
  const fin = new Date(product.dateEcheance)
  const months =
    (fin.getFullYear() - now.getFullYear()) * 12 +
    (fin.getMonth() - now.getMonth())
  return Math.max(0, months)
}

/** Avancement dans la vie du produit, entre 0 et 1. */
export function avancement(product: Product, now: Date = new Date()): number {
  const debut = new Date(product.dateConstatationInitiale).getTime()
  const fin = new Date(product.dateEcheance).getTime()
  const t = now.getTime()
  if (fin <= debut) return 0
  return Math.min(1, Math.max(0, (t - debut) / (fin - debut)))
}

/**
 * Situation du produit vis-à-vis de sa barrière de protection, à la manière
 * de vizibility (positive / sans stress / proche de la protection / sous la
 * protection / non classé). Basée sur la perf du worst-of vs la barrière.
 */
export type Situation =
  | 'positive'
  | 'sans_stress'
  | 'proche_protection'
  | 'sous_protection'
  | 'non_classe'

export function situation(product: Product): Situation {
  const wo = worstOf(product)
  const perf = wo?.perf
  if (typeof perf !== 'number') return 'non_classe'

  const terms = product.terms
  const protectionPct =
    terms.kind === 'autocall' ? terms.protectionPct : undefined
  const niveau = 100 + perf // niveau du sous-jacent en % de l'initial

  if (perf >= 0) return 'positive'
  if (protectionPct === undefined) return 'sans_stress'
  const marge = niveau - protectionPct // points au-dessus de la barrière
  if (niveau < protectionPct) return 'sous_protection'
  if (marge <= 10) return 'proche_protection'
  return 'sans_stress'
}

/** Coupon annualisé indicatif, si défini. */
export function couponPa(product: Product): number | undefined {
  return product.terms.kind === 'autocall' ? product.terms.couponPa : undefined
}

const MOIS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

/** Formate une date ISO en "j mois aaaa" (fr). */
export function formatDateFr(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export function formatPct(v?: number, digits = 2): string {
  if (typeof v !== 'number') return '—'
  return `${v.toFixed(digits)}%`
}

export function formatMontant(v: number, devise: string): string {
  return `${v.toLocaleString('fr-FR')} ${devise}`
}
