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

export function composition(cle: string): CompositionIndice | undefined {
  const c = COMPOSITIONS[cle]
  return c && c.membres.length > 0 ? c : undefined
}

/** Ancienneté de la composition, en jours pleins. `Infinity` si inconnue. */
export function ageComposition(cle: string, aujourdhui: Date = new Date()): number {
  const c = COMPOSITIONS[cle]
  if (!c?.majLe) return Number.POSITIVE_INFINITY
  const t = new Date(c.majLe).getTime()
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return Math.floor((aujourdhui.getTime() - t) / 86_400_000)
}

export function compositionPerimee(cle: string, aujourdhui: Date = new Date()): boolean {
  return ageComposition(cle, aujourdhui) > COMPOSITION_PERIMEE_JOURS
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
export function membresRetenus(
  cle: string,
  plafond: number,
): { membres: Membre[]; total: number; tronque: number } {
  const c = composition(cle)
  if (!c) return { membres: [], total: 0, tronque: 0 }
  // Tri par poids décroissant quand la source le publie ; sinon ordre d'origine.
  const tries = c.membres.some((m) => typeof m.poids === 'number')
    ? [...c.membres].sort((a, b) => (b.poids ?? 0) - (a.poids ?? 0))
    : c.membres
  const retenus = tries.slice(0, plafond)
  return { membres: retenus, total: c.membres.length, tronque: Math.max(0, c.membres.length - retenus.length) }
}
