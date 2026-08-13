// ─────────────────────────────────────────────────────────────────────────
//  Fraîcheur des veilles émetteurs (Décrément & FRN), PAR ÉMETTEUR.
//
//  Pourquoi : la veille décrément s'est arrêtée le 21/07 sans que rien ne le
//  signale — le dashboard affichait des coupons de trois semaines comme s'ils
//  étaient du jour, et la grille FRN était figée depuis 62 jours. Un compteur
//  global ne l'aurait pas vu non plus : d'autres émetteurs continuaient
//  d'arriver, donc « la veille tourne » restait vrai en moyenne.
//
//  On raisonne donc PAR ÉMETTEUR : chacun a sa cadence, et c'est le silence
//  d'un seul émetteur qui trahit une chaîne cassée (règle Outlook, changement
//  d'expéditeur, format de mail modifié…).
// ─────────────────────────────────────────────────────────────────────────

/** Un run daté, normalisé. `date` est une date ISO `YYYY-MM-DD`. */
export interface RunDate {
  emetteur: string
  date: string
}

export interface Fraicheur {
  emetteur: string
  /** Date du run le plus récent (ISO), ou null si l'émetteur n'a aucun run daté. */
  dernier: string | null
  /** Âge en jours entiers, ou null si `dernier` est null. */
  ageJours: number | null
  /** true si l'âge dépasse le SLA (ou si aucun run daté n'existe). */
  perime: boolean
}

/**
 * Normalise une date de run en ISO `YYYY-MM-DD`.
 * Accepte « JJ/MM/AAAA » (comparatif décrément) et « AAAA-MM-JJ » (grille FRN).
 * Renvoie `undefined` si la valeur est absente ou illisible — jamais une date
 * approchée : une date fausse ferait taire l'alarme.
 */
export function normaliseDateRun(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return undefined
}

/** Âge en jours entiers entre une date ISO et `now` (UTC, sans heure). */
export function ageJours(dateIso: string, now: Date): number {
  const j = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
  )
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((n - j) / 86400000)
}

/**
 * Fraîcheur par émetteur. `attendus` permet d'exiger la présence d'émetteurs
 * qui n'ont AUCUN run dans les données : leur silence total est justement le
 * cas le plus grave (ils seraient invisibles si on ne listait que ce qui existe).
 */
export function fraicheurParEmetteur(
  runs: RunDate[],
  opts: { now: Date; slaJours: number; attendus?: string[] },
): Fraicheur[] {
  const dernierPar = new Map<string, string>()
  for (const r of runs) {
    if (!r.emetteur || !r.date) continue
    const cur = dernierPar.get(r.emetteur)
    if (!cur || r.date > cur) dernierPar.set(r.emetteur, r.date)
  }
  for (const e of opts.attendus ?? []) if (!dernierPar.has(e)) dernierPar.set(e, '')

  return [...dernierPar.entries()]
    .map(([emetteur, dernier]) => {
      const age = dernier ? ageJours(dernier, opts.now) : null
      return {
        emetteur,
        dernier: dernier || null,
        ageJours: age,
        perime: age === null || age > opts.slaJours,
      }
    })
    .sort((a, b) => (b.ageJours ?? Infinity) - (a.ageJours ?? Infinity) || a.emetteur.localeCompare(b.emetteur))
}

/** Extrait les runs datés du comparatif décrément (`dateRun` en JJ/MM/AAAA). */
export function runsDecrement(rows: { emetteur?: string; dateRun?: string | null }[]): RunDate[] {
  const out: RunDate[] = []
  for (const r of rows) {
    const date = normaliseDateRun(r.dateRun)
    if (r.emetteur && date) out.push({ emetteur: r.emetteur, date })
  }
  return out
}

/** Extrait les runs datés de la grille FRN (`runDate` en AAAA-MM-JJ). */
export function runsFrn(rows: { issuer?: string; runDate?: string | null }[]): RunDate[] {
  const out: RunDate[] = []
  for (const r of rows) {
    const date = normaliseDateRun(r.runDate)
    if (r.issuer && date) out.push({ emetteur: r.issuer, date })
  }
  return out
}
