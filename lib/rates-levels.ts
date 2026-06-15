// ─────────────────────────────────────────────────────────────────────────
//  Niveaux COURANTS des taux de référence (extraction manuelle / quotidienne).
//  Sources : EUR CMS 10Y = EURIRS10Y= (investing.com) · TEC 10 = France 10Y
//  (investing.com) · Euribor 3M = euribor-rates.eu. À tenir à jour ici (write
//  une valeur = niveau du jour) pour afficher « strike vs niveau actuel » sur
//  les produits de taux. Valeur absente ⇒ « — ».
// ─────────────────────────────────────────────────────────────────────────
import data from './rates-levels.json'

const LEVELS = data as Record<string, number>

/** Niveau courant (%) d'un taux de référence, s'il est renseigné. */
export function rateNow(ref?: string): number | undefined {
  return ref ? LEVELS[ref] : undefined
}
