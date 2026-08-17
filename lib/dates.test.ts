import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateFr, jourMois } from './dates'
import { formatDateFr } from './lifecycle'

test('dateFr rend JJ/MM/AA', () => {
  assert.equal(dateFr('2026-08-17'), '17/08/26')
  assert.equal(dateFr('2026-01-06'), '06/01/26')
  assert.equal(dateFr('2031-12-31'), '31/12/31')
})

test('dateFr accepte un horodatage complet', () => {
  assert.equal(dateFr('2026-08-17T06:42:00.000Z'), '17/08/26')
})

test('dateFr ne décale pas d’un jour selon l’heure d’exécution', () => {
  // Une date ISO nue passée à `new Date()` est interprétée en UTC puis affichée
  // en heure locale : à l'ouest de Greenwich, le 1er devient le 31. Le chemin
  // direct par regex évite entièrement ce piège.
  assert.equal(dateFr('2026-03-01'), '01/03/26')
  assert.equal(dateFr('2026-01-01'), '01/01/26')
})

test('dateFr refuse plutôt que d’approcher', () => {
  assert.equal(dateFr(undefined), '—')
  assert.equal(dateFr(null), '—')
  assert.equal(dateFr(''), '—')
  assert.equal(dateFr('pas une date'), '—')
  assert.equal(dateFr(undefined, ''), '')
})

test('jourMois rend JJ/MM', () => {
  assert.equal(jourMois('2026-08-17'), '17/08')
  assert.equal(jourMois(undefined), '—')
})

test('formatDateFr — le formateur historique — suit la même règle', () => {
  // Six écrans importent `formatDateFr` (Portefeuille, Synopsis, Notifications,
  // Reconstruction, Calendrier, Bloomberg) et il rendait « 7 avr. 2026 ». La
  // règle JJ/MM/AA avait été posée sans que ce formateur-là soit repris : ce
  // test empêche la divergence de revenir.
  assert.equal(formatDateFr('2026-04-07'), '07/04/26')
  assert.equal(formatDateFr('2026-08-20'), '20/08/26')
  assert.equal(formatDateFr(undefined), '—')
})
