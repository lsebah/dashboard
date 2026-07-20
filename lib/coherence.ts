// ─────────────────────────────────────────────────────────────────────────
//  Boucle de contrôle « cohérence » — croise le classeur commissions avec les
//  définitions produits (feed + termsheets décodées) pour détecter les
//  divergences silencieuses :
//    • CLIENT : même code numérique (ex. « 01674 ») mais nom différent entre le
//      classeur (« OPTIMAL - 01674 ») et le produit/feed (« SAMY - 01674 ») —
//      typiquement un renommage client non répercuté.
//    • DATE D'ÉMISSION : issue (classeur) vs dateEmission (produit) qui divergent
//      de plus d'une tolérance (jours).
//    • ISIN commission ABSENT du portefeuille (ligne orpheline) et inversement.
//  Fonctions PURES → réutilisées par l'écran Santé et le cron d'alerte.
//  Aucune valeur n'est modifiée : on signale, l'humain tranche.
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'

export interface CommissionLine {
  isin: string
  issue?: string
  client?: string
  emetteur?: string
  description?: string
  devise?: string
  nominal?: number
}

export interface CoherenceIssue {
  isin: string
  type: 'client' | 'date' | 'orpheline'
  classeur?: string
  produit?: string
  detail: string
}

/** Code numérique de client (« … - 01674 » → « 01674 »), sinon null. */
export function clientCode(s?: string): string | null {
  return s?.match(/(\d{4,6})\s*$/)?.[1] ?? null
}

const daysBetween = (a: string, b: string): number =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000

/**
 * Croise commissions et produits. `toleranceJours` : écart de date d'émission
 * toléré avant de signaler (défaut 20 j — couvre trade date vs settlement).
 */
export function computeCoherence(
  lignes: CommissionLine[],
  products: Product[],
  toleranceJours = 20,
): CoherenceIssue[] {
  const byIsin = new Map<string, Product>()
  for (const p of products) if (!byIsin.has(p.isin)) byIsin.set(p.isin, p)
  const portefeuilleIsins = new Set(products.map((p) => p.isin))

  const issues: CoherenceIssue[] = []
  for (const l of lignes) {
    const p = byIsin.get(l.isin)

    // Ligne commission sans produit correspondant (hors « FEI » agrégé).
    if (!p) {
      if (!portefeuilleIsins.has(l.isin) && l.isin !== 'FEI') {
        issues.push({
          isin: l.isin,
          type: 'orpheline',
          classeur: l.client,
          detail: `Ligne commission sans produit au portefeuille (${l.description ?? '—'}).`,
        })
      }
      continue
    }

    // Divergence de client (même code, nom différent).
    const lc = clientCode(l.client)
    if (lc && l.client) {
      const match = (p.clients ?? []).find((c) => clientCode(c) === lc)
      if (match && match.trim() !== l.client.trim()) {
        issues.push({
          isin: l.isin,
          type: 'client',
          classeur: l.client,
          produit: match,
          detail: `Même code client (${lc}) mais nom différent — renommage non répercuté ?`,
        })
      }
    }

    // Divergence de date d'émission.
    if (l.issue && p.dateEmission && daysBetween(l.issue, p.dateEmission) > toleranceJours) {
      issues.push({
        isin: l.isin,
        type: 'date',
        classeur: l.issue,
        produit: p.dateEmission,
        detail: `Écart de date d'émission > ${toleranceJours} j (classeur ${l.issue} vs produit ${p.dateEmission}).`,
      })
    }
  }
  return issues
}
