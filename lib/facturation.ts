// ─────────────────────────────────────────────────────────────────────────
//  LIGNES À FACTURER — l'onglet Commissions repart de l'ISIN.
//
//  Le registre ne contient que ce qui a DÉJÀ été facturé. Un deal fait mais
//  dont la commission n'a pas encore été saisie n'existait donc nulle part
//  dans l'onglet : ni ligne, ni trou, ni rappel. Constat du 20/08/2026 —
//  44 produits vivants du portefeuille, dont des trades de juin et juillet,
//  n'avaient aucune ligne de facturation.
//
//  Or la structure de Lifecycle est l'ISIN. Commissions doit en partir comme
//  les autres onglets : une ligne par ticket client d'un deal, et la
//  facturation vient s'y ajouter — pas l'inverse.
//
//  CE QUI EST REPRIS, ET RIEN D'AUTRE : l'ISIN, le client et le nominal
//  viennent de l'allocation réelle (export dépositaire), la date d'émission et
//  l'émetteur du produit décodé. UF, rétrocession, montants, facture et
//  encaissement restent VIDES — ce sont eux qu'il reste à saisir, et aucun
//  n'est devinable. Une ligne à facturer pèse donc zéro dans tous les totaux ;
//  seul son nominal est réel, parce qu'il est lu, pas calculé.
// ─────────────────────────────────────────────────────────────────────────
import type { CommissionLigne } from './commissions'
import { ligneKey } from './commissions'
import type { Fiche } from './fiches'

/** Ligne de facturation restant à établir pour un ticket client d'un deal. */
export type LigneAFacturer = CommissionLigne & { aFacturer: true }

/** Statuts qui ferment un produit : plus rien à facturer dessus. */
const CLOS = new Set(['rappele', 'vendu', 'echu'])

/**
 * Tickets clients d'un deal qui n'ont AUCUNE ligne au registre.
 *
 * Un ISIN déjà présent au registre est laissé tel quel, même partiellement :
 * si un client sur trois est facturé, ajouter les deux autres supposerait que
 * le registre est exhaustif ligne à ligne, ce qu'il n'est pas. On ne complète
 * que ce dont on est sûr — un deal dont RIEN n'est facturé.
 */
export function lignesAFacturer(
  fiches: Map<string, Fiche>,
  options: { depuis?: string; inclureClos?: boolean } = {},
): LigneAFacturer[] {
  const { depuis, inclureClos = false } = options
  const out: LigneAFacturer[] = []

  fiches.forEach((f) => {
    if (f.commissions.length > 0) return
    const p = f.produit
    if (!p) return
    if (!inclureClos && CLOS.has(p.statut ?? '')) return
    if (depuis && (f.dateTraite ?? '') < depuis) return

    // Une ligne par allocation client réelle. Sans allocation connue, on émet
    // tout de même une ligne sans client : le deal existe, il doit se voir.
    const allocs =
      p.allocations && p.allocations.length > 0
        ? p.allocations
        : (p.clients ?? []).map((client) => ({ client, montant: undefined }))

    const tickets = allocs.length > 0 ? allocs : [{ client: null as string | null, montant: undefined }]

    for (const a of tickets) {
      out.push({
        isin: f.isin,
        issue: p.dateEmission ?? null,
        client: (a.client as string | null) ?? null,
        emetteur: p.emetteur ?? null,
        description: p.description ?? p.nom ?? null,
        devise: p.devise ?? null,
        nominal: typeof a.montant === 'number' ? a.montant : null,
        // Tout ce qui suit se saisit — rien ne se devine.
        ufPct: null,
        comCmf: null,
        retroPct: null,
        comClient: null,
        comTotal: null,
        facture: null,
        sent: null,
        credited: null,
        split: null,
        net: null,
        aFacturer: true,
      })
    }
  })

  // Ordre stable : du deal le plus récent au plus ancien, puis par client.
  return out.sort(
    (a, b) => (b.issue ?? '').localeCompare(a.issue ?? '') || (a.client ?? '').localeCompare(b.client ?? ''),
  )
}

/** Clés des lignes à facturer — pour les reconnaître dans la vue. */
export function clesAFacturer(lignes: LigneAFacturer[]): Set<string> {
  return new Set(lignes.map((l) => ligneKey(l)))
}
