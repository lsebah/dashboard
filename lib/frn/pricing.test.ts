import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  couponZeroUF,
  couponAtReoffer,
  displayedCoupon,
  bestByMaturity,
  round2,
} from './pricing.ts'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

test('couponZeroUF : coupon + UF/sensibilité', () => {
  near(couponZeroUF(3.0, 0.3, 3.0), 3.1)
  near(couponZeroUF(2.5, 0.6, 2.0), 2.8)
})

test('couponAtReoffer : retrait (100 − R)/sensibilité', () => {
  near(couponAtReoffer(3.1, 99.5, 3.0), 3.1 - 0.5 / 3.0)
  // reoffer au-dessus du pair ⇒ coupon plus élevé
  near(couponAtReoffer(3.1, 100.5, 3.0), 3.1 + 0.5 / 3.0)
})

test('displayedCoupon : reoffer 100 ⇒ coupon normalisé 0% UF', () => {
  const r = displayedCoupon({ coupon: 3.0, uf: 0.3, sensitivity: 3.0 }, 100)
  assert.equal(r.missingSensi, false)
  near(r.value, 3.1)
})

test('displayedCoupon : reoffer 99.5', () => {
  const r = displayedCoupon({ coupon: 3.0, uf: 0.3, sensitivity: 3.0 }, 99.5)
  near(r.value, 3.1 - 0.5 / 3.0)
})

test('displayedCoupon : sensibilité manquante ⇒ brut + flag', () => {
  const r = displayedCoupon({ coupon: 4.2, uf: 0.4, sensitivity: null }, 99)
  assert.equal(r.missingSensi, true)
  near(r.value, 4.2)
})

test('bestByMaturity : max par maturité, ignore sensi manquante', () => {
  const best = bestByMaturity([
    { maturityYears: 5, value: 3.1, missingSensi: false },
    { maturityYears: 5, value: 3.25, missingSensi: false },
    { maturityYears: 5, value: 9.9, missingSensi: true }, // ignoré
    { maturityYears: 3, value: 2.8, missingSensi: false },
  ])
  near(best.get(5)!, 3.25)
  near(best.get(3)!, 2.8)
})

test('round2', () => {
  assert.equal(round2(2.93333), 2.93)
  assert.equal(round2(3.105), 3.11)
})
