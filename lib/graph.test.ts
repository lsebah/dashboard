import { test } from 'node:test'
import assert from 'node:assert/strict'
import { odataInstant } from './graph.ts'

// Le `$filter` OData de Graph attend un Edm.DateTimeOffset : sans fuseau, la
// requête est rejetée (400). Comme le cron décrément ne fait volontairement pas
// avancer `lastCheck` en cas d'échec, un horodatage sans « Z » le bloquerait
// indéfiniment. `odataInstant` est le garde-fou.

test('odataInstant : horodatage SANS fuseau → interprété UTC et suffixé Z', () => {
  assert.equal(odataInstant('2026-08-11T07:45:00'), '2026-08-11T07:45:00.000Z')
})

test('odataInstant : horodatage déjà en Z → inchangé (normalisé)', () => {
  assert.equal(odataInstant('2026-08-11T07:45:00Z'), '2026-08-11T07:45:00.000Z')
})

test('odataInstant : décalage explicite → converti en UTC', () => {
  assert.equal(odataInstant('2026-08-11T09:45:00+02:00'), '2026-08-11T07:45:00.000Z')
  assert.equal(odataInstant('2026-08-11T09:45:00+0200'), '2026-08-11T07:45:00.000Z')
})

test('odataInstant : valeur absente ou illisible → undefined (pas de filtre)', () => {
  // Mieux vaut ne PAS filtrer (on récupère les N derniers messages) que d'envoyer
  // un filtre invalide qui ferait échouer toute la synchro.
  assert.equal(odataInstant(undefined), undefined)
  assert.equal(odataInstant(''), undefined)
  assert.equal(odataInstant('   '), undefined)
  assert.equal(odataInstant('pas une date'), undefined)
})
