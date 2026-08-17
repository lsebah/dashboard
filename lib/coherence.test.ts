import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientCode, computeCoherence, emissionAvantStrike, type CommissionLine } from './coherence.ts'
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
  const lignes: CommissionLine[] = [{ isin: 'A', client: 'DUPONT - 01674' }]
  const prods = [P({ isin: 'A', clients: ['MARTIN - 01674'] })]
  const issues = computeCoherence(lignes, prods)
  assert.equal(issues.length, 1)
  assert.equal(issues[0].type, 'client')
  assert.equal(issues[0].classeur, 'DUPONT - 01674')
  assert.equal(issues[0].produit, 'MARTIN - 01674')
})

test('OPTIMAL et SAMY sont le même compte — aucune divergence', () => {
  // Ce cas servait d'exemple de divergence dans ce fichier. Il était faux :
  // Laurent a confirmé (13/08/2026) qu'Optimal Finance et Samy Denommé sont
  // le même compte 01674. Le contrôle signalait six lignes correctes à chaque
  // run — du bruit qui finit par masquer les vraies anomalies.
  const lignes: CommissionLine[] = [{ isin: 'A', client: 'OPTIMAL - 01674' }]
  const prods = [P({ isin: 'A', clients: ['SAMY - 01674'] })]
  assert.deepEqual(computeCoherence(lignes, prods), [])
  // …et dans l'autre sens (le classeur peut porter l'un ou l'autre libellé).
  const inverse: CommissionLine[] = [{ isin: 'A', client: 'SAMY - 01674' }]
  assert.deepEqual(computeCoherence(inverse, [P({ isin: 'A', clients: ['OPTIMAL - 01674'] })]), [])
})

test('un alias ne masque pas une vraie divergence sur un autre compte', () => {
  // Garde-fou : l'alias porte sur le NOM, pas sur le code. Deux comptes
  // différents restent deux comptes différents.
  const lignes: CommissionLine[] = [{ isin: 'A', client: 'OPTIMAL - 01674' }]
  const prods = [P({ isin: 'A', clients: ['ALVES - 01674'] })]
  assert.equal(computeCoherence(lignes, prods).filter((i) => i.type === 'client').length, 1)
})

test('la ligne agrégée FEI est exclue du contrôle de date', () => {
  // « FEI » regroupe plusieurs tranches de la même dette privée, chacune avec sa
  // propre date d'émission : les comparer à la date unique du produit agrégé
  // produit une divergence par tranche, sans rien signaler de réel.
  const lignes: CommissionLine[] = [
    { isin: 'FEI', issue: '2026-03-20' },
    { isin: 'FEI', issue: '2025-10-30' },
  ]
  const prods = [P({ isin: 'FEI', dateEmission: '2025-04-15' })]
  assert.deepEqual(computeCoherence(lignes, prods), [])
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

test('une émission antérieure au strike est signalée, jamais corrigée', () => {
  // Un produit ne peut pas être émis avant d'être constaté. Quand ça arrive,
  // le champ « émission » contient autre chose — le plus souvent la date de
  // trade (cas FR1459ABG521, 17/08/2026).
  const p = (isin: string, emission: string, strike: string) =>
    ({ isin, dateEmission: emission, dateConstatationInitiale: strike }) as any

  const r = emissionAvantStrike([
    p('AAA', '2026-09-21', '2026-09-21'), // même jour : valide
    p('BBB', '2026-10-05', '2026-09-21'), // émission après : valide
    p('CCC', '2026-06-11', '2026-06-15'), // émission avant : impossible
  ])
  assert.equal(r.length, 1)
  assert.equal(r[0].isin, 'CCC')
  assert.equal(r[0].type, 'emission')
  assert.match(r[0].detail, /ANTÉRIEURE/)
  assert.match(r[0].detail, /date de trade/)
})

test('un produit sans l’une des deux dates n’est pas signalé', () => {
  const r = emissionAvantStrike([
    { isin: 'AAA', dateEmission: '2026-06-11' } as any,
    { isin: 'BBB', dateConstatationInitiale: '2026-06-15' } as any,
  ])
  assert.equal(r.length, 0)
})
