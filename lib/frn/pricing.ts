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
  missingSensi: boolean // sensi absente du run ⇒ duration ESTIMÉE (proxy)
  sensiUsed: number // sensibilité retenue (fournie par le run, sinon estimée)
}

/**
 * Sensibilité (duration modifiée) estimée d'un FRN à coupon fixe coté ~au pair,
 * quand le run ne fournit pas de sensi. Proxy par/bullet :
 *   Macaulay = ((1+y)/y)·(1 − (1+y)^−n)   puis   D_mod = Macaulay / (1+y)
 * (y ≈ coupon). Approximation — pour un callable la duration effective est plus
 * courte, mais cela rend le retraitement au reoffer exploitable sur TOUTES les lignes.
 */
export function estimateSensitivity(maturityYears: number, coupon: number): number {
  const y = Math.max(coupon / 100, 1e-4)
  const n = Math.max(maturityYears, 0.5)
  const macaulay = ((1 + y) / y) * (1 - Math.pow(1 + y, -n))
  return round2(macaulay / (1 + y))
}

/**
 * Coupon affiché pour un reoffer donné. Utilise la sensi du run si fournie ;
 * sinon une duration ESTIMÉE (proxy) pour que le retraitement s'applique quand même.
 */
export function displayedCoupon(
  q: Pick<FrnQuote, 'coupon' | 'uf' | 'sensitivity' | 'baseReoffer'> & Partial<Pick<FrnQuote, 'maturityYears'>>,
  reoffer: number,
): DisplayResult {
  const provided = q.sensitivity != null && q.sensitivity > 0
  const sensi = provided ? (q.sensitivity as number) : estimateSensitivity(q.maturityYears ?? 5, q.coupon)
  const zero = couponZeroUF(q.coupon, q.uf, sensi)
  return {
    value: couponAtReoffer(zero, reoffer, sensi, q.baseReoffer ?? 100),
    missingSensi: !provided,
    sensiUsed: sensi,
  }
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
