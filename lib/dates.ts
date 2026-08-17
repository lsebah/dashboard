// ─────────────────────────────────────────────────────────────────────────
//  Format de date unique pour tout Lifecycle.
//
//  Règle posée par Laurent (17/08/2026) : JJ/MM/AA sur TOUS les onglets et tous
//  les champs de date. Deux chiffres d'année suffisent — dans des tableaux
//  denses, les deux caractères gagnés reviennent à la colonne utile.
//
//  Il existait cinq formateurs locaux qui divergeaient (`toLocaleDateString`
//  rendait JJ/MM/AAAA ici, un `split('-').reverse()` faisait la même chose
//  ailleurs, et un seul écran affichait déjà JJ/MM/AA). Une règle d'affichage
//  répétée à cinq endroits finit toujours par n'être appliquée qu'à quatre.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Date ISO (`AAAA-MM-JJ`, horodatage accepté) → `JJ/MM/AA`.
 * Renvoie `repli` si la valeur est absente ou illisible — jamais une date
 * approchée, jamais une chaîne tronquée au hasard.
 */
export function dateFr(iso?: string | null, repli = '—'): string {
  if (!iso) return repli
  const s = String(iso).trim()
  // Chemin direct pour une date déjà ISO : pas de fuseau, donc pas de décalage
  // d'un jour selon l'heure d'exécution.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return repli
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getFullYear(),
  ).slice(2)}`
}

/** `JJ/MM` — pour les colonnes très étroites où l'année est déjà connue. */
export function jourMois(iso?: string | null, repli = '—'): string {
  const f = dateFr(iso, '')
  return f ? f.slice(0, 5) : repli
}
