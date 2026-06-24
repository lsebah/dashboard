// ─────────────────────────────────────────────────────────────────────────
//  Classification métier d'un produit (libellé Type, présence/niveau d'airbag).
//  Module pur, sans dépendance React : réutilisé par le portefeuille, le panneau
//  « santé des données » et les tests. Règles métier (cf. spécifications) :
//   - Autocall = Athéna (le terme « Autocall » ne doit plus apparaître) ;
//   - « Airbag »/« Mémoire » implicites → retirés du libellé Type ;
//   - Snowball → Athéna (Airbag) ;
//   - Phoenix Mémoire Dégressif (à ticket) → « Phoenix Ticket Mémoire » ;
//   - tranche de crédit → « CLN Tranche ».
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'

/** Présence d'un airbag : signal décodé de la TS (terms.airbag) ou badge. Un
 *  Snowball est reclassé Athéna Airbag → traité comme airbag ici aussi. */
export function aAirbag(p: Product): boolean {
  return (
    (p.terms?.kind === 'autocall' && p.terms.airbag === true) ||
    (p.badges?.includes('Airbag') ?? false) ||
    (p.badges?.includes('Snowball') ?? false) ||
    /snowball/i.test(p.productType ?? '')
  )
}

/** Niveau d'airbag (%) dérivé de la TS = barrière de protection (PDI). */
export function airbagNiveau(p: Product): number | undefined {
  const t = p.terms
  if (t?.kind === 'autocall' && typeof t.protectionPct === 'number') return t.protectionPct
  if (typeof p.pdiPct === 'number') return p.pdiPct
  return undefined
}

/** Libellé métier de la colonne « Type ». */
export function productTypeLabel(p: Product): string {
  const t = p.terms
  if (t?.kind === 'credit' && t.type === 'tranche') return 'CLN Tranche'
  const raw = (p.productType ?? '').trim()
  const hay = `${raw} ${p.nom ?? ''} ${p.description ?? ''}`
  if (/snowball/i.test(hay) || p.badges?.includes('Snowball')) return 'Athéna'
  if (/phoenix/i.test(hay)) return /d[ée]gressif/i.test(hay) ? 'Phoenix Ticket Mémoire' : 'Phoenix'
  // Vrais autocalls (famille / terms / type explicite). Nature « inverse » préservée.
  if (t?.kind === 'autocall' || p.family === 'autocall' || /autocall|ath[ée]na/i.test(raw)) {
    const inverse = (t?.kind === 'autocall' && t.sens === 'inverse') || /reverse|inverse/i.test(raw)
    return inverse ? 'Athéna inverse' : 'Athéna'
  }
  // Autres familles : on retire un qualificatif « Airbag »/« Mémoire » du libellé
  // (ex. « Participation (Airbag) » → « Participation ») SANS forcer Athéna.
  const s = raw.replace(/\s*\(?\s*airbag\s*\)?/i, ' ').replace(/\s*m[ée]moire/i, ' ').replace(/\s+/g, ' ').trim()
  if (s) return s
  // productType absent → on déduit le type du nom / de la description (évite « — »).
  if (/autocall|ath[ée]na/i.test(hay)) return /reverse|inverse/i.test(hay) ? 'Athéna inverse' : 'Athéna'
  if (/\bTARN\b/i.test(hay)) return 'TARN'
  if (/\bCLN\b/i.test(hay)) return 'CLN'
  if (/quartz/i.test(hay)) return 'Quartz'
  if (/sphinx/i.test(hay)) return 'Sphinx'
  if (/callable/i.test(hay)) return 'Callable'
  if (/participation/i.test(hay)) return 'Participation'
  if (/booster/i.test(hay)) return 'Booster'
  if (/mini.?future/i.test(hay)) return 'Mini Future'
  if (/dette\s+priv/i.test(hay)) return 'Dette Privée'
  return '—'
}
