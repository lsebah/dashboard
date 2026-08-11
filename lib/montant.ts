// ─────────────────────────────────────────────────────────────────────────
//  Parseur de montant unique — saisie utilisateur (nominal investi par compte).
//
//  Il existait TROIS implémentations divergentes, toutes fausses :
//    ClientAssign.tsx:50      Number(s.replace(/[^\d.]/g, ''))
//        → supprime la virgule décimale : « 250000,50 » devient 25 000 050
//          (×100) et « 250 000,5 » — le format fr-FR — devient 2 500 005 (×10).
//    ClientAssign.tsx:64 et PortfolioExplorer.tsx:437
//        Number(s.replace(/[^\d.,]/g, '').replace(',', '.'))
//        → le .replace(',', '.') n'est PAS global : « 1,234,567 » devient
//          « 1.234,567 » → NaN → montant effacé SANS message.
//
//  Ce montant est le nominal du compte : il alimente l'encours, le P&L, les
//  répartitions et le relevé envoyé au client. Une erreur ici se propage partout.
//
//  Règles retenues (formats réellement saisis en France) :
//    • séparateurs de milliers ignorés : espace, espace insécable (U+00A0),
//      espace fine insécable (U+202F) — celle que produit toLocaleString('fr-FR') —
//      et apostrophe ;
//    • séparateur décimal : virgule OU point (mais pas les deux mélangés de
//      façon ambiguë : la DERNIÈRE occurrence fait foi) ;
//    • une virgule/point suivi de 3 chiffres ET répété est un séparateur de
//      milliers (« 1,234,567 » = 1234567) ;
//    • toute saisie non interprétable renvoie `undefined` — l'appelant DOIT
//      la traiter comme un refus, jamais comme un zéro.
// ─────────────────────────────────────────────────────────────────────────

/** Espaces utilisés comme séparateurs de milliers (dont U+202F de fr-FR). */
const ESPACES = /[\s  ']/g

/**
 * Convertit une saisie utilisateur en montant numérique.
 * Renvoie `undefined` si la saisie est vide, illisible, négative ou nulle —
 * jamais une valeur approchée.
 */
export function parseMontant(input: string | number | null | undefined): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : undefined
  if (input == null) return undefined

  const brut = String(input).replace(ESPACES, '')
  // Un montant négatif est un refus, pas une valeur : sans ce test, le retrait
  // des caractères non numériques transformerait « -100 » en 100.
  if (/^-/.test(brut.trim())) return undefined

  // Retrait de tout ce qui n'est ni chiffre ni séparateur.
  let s = brut.replace(/[^\d.,]/g, '')
  if (!s) return undefined

  const virgules = (s.match(/,/g) ?? []).length
  const points = (s.match(/\./g) ?? []).length

  if (virgules && points) {
    // Les deux présents : le DERNIER rencontré est le séparateur décimal,
    // l'autre est un séparateur de milliers (ex. « 1.234.567,89 » ou « 1,234,567.89 »).
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const millier = decimal === ',' ? '.' : ','
    s = s.split(millier).join('')
    s = s.replace(decimal, '.')
  } else if (virgules > 1 || points > 1) {
    // Répété : séparateur de milliers (« 1,234,567 » / « 1.234.567 »).
    s = s.replace(/[.,]/g, '')
  } else if (virgules === 1 || points === 1) {
    const sep = virgules ? ',' : '.'
    const apres = s.length - s.indexOf(sep) - 1
    // Un unique séparateur suivi d'exactement 3 chiffres est ambigu
    // (« 1,234 »). On tranche en séparateur de MILLIERS : c'est le cas
    // dominant sur des nominaux, toujours ronds en pratique.
    s = apres === 3 ? s.replace(sep, '') : s.replace(sep, '.')
  }

  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : undefined
}
