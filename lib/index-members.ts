// ─────────────────────────────────────────────────────────────────────────
//  MEMBRES DES INDICES — la composition, et d'où elle vient.
//
//  Le radar de Leonteq se lit sur les COMPOSANTS d'un indice, pas sur
//  l'indice lui-même : c'est là qu'on choisit une valeur pour un autocall ou
//  un participatif. Bloomberg le faisait par `members('SX5E Index')` ; sans
//  lui, il faut une source publique.
//
//  POURQUOI UN FICHIER VERSIONNÉ, ET PAS UN SCRAPING À LA VOLÉE
//
//  La composition d'un indice est une donnée FACTUELLE : si elle est fausse,
//  le radar attribue la volatilité d'une valeur à un indice qui ne la contient
//  pas, et la planche part chez des clients. Un scraping dans le chemin de
//  lecture échoue silencieusement ou renvoie n'importe quoi le jour où la page
//  change de forme, et personne ne le voit.
//
//  La composition est donc rafraîchie par un JOB MENSUEL
//  (scripts/refresh-index-members.mjs), qui écrit ce fichier. Elle passe ainsi
//  par une revue : le diff est lisible avant d'atteindre un PDF client, et le
//  jour où la source casse, le job échoue au lieu d'écrire une liste vide.
//  L'app, elle, ne lit qu'un fichier daté — et dit son âge.
//
//  Cadence demandée par Laurent (20/08/2026) : « révision des membres tous les
//  mois au refresh du radar de vol ».
// ─────────────────────────────────────────────────────────────────────────
import brut from '../data/index-members.json'

export interface Membre {
  /** Symbole Yahoo, celui qui sert à récupérer l'historique. */
  symbole: string
  nom: string
  /** Pondération dans l'indice, en % — quand la source la publie. */
  poids?: number
}

export interface CompositionIndice {
  /** D'où vient la liste, en clair : c'est ce qu'on cite si on la conteste. */
  source: string
  /** Date du dernier rafraîchissement (ISO). */
  majLe: string
  membres: Membre[]
}

export type Compositions = Record<string, CompositionIndice>

export const COMPOSITIONS = brut as unknown as Compositions

/** Au-delà, la composition n'est plus à jour (révision mensuelle). */
export const COMPOSITION_PERIMEE_JOURS = 45

// ─────────────────────────────────────────────────────────────────────────
//  LA SURCOUCHE BLOOMBERG — pour les indices qu'aucune source publique ne rend.
//
//  Le job mensuel rapporte le S&P 500 et le Dow (stockanalysis.com), mais il
//  rentre les mains vides pour le CAC 40, l'Euro Stoxx 50 et le MSCI World :
//  Euronext, STOXX et iShares ne se laissent pas lire par un scraper. Trois
//  indices du radar restaient donc sans composants — c'est-à-dire sans radar.
//
//  Laurent a tranché (21/08/2026) : puisque aucune source internet ne marche
//  pour ces trois-là, la composition passe par le run Bloomberg quotidien qui
//  récupère déjà les prix des produits. Elle arrive par /api/prices/ingest et
//  vit dans le KV, comme la surcouche de prix.
//
//  Elle ne REMPLACE pas le fichier, elle se pose PAR-DESSUS, indice par
//  indice : le fichier reste la référence de ce qu'une source publique sait
//  rendre, et le KV comble le reste. Quand les deux parlent du même indice,
//  c'est le plus récent qui gagne — la même règle que les prix. Un fichier
//  révisé après le dernier run Bloomberg reprend donc la main, parce qu'il est
//  passé, lui, par une relecture humaine.
// ─────────────────────────────────────────────────────────────────────────

/** Clé KV de la surcouche — partagée par la route d'ingestion et le radar. */
export const CLE_KV_MEMBRES = 'indices:membres:overlay'

/**
 * Source citée à l'écran quand la composition vient du terminal. Elle doit
 * nommer Bloomberg : la planche affiche d'où sort sa liste, et cette phrase-là
 * est ce qu'on oppose à quelqu'un qui la conteste.
 */
export const SOURCE_MEMBRES_BLOOMBERG = 'Bloomberg — INDX_MWEIGHT (run quotidien du terminal)'

