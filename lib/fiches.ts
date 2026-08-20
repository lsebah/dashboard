// ─────────────────────────────────────────────────────────────────────────
//  FICHES PRODUIT — la source unique de Lifecycle, indexée par ISIN.
//
//  Jusqu'ici chaque onglet allait chercher sa propre matière : Portefeuille et
//  Calendrier lisaient `products`, Commissions lisait le registre, Deal Done
//  lisait son JSON et re-piochait au passage strikes et coupons dans
//  `products`. Quatre lectures, quatre vocabulaires, et autant d'occasions de
//  diverger — c'est ainsi qu'un même produit pouvait s'appeler autrement d'un
//  onglet à l'autre, ou n'exister que dans l'un d'eux.
//
//  Une fiche rassemble TOUT ce que Lifecycle sait d'un ISIN : le produit décodé
//  depuis sa termsheet, les lignes du registre des commissions (une par ticket
//  client, avec UF et rétro), les clients qui le détiennent, le lien vers la
//  termsheet du dossier OneDrive. Chaque onglet y puise ce qu'il affiche —
//  Commissions est seul à montrer UF et rétro, mais tous lisent la même fiche.
//
//  RÈGLE DE DATE — « traité » désigne la date de STRIKE (constatation
//  initiale), jamais la date d'émission. Les deux diffèrent sur 65 des 108
//  lignes du registre : dater une opération à l'émission la décale de
//  plusieurs semaines, et fait sortir un client de la fenêtre des 12 mois
//  alors qu'il vient de traiter. Le registre ne connaît que l'émission ; le
//  strike vient du produit décodé, et ne sert de repli que s'il manque.
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'
import { products as tousLesProduits } from './products'
import { commissions, type CommissionLigne } from './commissions'
import { termsheetUrl } from './termsheets'
import { clientCanonique } from './coherence'
import {
  clientsActifs as clientsActifsDepuis,
  debutFenetreRevue,
  type ClientActif,
  type OperationClient,
} from './revue-client'

export { debutFenetreRevue }
export type { ClientActif }

export interface Fiche {
  isin: string
  /** Produit décodé (termsheet). Absent si l'ISIN n'est connu que du registre. */
  produit?: Product
  /** Lignes du registre portant cet ISIN — une par ticket client. */
  commissions: CommissionLigne[]
  /** Clients détenteurs, libellés canoniques, sans doublon. */
  clients: string[]
  /** Date de traitement = strike si connu, sinon émission du registre. */
  dateTraite: string | null
  /** Lien vers la termsheet du dossier OneDrive, si elle est indexée. */
  termsheet?: string
  /** Libellé court, pour un affichage homogène d'un onglet à l'autre. */
  libelle: string
}

/** Date à laquelle un produit a été TRAITÉ (strike), avec repli sur l'émission. */
export function dateTraite(produit: Product | undefined, lignes: CommissionLigne[]): string | null {
  if (produit?.dateConstatationInitiale) return produit.dateConstatationInitiale
  const issues = lignes.map((l) => l.issue).filter((d): d is string => !!d).sort()
  return issues[0] ?? produit?.dateEmission ?? null
}

/** Construit l'index des fiches. Pur : les tests l'appellent avec leurs données. */
export function construireFiches(produits: Product[], lignes: CommissionLigne[]): Map<string, Fiche> {
  const parIsin = new Map<string, Product>()
  for (const p of produits) parIsin.set(p.isin, p)

  const lignesParIsin = new Map<string, CommissionLigne[]>()
  for (const l of lignes) {
    if (!l.isin) continue
    const acc = lignesParIsin.get(l.isin)
    if (acc) acc.push(l)
    else lignesParIsin.set(l.isin, [l])
  }

  // Union : un ISIN connu du seul registre mérite sa fiche autant qu'un produit
  // décodé sans commission. Restreindre à l'un des deux, c'est rendre l'autre
  // invisible — précisément ce qu'on cherche à supprimer.
  const isins = new Set<string>(Array.from(parIsin.keys()))
  lignesParIsin.forEach((_, isin) => isins.add(isin))

  const fiches = new Map<string, Fiche>()
  Array.from(isins).forEach((isin) => {
    const produit = parIsin.get(isin)
    const comms = lignesParIsin.get(isin) ?? []

    const clients = new Set<string>()
    for (const c of produit?.clients ?? []) {
      const k = clientCanonique(c)
      if (k) clients.add(k)
    }
    for (const a of produit?.allocations ?? []) {
      const k = clientCanonique(a.client)
      if (k) clients.add(k)
    }
    for (const l of comms) {
      const k = clientCanonique(l.client)
      if (k) clients.add(k)
    }

    fiches.set(isin, {
      isin,
      produit,
      commissions: comms,
      clients: Array.from(clients).sort(),
      dateTraite: dateTraite(produit, comms),
      termsheet: produit?.termsheetUrl ?? termsheetUrl(isin),
      libelle: produit?.nom ?? produit?.description ?? comms[0]?.description ?? isin,
    })
  })
  return fiches
}

/** Index prêt à l'emploi — la source que lisent les onglets. */
export const fiches: Map<string, Fiche> = construireFiches(tousLesProduits, commissions.lignes)

/** Fiche d'un ISIN, si Lifecycle en connaît une. */
export function fiche(isin: string): Fiche | undefined {
  return fiches.get(isin)
}

/**
 * Clients ayant traité au cours de la fenêtre de revue. Le calcul lui-même vit
 * dans lib/revue-client.ts, que l'onglet Portefeuille importe seul côté
 * navigateur : ici on ne fait que lui présenter les fiches sous forme
 * d'opérations datées.
 */
export function clientsActifs(
  index: Map<string, Fiche> = fiches,
  aujourdhui: Date = new Date(),
): ClientActif[] {
  const operations: OperationClient[] = []
  index.forEach((f) => {
    for (const client of f.clients) operations.push({ client, cle: f.isin, date: f.dateTraite })
  })
  return clientsActifsDepuis(operations, aujourdhui)
}

/** Vrai si la fiche est détenue par ce client (libellés canoniques). */
export function detenuPar(f: Fiche, client: string): boolean {
  return f.clients.includes(client)
}
