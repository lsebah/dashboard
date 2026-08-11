import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMontant } from './montant.ts'

// Ce montant est le nominal du compte client : il alimente l'encours, le P&L,
// les répartitions et le relevé envoyé au client. Les cas ci-dessous sont ceux
// que les trois anciens parseurs corrompaient silencieusement.

test('régression : la virgule décimale ne doit PAS être supprimée (bug ×100)', () => {
  // ClientAssign.tsx:50 faisait Number('250000,50'.replace(/[^\d.]/g,'')) = 25000050
  assert.equal(parseMontant('250000,50'), 250000.5)
})

test('régression : format fr-FR de toLocaleString (espace fine U+202F) (bug ×10)', () => {
  const fr = (250000.5).toLocaleString('fr-FR') // « 250 000,5 » avec U+202F
  assert.equal(parseMontant(fr), 250000.5)
})

test('régression : milliers séparés par virgules ne doivent PAS donner NaN', () => {
  // .replace(',', '.') non global donnait '1.234,567' → NaN → montant effacé
  assert.equal(parseMontant('1,234,567'), 1234567)
  assert.equal(parseMontant('1.234.567'), 1234567)
})

test('séparateurs de milliers : espaces simples et insécables', () => {
  assert.equal(parseMontant('1 234 567'), 1234567)
  assert.equal(parseMontant('1 234 567'), 1234567)
  assert.equal(parseMontant('1 234 567'), 1234567)
})

test('mixte milliers + décimales, dans les deux conventions', () => {
  assert.equal(parseMontant('1.234.567,89'), 1234567.89)
  assert.equal(parseMontant('1,234,567.89'), 1234567.89)
})

test('formes simples', () => {
  assert.equal(parseMontant('300000'), 300000)
  assert.equal(parseMontant('250000.50'), 250000.5)
  assert.equal(parseMontant('300 000 EUR'), 300000)
  assert.equal(parseMontant(300000), 300000)
})

test('séparateur unique suivi de 3 chiffres → milliers', () => {
  assert.equal(parseMontant('1,234'), 1234)
  assert.equal(parseMontant('1.234'), 1234)
})

test('saisie invalide → undefined (refus explicite, jamais un zéro implicite)', () => {
  assert.equal(parseMontant(''), undefined)
  assert.equal(parseMontant('   '), undefined)
  assert.equal(parseMontant('abc'), undefined)
  assert.equal(parseMontant('0'), undefined)
  assert.equal(parseMontant('-100'), undefined)
  assert.equal(parseMontant(null), undefined)
  assert.equal(parseMontant(undefined), undefined)
  assert.equal(parseMontant(NaN), undefined)
})
