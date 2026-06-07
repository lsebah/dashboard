// ─────────────────────────────────────────────────────────────────────────
//  Registre des coupons (write-once, mis à jour de façon INCRÉMENTALE).
//  Le résultat d'un coupon à une date d'observation PASSÉE est un FAIT : une
//  fois constaté (payé / manqué), on l'enregistre ici et on ne le recalcule
//  plus. Source de vérité du P&L coupons-inclus, sans refetch quotidien.
//
//  Comment on alimente ce registre (selon la classe d'actif) :
//   • Actions worst-of  → niveau Yahoo au jour d'observation vs barrière coupon.
//   • Taux (CMS 10Y…)   → EUR CMS 10Y (EURIRS10Y= sur investing.com) vs barrière.
//   • Crédit / indices  → constat manuel.
//  Dans tous les cas, c'est la TERMSHEET qui définit la barrière et la mémoire ;
//  on n'enregistre QUE des dates d'observation déjà passées et constatées.
//
//  Statut par date :  "paye"  = condition du coupon remplie (coupon versé,
//                               + rattrapage mémoire géré par le moteur) ;
//                      "manque" = condition non remplie (perdu, ou mis en
//                               mémoire si le produit a l'effet mémoire).
// ─────────────────────────────────────────────────────────────────────────
import data from './coupons-ledger.json'

export type CouponOutcome = 'paye' | 'manque'

const LEDGER = data as Record<string, Record<string, CouponOutcome>>

/** Résultat enregistré du coupon d'un produit à une date d'observation, le cas échéant. */
export function couponLedger(isin: string, date: string): CouponOutcome | undefined {
  return LEDGER[isin]?.[date]
}

/** Toutes les dates déjà constatées pour un produit (pour le suivi incrémental). */
export function ledgerOf(isin: string): Record<string, CouponOutcome> | undefined {
  return LEDGER[isin]
}
