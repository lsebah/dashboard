// ─────────────────────────────────────────────────────────────────────────
//  Pricing FRN — formules PURES (aucun import runtime ⇒ testables via node:test).
//
//  Chaque prix porte : coupon quoté, UF (upfront fee, %), sensibilité (duration),
//  reoffer de base (souvent 100).
//
//  Étape 1 — normalisation à 0 % d'UF :  coupon_0UF = coupon + UF / sensibilité
//  Étape 2 — ajustement au reoffer R   :  coupon_R   = coupon_0UF − (100 − R) / sensibilité
// ─────────────────────────────────────────────────────────────────────────
import type { FrnQuote } from './types'

/** Coupon normalisé à 0 % d'UF. */
export function couponZeroUF(coupon: number, uf: number, sensitivity: number): number {
  return coupon + uf / sensitivity
}

/** Ajuste un coupon (à 0 % d'UF) du reoffer de base R0 vers le reoffer R. */
export function couponAtReoffer(
  coupon0UF: number,
  reoffer: number,
  sensitivity: number,
  baseReoffer = 100,
): number {
  return coupon0UF - (baseReoffer - reoffer) / sensitivity
}

export interface DisplayResult {
  value: number // coupon affiché (%)
  missingSensi: boolean // sensibilité absente ⇒ coupon brut, exclu du « meilleur prix »
}

/**
 * Coupon affiché pour un reoffer donné. Si la sensibilité manque (null/0), on
 * renvoie le coupon brut avec le drapeau `missingSensi` (exclu du meilleur prix).
 */
export function displayedCoupon(
  q: Pick<FrnQuote, 'coupon' | 'uf' | 'sensitivity' | 'baseReoffer'>,
  reoffer: number,
): DisplayResult {
  if (q.sensitivity == null || q.sensitivity === 0) {
    return { value: q.coupon, missingSensi: true }
  }
  const zero = couponZeroUF(q.coupon, q.uf, q.sensitivity)
  return { value: couponAtReoffer(zero, reoffer, q.sensitivity, q.baseReoffer ?? 100), missingSensi: false }
}

/** Meilleur coupon (max) par maturité, en ignorant les prix « sensi manquante ». */
export function bestByMaturity(
  cells: { maturityYears: number; value: number; missingSensi: boolean }[],
): Map<number, number> {
  const best = new Map<number, number>()
  for (const c of cells) {
    if (c.missingSensi) continue
    const cur = best.get(c.maturityYears)
    if (cur === undefined || c.value > cur) best.set(c.maturityYears, c.value)
  }
  return best
}

export const round2 = (n: number): number => Math.round(n * 100) / 100
export const fmt2 = (n: number): string => n.toFixed(2)
