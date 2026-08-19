import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clotureStooq, resoudreTaux, TAUX_REFERENCE, type TauxRef } from './taux.ts'

const TEC = TAUX_REFERENCE.find((t) => t.cle === 'TEC10')!
const CMS = TAUX_REFERENCE.find((t) => t.cle === 'CMS10')!

test('clotureStooq lit la colonne Close', () => {
  const csv = 'Symbol,Date,Time,Open,High,Low,Close,Volume\n10FRY.B,2026-08-17,17:00:00,3.45,3.47,3.44,3.46,0'
  assert.equal(clotureStooq(csv), 3.46)
})

test('clotureStooq refuse un symbole inconnu plutôt que de rendre 0', () => {
  // Stooq répond « N/D » sur toutes les colonnes : c'est une ABSENCE, et
  // `Number('N/D')` vaut NaN — un parseur naïf afficherait 0,00 %.
  const nd = 'Symbol,Date,Time,Open,High,Low,Close,Volume\n10XXX.B,N/D,N/D,N/D,N/D,N/D,N/D,N/D'
  assert.equal(clotureStooq(nd), null)
  assert.equal(clotureStooq(''), null)
  assert.equal(clotureStooq('Symbol,Date,Close'), null)
  assert.equal(clotureStooq('rien du tout'), null)
})

test('l’ordre de résolution : internet d’abord, Bloomberg ensuite', () => {
  // Ni CMS10 ni TEC10 n'ont de cotation libre connue (les deux sont Bloomberg
  // seul) — la voie Stooq se teste donc sur une référence synthétique.
  const ref: TauxRef = { cle: 'X', nom: 'Taux X', bloomberg: 'X BGN Curncy', stooq: 'x.b' }
  assert.deepEqual(resoudreTaux(ref, 3.46, { 'X BGN Curncy': 3.7 }), { valeur: 3.46, source: 'stooq' })
  assert.deepEqual(resoudreTaux(ref, null, { 'X BGN Curncy': 3.7 }), { valeur: 3.7, source: 'bloomberg' })
})

test('le ticker Bloomberg doit correspondre EXACTEMENT', () => {
  // Une variante d'écriture ne doit pas être devinée : mieux vaut « — » qu'un
  // taux attribué au mauvais instrument.
  assert.equal(resoudreTaux(TEC, null, { BFRTEC10: 3.7 }), null)
  assert.equal(resoudreTaux(CMS, null, { EUSA10: 2.5 }), null)
  assert.deepEqual(resoudreTaux(CMS, null, { 'EUSA10 BGN Curncy': 2.5 }), {
    valeur: 2.5,
    source: 'bloomberg',
  })
})

test('aucune source : null, jamais une valeur de repli', () => {
  assert.equal(resoudreTaux(TEC, null, {}), null)
  assert.equal(resoudreTaux(TEC, null, null), null)
  assert.equal(resoudreTaux(TEC, undefined, undefined), null)
  assert.equal(resoudreTaux(TEC, Number.NaN, {}), null)
})

test('les tickers sont ceux fournis par Laurent', () => {
  assert.equal(CMS.bloomberg, 'EUSA10 BGN Curncy')
  assert.equal(TEC.bloomberg, 'BFRTEC10 Index')
  // Aucune cotation libre fiable connue pour ces deux taux — Bloomberg seul.
  assert.equal(CMS.stooq, null)
  assert.equal(TEC.stooq, null)
})
