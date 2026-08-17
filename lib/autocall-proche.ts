// ─────────────────────────────────────────────────────────────────────────
//  « Autocall probable dans les 30 jours » — la liste qui décide de la semaine.
//
//  Un produit est signalé quand TROIS conditions sont réunies :
//    1. il est vivant (ni rappelé, ni vendu, ni échu) ;
//    2. sa prochaine observation tombe dans la fenêtre (30 jours par défaut) ;
//    3. le niveau COURANT du panier a déjà franchi la barrière de rappel.
//
//  Le sens compte : un autocall INVERSE se déclenche à la BAISSE. Comparer
//  toujours « niveau ≥ barrière » signalerait exactement les produits qui ne
//  vont pas être rappelés, et tairait ceux qui le seront.
//
//  Rien n'est extrapolé : sans niveau courant connu, sans barrière décodée ou
//  sur une période de non-call, le produit n'est PAS signalé. Une liste qui
//  contient des faux positifs cesse d'être lue.
// ─────────────────────────────────────────────────────────────────────────
import type { Observation, Product } from './types'
import { prochaineObservation, rappelConstate } from './lifecycle'

export interface AutocallProche {
  isin: string
  nom: string
  emetteur: string
  /** Date de l'observation qui peut déclencher le rappel (ISO). */
  dateObservation: string
  /** Jours calendaires d'ici là (0 = aujourd'hui). */
  joursRestants: number
  /** Niveau courant du panier, en % du strike. */
  niveau: number
  /** Barrière de rappel de cette observation, en % du strike. */
  barriere: number
  /** Marge au-dessus (ou en dessous, si inverse) de la barrière, en points. */
  marge: number
  /** Vrai pour un autocall inverse — le rappel se déclenche à la baisse. */
  inverse: boolean
  nominal: number
  devise: string
  clients: string[]
}

