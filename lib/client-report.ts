import type { ClientAlloc, Product } from '@/lib/types'

// Source unique de la logique « reporting client » : utilisée à la fois par le
// PortfolioExplorer (aperçu modal + bouton Imprimer) et par la route /lifecycle/print
// rendue en PDF côté serveur (script reporting_clients.mjs). Garde les deux rendus
// strictement identiques — aucun risque de divergence de mise en forme/contenu.

export interface ReportMaps {
  // ISIN → { nomSousJacent → niveau courant en % du strike } (Yahoo, /api/lifecycle/courant)
  perfMap: Record<string, Record<string, number>>
  // ISIN → { dateObservation → niveau worst-of constaté en % du strike }
  niveauxMap: Record<string, Record<string, number>>
  // ISIN → prix de marché (surcouche Bloomberg/KV, /api/prices)
  priceMap: Record<string, number>
}

const CLOSED = new Set(['rappele', 'vendu', 'echu'])

/** Allocations effectives d'un produit (sans surcouche localStorage). */
export const defaultAllocsOf = (p: Product): ClientAlloc[] =>
  p.allocations ?? p.clients?.map((c) => ({ client: c })) ?? []

/**
 * Injecte les niveaux courants des sous-jacents, le prix de marché de la
 * surcouche et les niveaux constatés aux observations passées. Pure : même
 * sortie pour les mêmes maps (cf. PortfolioExplorer.augment).
 */
export function augmentProduct(p: Product, { perfMap, niveauxMap, priceMap }: ReportMaps): Product {
  const pm = perfMap[p.isin]
  const nv = niveauxMap[p.isin]
  const px = priceMap[p.isin]
  if (!pm && !nv && typeof px !== 'number') return p
  const prixMarche = typeof px === 'number' ? px : p.prixMarche
  const sousJacents = pm
    ? p.sousJacents.map((u) =>
        typeof pm[u.nom] === 'number'
          ? { ...u, perf: Math.round((pm[u.nom] - 100) * 100) / 100 }
          : u,
      )
    : p.sousJacents
  const observations =
    nv && p.observations
      ? p.observations.map((o) =>
          typeof nv[o.dateObservation] === 'number'
            ? { ...o, niveauConstatePct: nv[o.dateObservation] }
            : o,
        )
      : p.observations
  return { ...p, prixMarche, sousJacents, observations }
}

/**
 * Positions d'un client pour le reporting : uniquement celles AVEC un prix
 * (valorisation) et VIVANTES (on exclut rappelé / vendu / échu). Triées par
 * notionnel décroissant, montant = allocation du client.
 */
export function clientReportRows(
  products: Product[],
  client: string,
  maps: ReportMaps,
  allocsOf: (p: Product) => ClientAlloc[] = defaultAllocsOf,
): { p: Product; montant?: number }[] {
  if (!client) return []
  return products
    .filter((p) => allocsOf(p).some((a) => a.client === client))
    .filter(
      (p) =>
        (typeof p.prixMarche === 'number' || typeof maps.priceMap[p.isin] === 'number') &&
        !CLOSED.has(p.statut as string),
    )
    .map((p) => ({
      p: augmentProduct(p, maps),
      montant: allocsOf(p).find((a) => a.client === client)?.montant,
    }))
}

/** Liste triée des clients ayant au moins une position vivante valorisée. */
export function clientsAvecReporting(
  products: Product[],
  maps: ReportMaps,
  allocsOf: (p: Product) => ClientAlloc[] = defaultAllocsOf,
): string[] {
  const set = new Set<string>()
  for (const p of products) {
    if (CLOSED.has(p.statut as string)) continue
    if (typeof p.prixMarche !== 'number' && typeof maps.priceMap[p.isin] !== 'number') continue
    for (const a of allocsOf(p)) if (a.client) set.add(a.client)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
}
