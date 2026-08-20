// ─────────────────────────────────────────────────────────────────────────
//  RADAR DE VOLATILITÉ — d'après l'outil « Volatility Radar » de Leonteq
//  (Sébastien Noujaim, 27/08/2024), reproduit sans Bloomberg.
//
//  LECTURE DU RADAR (inchangée par rapport à l'original) :
//   • ordonnée  : le niveau de volatilité ;
//   • abscisse  : le PERCENTILE — part du temps, sur les douze derniers mois,
//                 où la volatilité était PLUS BASSE qu'aujourd'hui ;
//   • en haut à droite : volatilité élevée ET au sommet de son année →
//     candidats aux AUTOCALL (on vend de la vol à un pic) ;
//   • en bas à gauche : volatilité basse ET au creux de son année →
//     candidats aux PARTICIPATIFS (on achète de la vol à un creux).
//
//  ─────────────────────────────────────────────────────────────────────
//  CE QUI CHANGE, ET IL FAUT LE DIRE
//
//  Le radar Leonteq lit une volatilité IMPLICITE ATM 6 mois, obtenue chez
//  Bloomberg par `implied_volatility(pct_moneyness=100, expiry=180d)`, et son
//  percentile par `count(#diff<0)/count(#diff)` sur douze mois de cette même
//  série. Cette donnée n'existe pas gratuitement : aucune source publique ne
//  publie l'historique de la surface implicite 6 mois des indices.
//
//  On calcule donc une volatilité RÉALISÉE, dérivée des seules clôtures
//  quotidiennes — vérifiable, reproductible, et identique d'un indice à
//  l'autre. Ce n'est PAS la même grandeur qu'une implicite : la réalisée dit
//  ce que le marché A FAIT, l'implicite ce qu'il ANTICIPE. Elles se
//  ressemblent, ne se valent pas, et rien ici ne doit laisser croire le
//  contraire — d'où le libellé « réalisée » partout, jusque sur le PDF.
//
//  Là où une vraie implicite publique existe (VIX pour le S&P 500, VSTOXX
//  pour l'Euro Stoxx 50), elle est affichée EN PLUS, étiquetée pour ce
//  qu'elle est : une implicite 30 jours, pas une 6 mois.
//
//  La MÉCANIQUE du percentile, elle, est reprise à l'identique.
// ─────────────────────────────────────────────────────────────────────────

/** Une clôture quotidienne (même forme que lib/yahoo.ts). */
export interface Cloture {
  date: string
  close: number
}

/** Jours de bourse par an — base d'annualisation. */
export const JOURS_BOURSE_AN = 252

/** Fenêtre « 6 mois » en jours de bourse, pour faire écho à l'expiry 180 j. */
export const FENETRE_6M = 126

/** Fenêtre de percentile : douze mois glissants. */
export const FENETRE_PERCENTILE = 252

/** Rendements logarithmiques successifs d'une série de clôtures. */
export function rendements(bars: Cloture[]): number[] {
  const out: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const a = bars[i - 1].close
    const b = bars[i].close
    if (a > 0 && b > 0) out.push(Math.log(b / a))
  }
  return out
}

/**
 * Volatilité réalisée annualisée, en %, sur les `fenetre` derniers rendements.
 * Écart-type d'ÉCHANTILLON (n−1) : c'est la convention de marché, et sur 126
 * points l'écart avec la population est déjà visible à la deuxième décimale.
 * `null` si la fenêtre n'est pas complète — jamais une vol calculée sur trois
 * points et présentée comme une vol 6 mois.
 */
export function volatiliteRealisee(rends: number[], fenetre = FENETRE_6M): number | null {
  if (rends.length < fenetre || fenetre < 2) return null
  const ech = rends.slice(rends.length - fenetre)
  const moyenne = ech.reduce((s, x) => s + x, 0) / ech.length
  const variance = ech.reduce((s, x) => s + (x - moyenne) ** 2, 0) / (ech.length - 1)
  return Math.sqrt(variance) * Math.sqrt(JOURS_BOURSE_AN) * 100
}

/**
 * Série glissante de volatilité réalisée : une valeur par jour de bourse pour
 * lequel la fenêtre est complète. C'est elle dont on prend le percentile.
 */
