import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  couponZeroUF,
  couponAtReoffer,
  displayedCoupon,
  bestByMaturity,
  estimateSensitivity,
  round2,
} from './pricing.ts'

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)

test('estimateSensitivity : duration modifiée plausible (10Y @ 4% ≈ 8)', () => {
  const d = estimateSensitivity(10, 4)
  assert.ok(d > 7.5 && d < 8.5, `duration ${d}`)
  // croît avec la maturité
  assert.ok(estimateSensitivity(15, 4) > estimateSensitivity(8, 4))
})

test('displayedCoupon : sensi absente ⇒ duration estimée, le reoffer agit quand même', () => {
  const q = { coupon: 4, uf: 0, sensitivity: null, baseReoffer: 100, maturityYears: 10 }
  const at100 = displayedCoupon(q, 100)
  const at99 = displayedCoupon(q, 99)
  assert.equal(at100.missingSensi, true)
  assert.ok(at100.sensiUsed > 0)
  // le reoffer agit (convention de l'outil : reoffer ↓ ⇒ coupon ↓ de (100−R)/sensi)
  assert.ok(Math.abs(at99.value - at100.value) > 1e-6, `${at99.value} vs ${at100.value}`)
  near(at99.value, at100.value - 1 / at100.sensiUsed)
})

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

test('couponAtReoffer : reoffer de base ≠ 100', () => {
  // coté à 97.5, restaté à 100 ⇒ coupon plus élevé de (100−97.5)/sensi
  near(couponAtReoffer(3.76, 100, 6.21, 97.5), 3.76 + 2.5 / 6.21)
  // restaté au même reoffer ⇒ inchangé
  near(couponAtReoffer(3.76, 97.5, 6.21, 97.5), 3.76)
})

test('displayedCoupon : utilise baseReoffer du quote', () => {
  const r = displayedCoupon({ coupon: 3.76, uf: 0, sensitivity: 6.21, baseReoffer: 97.5 }, 100)
  near(r.value, 3.76 + 2.5 / 6.21)
})

test('displayedCoupon : sensibilité manquante ⇒ duration estimée (flag missingSensi)', () => {
  const r = displayedCoupon({ coupon: 4.2, uf: 0.4, sensitivity: null, maturityYears: 10 }, 99)
  assert.equal(r.missingSensi, true)
  assert.ok(r.sensiUsed > 0) // duration estimée utilisée
  // retraitement appliqué (≠ coupon brut), via UF puis reoffer
  assert.ok(Math.abs(r.value - 4.2) > 1e-6)
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