export interface CompositionSurcouche {
  /** Horodatage du run Bloomberg qui l'a écrite (ISO complet). */
  asof: string
  source?: string
  membres: Membre[]
  /** Membres écartés faute de symbole Yahoo connu — comptés, jamais devinés. */
  ecartes?: number
}

export interface SurcoucheMembres {
  asof: string
  indices: Record<string, CompositionSurcouche>
}

export function composition(cle: string): CompositionIndice | undefined {
  const c = COMPOSITIONS[cle]
  return c && c.membres.length > 0 ? c : undefined
}

/**
 * Composition réellement servie : celle du KV si elle porte cet indice, sinon
 * celle du fichier. Fonction PURE — c'est elle qui porte la règle d'arbitrage,
 * et elle se teste sans KV.
 */
export function compositionEffective(
  cle: string,
  surcouche?: SurcoucheMembres | null,
): CompositionIndice | undefined {
  const fichier = composition(cle)
  const sur = surcouche?.indices?.[cle]
  // Une surcouche vide n'est pas une surcouche : un run Bloomberg qui n'a rien
  // rapporté ne doit pas effacer ce que le fichier tenait déjà.
  if (!sur || !Array.isArray(sur.membres) || sur.membres.length === 0) return fichier
  const majLe = typeof sur.asof === 'string' ? sur.asof.slice(0, 10) : ''
  if (fichier && fichier.majLe > majLe) return fichier
  return {
    source: sur.source?.trim() || SOURCE_MEMBRES_BLOOMBERG,
    majLe,
    membres: sur.membres,
  }
}

/** Ancienneté d'une composition, en jours pleins. `Infinity` si non datée. */
export function ageDepuis(majLe: string | undefined, aujourdhui: Date = new Date()): number {
  if (!majLe) return Number.POSITIVE_INFINITY
  const t = new Date(majLe).getTime()
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Math.floor((aujourdhui.getTime() - t) / 86_400_000)
}

/** Une fraîcheur qu'on ne sait pas dater n'est pas une fraîcheur : périmée. */
export function perimeeDepuis(majLe: string | undefined, aujourdhui: Date = new Date()): boolean {
  return ageDepuis(majLe, aujourdhui) > COMPOSITION_PERIMEE_JOURS
}

/** Ancienneté de la composition du fichier, en jours pleins. */
export function ageComposition(cle: string, aujourdhui: Date = new Date()): number {
  return ageDepuis(COMPOSITIONS[cle]?.majLe, aujourdhui)
}

export function compositionPerimee(cle: string, aujourdhui: Date = new Date()): boolean {
  return perimeeDepuis(COMPOSITIONS[cle]?.majLe, aujourdhui)
}

/**
 * Membres retenus pour le radar, les plus lourds d'abord.
 *
 * Un indice large ne peut pas être tracé en entier : chaque valeur coûte un
 * appel d'historique, et le S&P 500 en demanderait cinq cents. On plafonne
 * donc — mais JAMAIS en silence : `tronque` dit combien de valeurs sont
 * restées dehors, et l'écran l'affiche. Un radar tronqué qui se tait laisse
 * croire que l'univers tient en soixante points.
 */
export function retenirMembres(
  compo: CompositionIndice | undefined,
  plafond: number,
): { membres: Membre[]; total: number; tronque: number } {
  if (!compo) return { membres: [], total: 0, tronque: 0 }
  // Tri par poids décroissant quand la source le publie ; sinon ordre d'origine.
  const tries = compo.membres.some((m) => typeof m.poids === 'number')
    ? [...compo.membres].sort((a, b) => (b.poids ?? 0) - (a.poids ?? 0))
    : compo.membres
  const retenus = tries.slice(0, plafond)
  return {
    membres: retenus,
    total: compo.membres.length,
    tronque: Math.max(0, compo.membres.length - retenus.length),
  }
}

/** Même chose, à partir de la seule composition du fichier. */
export function membresRetenus(
  cle: string,
  plafond: number,
): { membres: Membre[]; total: number; tronque: number } {
  return retenirMembres(composition(cle), plafond)
}
