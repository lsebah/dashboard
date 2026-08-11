import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientCode, computeCoherence, type CommissionLine } from './coherence.ts'
import type { Product } from './types.ts'

const P = (over: Partial<Product>): Product =>
  ({
    id: over.isin ?? 'X',
    nom: 'p',
    isin: over.isin ?? 'X',
    emetteur: 'E',
    assetClass: 'equity',
    family: 'autocall',
    devise: 'EUR',
    nominal: 0,
    dateConstatationInitiale: '',
    dateEmission: '',
    dateConstatationFinale: '',
    dateEcheance: '',
    frequence: 'trimestriel',
    basket: 'single',
    sousJacents: [],
    ...over,
  }) as Product

test('clientCode extrait le code numérique', () => {
  assert.equal(clientCode('OPTIMAL - 01674'), '01674')
  assert.equal(clientCode('SAMY - 01674'), '01674')
  assert.equal(clientCode('RENAUD GESTION PRIVEE'), null)
  assert.equal(clientCode(undefined), null)
})

test('divergence client : même code, nom différent', () => {
  const lignes: CommissionLine[] = [{ isin: 'A', client: 'OPTIMAL - 01674' }]
  const prods = [P({ isin: 'A', clients: ['SAMY - 01674'] })]
  const issues = computeCoherence(lignes, prods)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].type, 'client')
  assert.equal(issues[0].classeur, 'OPTIMAL - 01674')
  assert.equal(issues[0].produit, 'SAMY - 01674')
})

test('même code + même nom → pas de divergence', () => {
  const lignes: CommissionLine[] = [{ isin: 'A', client: 'SAMY - 01674' }]
  const prods = [P({ isin: 'A', clients: ['SAMY - 01674'] })]
  assert.equal(computeCoherence(lignes, prods).length, 0)
})

test('divergence de date au-delà de la tolérance', () => {
  const lignes: CommissionLine[] = [{ isin: 'A', issue: '2026-09-21' }]
  const prods = [P({ isin: 'A', dateEmission: '2026-06-11' })]
  const issues = computeCoherence(lignes, prods)
  assert.equal(issues.filter((i) => i.type === 'date').length, 1)
})

test('écart de date sous la tolérance → rien (trade vs settlement)', () => {
  const lignes: CommissionLine[] = [{ isin: 'A', issue: '2026-01-06' }]
  const prods = [P({ isin: 'A', dateEmission: '2025-12-31' })]
  assert.equal(computeCoherence(lignes, prods).filter((i) => i.type === 'date').length, 0)
})

test('ligne commission orpheline (aucun produit)', () => {
  const lignes: CommissionLine[] = [{ isin: 'ZZ', client: 'X - 00001', description: 'truc' }]
  const issues = computeCoherence(lignes, [])
  assert.equal(issues.length, 1)
  assert.equal(issues[0].type, 'orpheline')
})

test('FEI agrégé : jamais signalé orphelin', () => {
  const lignes: CommissionLine[] = [{ isin: 'FEI', client: 'MACIF' }]
  assert.equal(computeCoherence(lignes, []).filter((i) => i.type === 'orpheline').length, 0)
})
