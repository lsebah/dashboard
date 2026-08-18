// ─────────────────────────────────────────────────────────────────────────
//  Taux de référence (CMS 10Y, OAT 10Y) — fin des valeurs écrites en dur.
//
//  Ces deux taux étaient CODÉS DANS LE FICHIER (3,042 et 3,663) avec le
//  commentaire « no reliable free API ». Ils s'affichaient comme les niveaux
//  du jour alors qu'ils étaient figés depuis leur écriture : le pire des cas,
//  un chiffre faux qui a l'air vrai.
//
//  Ordre de résolution posé par Laurent (17/08/2026) — « normalement ils sont
//  disponibles sur internet, sinon sur Bloomberg » :
//    1. INTERNET (Stooq, cotation de clôture) ;
//    2. sinon la SURCOUCHE BLOOMBERG (`levels:overlay`, alimentée par le run
//       quotidien du PC Bloomberg), aux tickers qu'il a fournis ;
//    3. sinon RIEN — `null`, affiché « — ». Jamais de repli codé en dur.
//
//  La provenance voyage avec la valeur (`source`) : un taux affiché sans
//  qu'on sache d'où il vient ne vaut pas mieux qu'un taux inventé.
// ─────────────────────────────────────────────────────────────────────────

export interface TauxRef {
  cle: string
  nom: string
  /** Ticker Bloomberg exact — clé dans `levels:overlay`. */
  bloomberg: string
  /** Symbole Stooq (cotation libre), quand il en existe un. */
  stooq: string | null
}

export const TAUX_REFERENCE: TauxRef[] = [
  // Swap EUR 10 ans. Aucune cotation libre fiable connue → Bloomberg seul.
  { cle: 'CMS10', nom: 'CMS 10Y', bloomberg: 'EUSA10 BGN Curncy', stooq: null },
  // Rendement de l'OAT 10 ans (France).
  { cle: 'OAT10', nom: 'OAT 10Y', bloomberg: 'GTFRF10YR @BGN Corp', stooq: '10fry.b' },
]

/** Provenance d'un taux — affichée à côté de la valeur. */
export type SourceTaux = 'stooq' | 'bloomberg'

export interface TauxResolu {
  valeur: number
  source: SourceTaux
}

/**
 * Extrait la clôture d'une ligne CSV Stooq.
 * Format : `Symbol,Date,Time,Open,High,Low,Close,Volume`, une ligne d'en-tête
 * puis une ligne de données. Un symbole inconnu renvoie « N/D » partout —
 * traité comme une absence, jamais comme un zéro.
 */
export function clotureStooq(csv: string): number | null {
  const lignes = String(csv ?? '')
    .trim()
    .split(/\r?\n/)
  if (lignes.length < 2) return null
  const entete = lignes[0].split(',').map((c) => c.trim().toLowerCase())
  const iClose = entete.indexOf('close')
  if (iClose < 0) return null
  const cellules = lignes[1].split(',')
  const brut = (cellules[iClose] ?? '').trim()
  if (!brut || /^n\/?d$/i.test(brut)) return null
  const v = Number(brut)
  return Number.isFinite(v) ? v : null
}

/**
 * Applique l'ordre de résolution. `overlay` est la table `levels` de la
 * surcouche Bloomberg, indexée par ticker EXACT.
 *
 * Renvoie `null` quand aucune source ne répond — l'appelant doit alors afficher
 * une absence, pas une valeur de repli.
 */
export function resoudreTaux(
  ref: TauxRef,
  stooq: number | null | undefined,
  overlay: Record<string, number> | null | undefined,
): TauxResolu | null {
  if (typeof stooq === 'number' && Number.isFinite(stooq)) return { valeur: stooq, source: 'stooq' }
  const bbg = overlay?.[ref.bloomberg]
  if (typeof bbg === 'number' && Number.isFinite(bbg)) return { valeur: bbg, source: 'bloomberg' }
  return null
}
