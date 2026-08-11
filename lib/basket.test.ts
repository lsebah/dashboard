import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateBasket, basketPerf } from './lifecycle.ts'
import type { Product, BasketType } from './types.ts'

const P = (basket: BasketType, perfs: (number | undefined)[]): Product =>
  ({
    id: 'X',
    nom: 'x',
    isin: 'X',
    emetteur: 'E',
    assetClass: 'equity',
    family: 'autocall',
    devise: 'EUR',
    nominal: 0,
    dateConstatationInitiale: '',
    dateEmission: '',
    dateConstatationFinale: '',
    dateEcheance: '',
    frequence: 'annuel',
    basket,
    sousJacents: perfs.map((perf, i) => ({ nom: `u${i}`, perf })),
  }) as Product

test('aggregateBasket : worst-of = min', () => {
  assert.equal(aggregateBasket([90, 100, 110], 'worst_of'), 90)
})
test('aggregateBasket : best-of = max', () => {
  assert.equal(aggregateBasket([90, 100, 110], 'best_of'), 110)
})
test('aggregateBasket : équipondéré = moyenne', () => {
  assert.equal(aggregateBasket([90, 100, 110], 'equipondere'), 100)
})
test('aggregateBasket : single = la valeur', () => {
  assert.equal(aggregateBasket([103], 'single'), 103)
})

test('basketPerf équipondéré = moyenne des perfs', () => {
  assert.ok(Math.abs((basketPerf(P('equipondere', [-5, 10, 3])) ?? 0) - 8 / 3) < 1e-9)
})
test('basketPerf worst-of = pire perf', () => {
  assert.equal(basketPerf(P('worst_of', [-5, 10, 3])), -5)
})
test('basketPerf équipondéré partiel → undefined (moyenne partielle interdite)', () => {
  assert.equal(basketPerf(P('equipondere', [-5, undefined, 3])), undefined)
})
test('basketPerf worst-of partiel → borne sur les perfs dispo', () => {
  assert.equal(basketPerf(P('worst_of', [-5, undefined, 3])), -5)
})