export function serieVolatilite(
  bars: Cloture[],
  fenetre = FENETRE_6M,
): { date: string; vol: number }[] {
  const rends = rendements(bars)
  const out: { date: string; vol: number }[] = []
  for (let i = fenetre; i <= rends.length; i++) {
    const v = volatiliteRealisee(rends.slice(0, i), fenetre)
    // `bars[i]` : le rendement d'indice i−1 relie bars[i−1] à bars[i].
    if (v != null && bars[i]) out.push({ date: bars[i].date, vol: v })
  }
  return out
}

/**
 * Percentile au sens du radar : part des observations STRICTEMENT
 * inférieures à la valeur courante, en %. C'est la formule Bloomberg de
 * l'outil d'origine — `count(#diff < 0) / count(#diff) × 100` — et donc la
 * réponse à « pendant quelle part du temps la vol était-elle plus basse
 * qu'aujourd'hui ? ».
 *
 * `null` sur série vide : un percentile sans historique ne veut rien dire.
 */
export function percentile(serie: number[], courante: number): number | null {
  if (serie.length === 0) return null
  let sous = 0
  for (const v of serie) if (v < courante) sous++
  return (sous / serie.length) * 100
}

export interface PointRadar {
  cle: string
  nom: string
  /** Volatilité réalisée annualisée courante, en %. */
  vol: number
  /** Percentile sur douze mois, en %. */
  percentile: number
  /** Dernière clôture connue de l'indice. */
  dernierNiveau: number
  /** Date de cette clôture (ISO). */
  dateNiveau: string
  /** Performance sur douze mois glissants, en % — contexte, pas un axe. */
  perf12m: number | null
  /** Nombre d'observations ayant servi au percentile. */
  observations: number
  /** Volatilité implicite publique, quand une existe vraiment (VIX, VSTOXX). */
  implicite?: { valeur: number; nom: string; horizonJours: number } | null
}

/** Performance sur douze mois glissants, en %. */
export function perf12Mois(bars: Cloture[]): number | null {
  if (bars.length < 2) return null
  const fin = bars[bars.length - 1]
  const cible = new Date(fin.date)
  cible.setFullYear(cible.getFullYear() - 1)
  const cibleIso = cible.toISOString().slice(0, 10)
  let debut: Cloture | undefined
  for (const b of bars) {
    if (b.date <= cibleIso) debut = b
    else break
  }
  if (!debut || debut.close <= 0) return null
  return (fin.close / debut.close - 1) * 100
}

/**
 * Construit le point radar d'un indice à partir de son historique de clôtures.
 * `null` si l'historique ne permet pas un calcul honnête (fenêtre incomplète).
 */
export function pointRadar(
  cle: string,
  nom: string,
  bars: Cloture[],
  options: { fenetre?: number; fenetrePercentile?: number } = {},
): PointRadar | null {
  const { fenetre = FENETRE_6M, fenetrePercentile = FENETRE_PERCENTILE } = options
  const serie = serieVolatilite(bars, fenetre)
  if (serie.length === 0) return null

  const courante = serie[serie.length - 1]
  // Douze derniers mois de la série de vol — l'univers du percentile.
  const historique = serie.slice(Math.max(0, serie.length - fenetrePercentile)).map((x) => x.vol)
  const p = percentile(historique, courante.vol)
  if (p == null) return null

  const dernier = bars[bars.length - 1]
  return {
    cle,
    nom,
    vol: courante.vol,
    percentile: p,
    dernierNiveau: dernier.close,
    dateNiveau: dernier.date,
    perf12m: perf12Mois(bars),
    observations: historique.length,
  }
}

/** Quadrant du radar, au sens de la note Leonteq. */
export type Quadrant = 'autocall' | 'participatif' | 'neutre'

/**
 * Lecture du radar. Les seuils (médiane de vol de l'univers, percentile 50)
 * découpent le plan comme dans la note : haut-droite = autocall, bas-gauche =
 * participatif. Tout le reste est « neutre » — on ne force pas une
 * recommandation là où le point est au milieu.
 */
export function quadrant(p: PointRadar, volMediane: number): Quadrant {
  const hautePercentile = p.percentile >= 50
  const hauteVol = p.vol >= volMediane
  if (hautePercentile && hauteVol) return 'autocall'
  if (!hautePercentile && !hauteVol) return 'participatif'
  return 'neutre'
}

/** Médiane d'une série (utilisée comme axe de partage vertical). */
export function mediane(xs: number[]): number {
  if (xs.length === 0) return 0
  const t = [...xs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}
