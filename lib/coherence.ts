// ─────────────────────────────────────────────────────────────────────────
//  Boucle de contrôle « cohérence » — croise le registre des commissions avec
//  les définitions produits (feed + termsheets décodées) pour détecter les
//  divergences silencieuses :
//    • CLIENT : même code numérique (ex. « 01674 ») mais nom différent entre le
//      registre (« OPTIMAL - 01674 ») et le produit/feed (« SAMY - 01674 ») —
//      typiquement un renommage client non répercuté. Les libellés confirmés
//      comme désignant un même compte sont déclarés dans ALIAS_CLIENT.
//    • DATE D'ÉMISSION : issue (registre) vs dateEmission (produit) qui divergent
//      de plus d'une tolérance (jours). Arbitre : la TERMSHEET, jamais le nom du
//      fichier de termsheet (il dérive de dateEmission, et s'est révélé faux).
//    • ISIN commission ABSENT du portefeuille (ligne orpheline) et inversement.
//  Fonctions PURES → réutilisées par l'écran Santé et le cron d'alerte.
//  Aucune valeur n'est modifiée : on signale, l'humain tranche.
//
//  NOTE DE VOCABULAIRE — le champ `classeur` d'une CoherenceIssue désigne la
//  valeur telle qu'elle figure dans le REGISTRE DES COMMISSIONS DE LIFECYCLE
//  (lib/commissions.json, affiché sous « classeur Lifecycle » dans l'onglet
//  Commissions). Ce n'est plus un export d'un fichier Excel externe : Lifecycle
//  est la source. Corriger une valeur ici est donc définitif — rien ne viendra
//  l'écraser au prochain export.
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
  type: 'client' | 'date' | 'orpheline' | 'emission'
  classeur?: string
  produit?: string
  detail: string
}

/** Code numérique de client (« … - 01674 » → « 01674 »), sinon null. */
export function clientCode(s?: string): string | null {
  return s?.match(/(\d{4,6})\s*$/)?.[1] ?? null
}

/** Partie « nom » d'un libellé client (« OPTIMAL - 01674 » → « OPTIMAL »). */
const racineClient = (s: string): string =>
  s.replace(/\s*-\s*\d{4,6}\s*$/, '').trim().toUpperCase()

/**
 * Libellés différents désignant le MÊME compte. Le classeur et le portefeuille
 * n'ont pas toujours été renommés en même temps ; sans cette table, le contrôle
 * signale six « divergences » par run sur des lignes parfaitement correctes, et
 * le bruit finit par masquer les vraies.
 *
 * N'ajouter une entrée qu'après confirmation explicite qu'il s'agit du même
 * compte — c'est la seule chose qui distingue un alias d'une erreur de saisie.
 */
const ALIAS_CLIENT: Record<string, string> = {
  // Confirmé par Laurent (13/08/2026) : « Optimal est pareil que SAMY, c'est le
  // même compte » — compte 01674, Optimal Finance / Samy Denommé.
  OPTIMAL: 'SAMY',
}

const canonique = (s: string): string => {
  const r = racineClient(s)
  return ALIAS_CLIENT[r] ?? r
}

/** Vrai si deux libellés désignent le même compte (alias compris). */
export function memeClient(a: string, b: string): boolean {
  return canonique(a) === canonique(b)
}

/**
 * Pseudo-ISIN agrégeant PLUSIEURS tranches sous une seule ligne (dette privée).
 * Chaque tranche a sa propre date d'émission : les comparer à la date unique du
 * produit agrégé produit une divergence à chaque tranche, sans rien signaler de
 * réel. Ces codes sont donc exclus des contrôles qui supposent 1 ligne = 1 titre.
 */
const ISIN_AGREGE = new Set(['FEI'])

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

    // Ligne commission sans produit correspondant (hors lignes agrégées).
    if (!p) {
      if (!portefeuilleIsins.has(l.isin) && !ISIN_AGREGE.has(l.isin)) {
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
      if (match && match.trim() !== l.client.trim() && !memeClient(match, l.client)) {
        issues.push({
          isin: l.isin,
          type: 'client',
          classeur: l.client,
          produit: match,
          detail: `Même code client (${lc}) mais nom différent — renommage non répercuté ?`,
        })
      }
    }

    // Divergence de date d'émission (hors lignes agrégées multi-tranches).
    if (
      l.issue &&
      p.dateEmission &&
      !ISIN_AGREGE.has(l.isin) &&
      daysBetween(l.issue, p.dateEmission) > toleranceJours
    ) {
      issues.push({
        isin: l.isin,
        type: 'date',
        classeur: l.issue,
        produit: p.dateEmission,
        detail: `Écart de date d'émission > ${toleranceJours} j (classeur ${l.issue} vs produit ${p.dateEmission}).`,
      })
    }
  }

  issues.push(...emissionAvantStrike(products))
  return issues
}

/**
 * Un produit ne peut pas être ÉMIS avant d'être CONSTATÉ : la constatation
 * initiale fixe le niveau de départ, l'émission vient après. Une date
 * d'émission antérieure au strike n'est donc pas une approximation, c'est un
 * autre événement rangé dans le mauvais champ — presque toujours la date de
 * TRADE (cas FR1459ABG521 : 11/06 dans le champ émission, alors que le mail de
 * facturation dit « Trade Date 12/06/2026 · Issue Date 21/09/2026 »).
 *
 * Le contrôle ne CORRIGE rien : il signale. La bonne date ne se déduit pas, elle
 * se lit dans la termsheet ou le mail de l'émetteur.
 */
export function emissionAvantStrike(products: Product[]): CoherenceIssue[] {
  const issues: CoherenceIssue[] = []
  for (const p of products) {
    if (!p.dateEmission || !p.dateConstatationInitiale) continue
    if (p.dateEmission >= p.dateConstatationInitiale) continue
    const j = Math.round(daysBetween(p.dateEmission, p.dateConstatationInitiale))
    issues.push({
      isin: p.isin,
      type: 'emission',
      produit: p.dateEmission,
      classeur: p.dateConstatationInitiale,
      detail: `Émission ${p.dateEmission} ANTÉRIEURE au strike ${p.dateConstatationInitiale} (${j} j) — impossible : le champ « date d'émission » contient probablement une date de trade.`,
    })
  }
  return issues
}
