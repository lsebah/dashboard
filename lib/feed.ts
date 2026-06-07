// ─────────────────────────────────────────────────────────────────────────
//  Feed simple (fichier "ISIN + Prix") — la SEULE donnée récurrente/mutable.
//  Source : export `IsinPrix.xlsx` → lib/feed.json. Une ligne = une position
//  (ISIN × client) avec prix mark-to-market, code client et montant investi.
//  Tout le reste (P&L, situation…) en découle ; les définitions produits
//  viennent des termsheets (statiques, write-once).
// ─────────────────────────────────────────────────────────────────────────
import raw from './feed.json'
import type { ClientAlloc, ProductStatus } from './types'

export interface FeedPosition {
  isin: string
  last?: number
  statut?: ProductStatus
  client?: string
  devise?: string
  amount?: number
}

export const positions = raw as unknown as FeedPosition[]

/** ISIN uniques, dans l'ordre du feed. */
export const feedIsins: string[] = (() => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of positions)
    if (!seen.has(p.isin)) {
      seen.add(p.isin)
      out.push(p.isin)
    }
  return out
})()

export const priceByIsin: Record<string, number> = {}
export const statutByIsin: Record<string, ProductStatus> = {}
export const deviseByIsin: Record<string, string> = {}
export const amountByIsin: Record<string, number> = {}
export const allocByIsin: Record<string, ClientAlloc[]> = {}

for (const p of positions) {
  if (typeof p.last === 'number' && priceByIsin[p.isin] === undefined) priceByIsin[p.isin] = p.last
  if (p.statut && !statutByIsin[p.isin]) statutByIsin[p.isin] = p.statut
  if (p.devise && !deviseByIsin[p.isin]) deviseByIsin[p.isin] = p.devise
  if (typeof p.amount === 'number') amountByIsin[p.isin] = (amountByIsin[p.isin] ?? 0) + p.amount
  if (p.client) (allocByIsin[p.isin] ??= []).push({ client: p.client, montant: p.amount })
}
