// ─────────────────────────────────────────────────────────────────────────
//  REVUE CLIENT — quels clients ont traité récemment, et depuis quand.
//
//  Module volontairement SANS dépendance lourde : l'onglet Portefeuille
//  l'importe côté navigateur pour construire ses boutons de filtre. S'il
//  fallait passer par lib/fiches.ts, tout le portefeuille et le registre des
//  commissions partiraient dans le bundle client pour trois dates.
//
//  RÈGLE DE DATE — « traité » désigne le STRIKE (constatation initiale), pas
//  l'émission : les deux diffèrent de plusieurs semaines sur la majorité des
//  lignes, et dater à l'émission ferait sortir de la fenêtre un client qui
//  vient de traiter.
// ─────────────────────────────────────────────────────────────────────────

/** Une détention datée : qui, quoi, quand (date de strike). */
export interface OperationClient {
  client: string
  /** Identifiant du produit (ISIN) — sert à compter les produits distincts. */
  cle: string
  /** Date de traitement (strike). `null` = date inconnue, hors fenêtre. */
  date: string | null
}

export interface ClientActif {
  client: string
  /** Date du dernier produit traité, dans la fenêtre. */
  derniereOperation: string
  /** Produits distincts détenus, TOUTES dates confondues. */
  produits: number
}

/**
 * Premier jour de la fenêtre de revue : le 1er du mois, douze mois plus tôt.
 *
 * La fenêtre est ancrée au 1er du mois et non glissante au jour le jour : la
 * liste des clients est ainsi revue une fois par mois, le 1er, et ne bouge
 * plus entre deux revues. Une liste de filtres qui se réordonne toute seule
 * au fil des jours n'est pas un filtre, c'est une surprise.
 */
export function debutFenetreRevue(aujourdhui: Date = new Date()): Date {
  return new Date(Date.UTC(aujourdhui.getUTCFullYear() - 1, aujourdhui.getUTCMonth(), 1))
}

/**
 * Clients ayant traité depuis le début de la fenêtre, du plus récent au plus
 * ancien. `produits` compte TOUTES leurs détentions, pas seulement celles de
 * la fenêtre : filtrer sur un client doit montrer tout son portefeuille, pas
 * seulement ses douze derniers mois.
 */
export function clientsActifs(
  operations: OperationClient[],
  aujourdhui: Date = new Date(),
): ClientActif[] {
  const debut = debutFenetreRevue(aujourdhui)
  const derniere = new Map<string, string>()
  const produits = new Map<string, Set<string>>()

  for (const op of operations) {
    if (!op.client) continue
    const vus = produits.get(op.client) ?? new Set<string>()
    vus.add(op.cle)
    produits.set(op.client, vus)
    if (!op.date || new Date(op.date) < debut) continue
    const precedent = derniere.get(op.client)
    if (!precedent || op.date > precedent) derniere.set(op.client, op.date)
  }

  return Array.from(derniere.entries())
    .map(([client, derniereOperation]) => ({
      client,
      derniereOperation,
      produits: produits.get(client)?.size ?? 0,
    }))
    .sort((a, b) => b.derniereOperation.localeCompare(a.derniereOperation))
}
