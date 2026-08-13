// ─────────────────────────────────────────────────────────────────────────
//  Surcouches de l'interface, vues DEPUIS LE SERVEUR.
//
//  Le problème qu'on répare ici : tout ce qui est saisi dans le terminal
//  (« + Nouveau trade », affectation client, statut forcé Vendu/Rappelé,
//  renommage) est écrit dans le KV et relu par les écrans via des hooks React.
//  Le reporting, lui, tourne côté serveur — /api/clients et /print — et ne lisait
//  QUE les produits statiques du dépôt (termsheets + feed Excel). Conséquence
//  mesurée : les deux tickets ARCHE de la semaine (XS3461528773, XS3468086080),
//  saisis à la main, apparaissaient dans le Portefeuille et dans les Commissions
//  mais n'existaient pas pour le relevé — le client était compté « sans position
//  valorisée ». Symétriquement, un produit marqué Vendu dans l'interface serait
//  resté sur le relevé envoyé au client.
//
//  Les surcouches sont donc lues ici, avec les MÊMES clés que lib/allocations.ts
//  et lib/local-products.ts, pour que l'écran et le PDF disent la même chose.
//
//  Lecture STRICTE : si le KV est configuré mais illisible, on lève. Servir un
//  relevé amputé de ses trades récents (ou incluant une ligne vendue) est pire
//  que ne pas le servir du tout — et l'agent d'envoi s'arrête proprement.
// ─────────────────────────────────────────────────────────────────────────
import { kvConfigured, kvGetResult } from './kv'
import { defaultAllocsOf } from './client-report'
import type { ClientAlloc, Product, ProductStatus } from './types'

/** Clés KV — doivent rester alignées sur app/api/commissions/store/route.ts. */
const CLE_PRODUITS = 'cmf:lifecycle:products:v1'
const CLE_ALLOC = 'cmf:lifecycle:alloc:v1'
const CLE_STATUT = 'cmf:lifecycle:statut:v1'
const CLE_NOMS = 'cmf:lifecycle:noms:v1'

export interface Surcouches {
  produitsLocaux?: Product[] | null
  allocations?: Record<string, ClientAlloc[]> | null
  statuts?: Record<string, ProductStatus> | null
  noms?: Record<string, string> | null
}

export interface ProduitsEffectifs {
  products: Product[]
  /** Allocations effectives d'un produit (surcouche si présente, sinon feed). */
  allocsOf: (p: Product) => ClientAlloc[]
  /** Map brute des allocations — à passer aux composants client (une fonction ne traverse pas la frontière serveur). */
  allocMap: Record<string, ClientAlloc[]>
}

/**
 * Applique les surcouches à la liste statique. Fonction PURE : c'est elle qui
 * porte la règle, et elle est testée indépendamment du KV.
 *
 * Ordre de priorité, du plus fort au plus faible : surcouche saisie → produit
 * du dépôt. Un produit local dont l'ISIN existe déjà dans le dépôt ne crée pas
 * de doublon : il complète la fiche existante.
 */
export function appliquerSurcouches(base: Product[], s: Surcouches): ProduitsEffectifs {
  const allocMap = s.allocations ?? {}
  const statuts = s.statuts ?? {}
  const noms = s.noms ?? {}

  const parIsin = new Map<string, Product>()
  for (const p of base) parIsin.set(p.isin, p)
  // Les produits créés dans l'interface s'ajoutent, ou complètent l'existant.
  for (const p of s.produitsLocaux ?? []) {
    if (!p || typeof p.isin !== 'string' || !p.isin) continue
    const existant = parIsin.get(p.isin)
    parIsin.set(p.isin, existant ? { ...existant, ...p } : p)
  }

  const products = Array.from(parIsin.values()).map((p) => {
    const statut = statuts[p.isin]
    const nom = noms[p.isin]
    if (!statut && !nom) return p
    return { ...p, statut: statut ?? p.statut, nom: nom ?? p.nom }
  })

  return {
    products,
    allocMap,
    allocsOf: (p: Product) => allocMap[p.isin] ?? defaultAllocsOf(p),
  }
}

/** Lit les surcouches dans le KV. Lève si le KV est configuré mais illisible. */
export async function chargerSurcouches(): Promise<Surcouches> {
  if (!kvConfigured()) return {}
  const [produits, allocations, statuts, noms] = await Promise.all([
    kvGetResult<Product[]>(CLE_PRODUITS),
    kvGetResult<Record<string, ClientAlloc[]>>(CLE_ALLOC),
    kvGetResult<Record<string, ProductStatus>>(CLE_STATUT),
    kvGetResult<Record<string, string>>(CLE_NOMS),
  ])
  if (!produits.ok || !allocations.ok || !statuts.ok || !noms.ok)
    throw new Error('Surcouches du terminal illisibles (KV configuré mais injoignable).')
  return {
    produitsLocaux: Array.isArray(produits.value) ? produits.value : null,
    allocations: allocations.value,
    statuts: statuts.value,
    noms: noms.value,
  }
}

/** Produits tels que les voit le terminal — pour /api/clients et /print. */
export async function produitsEffectifs(base: Product[]): Promise<ProduitsEffectifs> {
  return appliquerSurcouches(base, await chargerSurcouches())
}
