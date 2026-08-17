// ─────────────────────────────────────────────────────────────────────────
//  Un nombre et son unité ne se séparent jamais.
//
//  Constat (Laurent, 17/08/2026) : dans Deal Done, « 6,75 % » se coupait après
//  la virgule décimale — le « % » tombait seul sur la ligne du dessous. Une
//  colonne étroite plus une espace ordinaire suffit : le navigateur considère
//  l'espace comme un point de coupure légitime.
//
//  Deux causes, deux remèdes, tous les deux nécessaires :
//    • l'ESPACE — remplacée par une espace fine insécable (U+202F). C'est aussi
//      la typographie française correcte devant %, € ou $, et c'est déjà celle
//      que produit `toLocaleString('fr-FR')` pour les milliers. Le couple
//      devient un mot unique : plus aucune coupure possible, où que ce soit.
//    • la LARGEUR — une insécable trop large pour sa colonne déborde au lieu de
//      se couper. Les colonnes concernées ont été élargies en conséquence ;
//      sans quoi on remplacerait un retour à la ligne par un chevauchement.
//
//  Les textes libres (descriptions de produits : « barrière à 95 % », « −5 %
//  par trimestre ») sont soumis au même défaut. `insecable()` les traite à
//  l'AFFICHAGE : la donnée transcrite du mail reste intacte, seul le rendu est
//  corrigé.
// ─────────────────────────────────────────────────────────────────────────

/** Espace fine insécable (U+202F) — celle de la typographie française. */
export const ESPACE_FINE = ' '

/**
 * Nombre + « % » indissociables. `digits` fixe la précision ; sans lui, le
 * nombre est rendu tel quel (virgule décimale française).
 * Renvoie `repli` si la valeur n'est pas un nombre — jamais « — % ».
 */
export function pourcent(
  v: number | null | undefined,
  digits?: number,
  repli = '—',
): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return repli
  const n = typeof digits === 'number' ? v.toFixed(digits) : String(v)
  return `${n.replace('.', ',')}${ESPACE_FINE}%`
}

/** Idem, précédé du signe pour une variation (« +1,20 % », « −0,30 % »). */
export function pourcentSigne(
  v: number | null | undefined,
  digits = 2,
  repli = '—',
): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return repli
  return `${v >= 0 ? '+' : ''}${pourcent(v, digits)}`
}

/**
 * Rend insécables les unités déjà présentes dans un texte libre : « 95 % »,
 * « 300 000 € », « 12 M€ ». Ne touche à rien d'autre.
 *
 * Appliqué au RENDU uniquement — jamais à la donnée stockée, qui doit rester la
 * transcription littérale du mail ou de la termsheet.
 */
export function insecable(texte?: string | null): string {
  if (!texte) return ''
  return texte.replace(/(\d)[  ](?=%|€|\$|£|M€|K€|k€)/g, `$1${ESPACE_FINE}`)
}