const jours = (a: string, b: Date): number =>
  Math.round((new Date(a).getTime() - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / 86_400_000)

const vivant = (p: Product): boolean =>
  p.statut !== 'rappele' && p.statut !== 'vendu' && p.statut !== 'echu'

/**
 * Produits dont le rappel est probable à leur prochaine observation, si celle-ci
 * tombe dans les `horizonJours` prochains jours.
 *
 * `niveaux` : niveau courant du panier par ISIN, en % du strike (source :
 * /api/lifecycle/courant, qui agrège déjà selon le type de panier). Un ISIN
 * absent ou `null` est ignoré — jamais remplacé par une valeur de repli.
 */
export function autocallsProbables(
  produits: Product[],
  niveaux: Record<string, number | null | undefined>,
  aujourdHui: Date = new Date(),
  horizonJours = 30,
): AutocallProche[] {
  const out: AutocallProche[] = []
  for (const p of produits) {
    if (!vivant(p)) continue
    const obs = prochaineObservation(p, aujourdHui)
    if (!obs || obs.autocallActif === false) continue
    if (typeof obs.niveauRappelPct !== 'number') continue

    const d = jours(obs.dateObservation, aujourdHui)
    if (d < 0 || d > horizonJours) continue

    const niveau = niveaux[p.isin]
    if (typeof niveau !== 'number') continue

    const inverse = p.terms?.kind === 'autocall' && p.terms.sens === 'inverse'
    const barriere = obs.niveauRappelPct
    const franchie = inverse ? niveau <= barriere : niveau >= barriere
    if (!franchie) continue

    out.push({
      isin: p.isin,
      nom: p.nom,
      emetteur: p.emetteur,
      dateObservation: obs.dateObservation,
      joursRestants: d,
      niveau: Math.round(niveau * 100) / 100,
      barriere,
      // Marge toujours POSITIVE quand la barrière est franchie, quel que soit le sens.
      marge: Math.round((inverse ? barriere - niveau : niveau - barriere) * 100) / 100,
      inverse,
      nominal: p.nominal,
      devise: p.devise,
      clients: p.clients ?? [],
    })
  }
  // Le plus imminent d'abord ; à date égale, la marge la plus confortable
  // (celle dont le rappel est le moins susceptible d'être démenti d'ici là).
  return out.sort(
    (a, b) => a.joursRestants - b.joursRestants || b.marge - a.marge || a.isin.localeCompare(b.isin),
  )
}

/** Ce que la liste n'a PAS pu trancher, avec le motif. */
export interface NonEvalue {
  isin: string
  nom: string
  dateObservation: string
  joursRestants: number
  motif: 'niveau inconnu' | 'barrière non décodée'
}

/** Rappel DÉJÀ déclenché à une observation passée, pas encore acté. */
export interface RappelConstate {
  isin: string
  nom: string
  date: string
  niveau: number
  barriere: number
  nominal: number
  devise: string
  clients: string[]
}

export interface BilanRappels {
  /** Rappel probable à la prochaine observation, dans la fenêtre. */
  probables: AutocallProche[]
  /** Barrière déjà franchie à une observation PASSÉE — à confirmer auprès de l'émetteur. */
  constates: RappelConstate[]
  /** Observation dans la fenêtre mais verdict impossible — l'aveu, pas le silence. */
  nonEvalues: NonEvalue[]
  /** Observation dans la fenêtre mais rappel inactif (non-call) : réponse définitive. */
  nbNonCall: number
}

/**
 * Injecte les niveaux CONSTATÉS aux observations passées dans un produit.
 * Sans eux, `rappelConstate` ne peut rien voir : un produit rappelé il y a deux
 * mois continue d'apparaître comme « rappel probable » à sa prochaine échéance.
 */
export function avecNiveauxConstates(
  p: Product,
  niveaux: Record<string, number> | undefined,
): Product {
  if (!niveaux || Object.keys(niveaux).length === 0) return p
  const observations: Observation[] | undefined = p.observations?.map((o) =>
    typeof niveaux[o.dateObservation] === 'number'
      ? { ...o, niveauConstatePct: niveaux[o.dateObservation] }
      : o,
  )
  return { ...p, observations }
}

/**
 * Bilan complet de la fenêtre : ce qui va probablement être rappelé, ce qui l'a
 * DÉJÀ été sans être acté, et ce qu'on n'a pas pu trancher.
 *
 * Le troisième point est le plus important. Une liste qui se contente d'afficher
 * ce qu'elle sait laisse croire que le reste est calme, alors qu'il est
 * seulement invisible : un sous-jacent sans niveau (indice à décrément absent du
 * run Bloomberg) suffit à faire disparaître un produit sans un mot.
 */
export function bilanRappels(
  produits: Product[],
  niveauxCourants: Record<string, number | null | undefined>,
  niveauxConstates: Record<string, Record<string, number>> = {},
  aujourdHui: Date = new Date(),
  horizonJours = 30,
): BilanRappels {
  const probables: AutocallProche[] = []
  const constates: RappelConstate[] = []
  const nonEvalues: NonEvalue[] = []
  let nbNonCall = 0

  for (const brut of produits) {
    if (!vivant(brut)) continue
    const p = avecNiveauxConstates(brut, niveauxConstates[brut.isin])

    // 1) Rappel déjà DÉCLENCHÉ à une observation passée : le produit n'a plus
    //    d'échéance à surveiller, il a une confirmation à obtenir.
    const rc = rappelConstate(p, aujourdHui)
    if (rc) {
      constates.push({
        isin: p.isin,
        nom: p.nom,
        date: rc.date,
        niveau: rc.niveauPct,
        barriere: rc.barrierePct,
        nominal: p.nominal,
        devise: p.devise,
        clients: p.clients ?? [],
      })
      continue
    }

    const obs = prochaineObservation(p, aujourdHui)
    if (!obs) continue
    const d = jours(obs.dateObservation, aujourdHui)
    if (d < 0 || d > horizonJours) continue

    // 2) Non-call : réponse DÉFINITIVE, pas une lacune. Compté, pas listé.
    if (obs.autocallActif === false) {
      nbNonCall++
      continue
    }
    // 3) Barrière non décodée ou niveau courant absent : verdict impossible.
    if (typeof obs.niveauRappelPct !== 'number') {
      nonEvalues.push({ isin: p.isin, nom: p.nom, dateObservation: obs.dateObservation, joursRestants: d, motif: 'barrière non décodée' })
      continue
    }
    const niveau = niveauxCourants[p.isin]
    if (typeof niveau !== 'number') {
      nonEvalues.push({ isin: p.isin, nom: p.nom, dateObservation: obs.dateObservation, joursRestants: d, motif: 'niveau inconnu' })
      continue
    }

    const inverse = p.terms?.kind === 'autocall' && p.terms.sens === 'inverse'
    const barriere = obs.niveauRappelPct
    if (!(inverse ? niveau <= barriere : niveau >= barriere)) continue

    probables.push({
      isin: p.isin,
      nom: p.nom,
      emetteur: p.emetteur,
      dateObservation: obs.dateObservation,
      joursRestants: d,
      niveau: Math.round(niveau * 100) / 100,
      barriere,
      marge: Math.round((inverse ? barriere - niveau : niveau - barriere) * 100) / 100,
      inverse,
      nominal: p.nominal,
      devise: p.devise,
      clients: p.clients ?? [],
    })
  }

  probables.sort((a, b) => a.joursRestants - b.joursRestants || b.marge - a.marge || a.isin.localeCompare(b.isin))
  constates.sort((a, b) => b.date.localeCompare(a.date))
  nonEvalues.sort((a, b) => a.joursRestants - b.joursRestants || a.isin.localeCompare(b.isin))
  return { probables, constates, nonEvalues, nbNonCall }
}

/** Nominal total exposé à un rappel dans la fenêtre, par devise. */
export function nominalParDevise(liste: AutocallProche[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const a of liste) m[a.devise] = (m[a.devise] ?? 0) + a.nominal
  return m
}
