import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomCourt, ACRONYMES } from './nom-court'

// ─────────────────────────────────────────────────────────────────────────
//  Une étiquette de radar doit se lire d'un coup d'œil. Mais un nom raccourci
//  est un nom RÉÉCRIT : le seul défaut inacceptable ici est de rendre une
//  valeur méconnaissable, ou pire, de la confondre avec une autre.
// ─────────────────────────────────────────────────────────────────────────

test('les acronymes d’usage remplacent le nom complet', () => {
  assert.equal(nomCourt('International Business Machines Corporation', 'IBM'), 'IBM')
  assert.equal(nomCourt('Advanced Micro Devices, Inc.', 'AMD'), 'AMD')
  assert.equal(nomCourt('3M Company', 'MMM'), '3M')
})

test('l’habillage juridique disparaît, le nom reste entier', () => {
  assert.equal(nomCourt('Apple Inc.'), 'Apple')
  assert.equal(nomCourt('Microsoft Corporation'), 'Microsoft')
  assert.equal(nomCourt('NVIDIA Corporation'), 'NVIDIA')
  assert.equal(nomCourt('Linde plc'), 'Linde')
  assert.equal(nomCourt('Accenture plc'), 'Accenture')
  assert.equal(nomCourt('Danaher Corporation'), 'Danaher')
})

test('les mentions de classe d’action sont retirées', () => {
  assert.equal(nomCourt('Alphabet Inc. Class A'), 'Alphabet')
  assert.equal(nomCourt('Alphabet Inc. Class C'), 'Alphabet')
  assert.equal(nomCourt('Fox Corporation Class B'), 'Fox')
})

test('l’article de tête tombe', () => {
  assert.equal(nomCourt('The Home Depot'), 'Home Depot')
  assert.equal(nomCourt('The Walt Disney Company'), 'Walt Disney')
})

test('plusieurs suffixes empilés tombent tous', () => {
  assert.equal(nomCourt('Marsh & McLennan Companies, Inc.'), 'Marsh & McLennan')
  assert.equal(nomCourt('Air Products and Chemicals, Inc.'), 'Air Products and Chemicals')
})

test('un nom qui ne serait QUE du suffixe n’est jamais vidé', () => {
  // Mieux vaut rendre le nom d'origine qu'une étiquette vide.
  assert.equal(nomCourt('Inc.'), 'Inc.')
  assert.equal(nomCourt('The'), 'The')
})

test('un nom sans habillage n’est pas touché', () => {
  assert.equal(nomCourt('Ferrari'), 'Ferrari')
  assert.equal(nomCourt('Nike'), 'Nike')
  assert.equal(nomCourt('Airbus'), 'Airbus')
})

test('à défaut de nom, le symbole sert d’étiquette plutôt que le vide', () => {
  assert.equal(nomCourt('', 'ZZZZ'), 'ZZZZ')
})

test('aucun acronyme ne rend deux sociétés identiques', () => {
  // Le vrai risque d'un raccourci : deux valeurs qui portent la même étiquette.
  const vus = new Map<string, string>()
  for (const [sym, court] of Object.entries(ACRONYMES)) {
    const deja = vus.get(court)
    assert.equal(deja, undefined, `« ${court} » désigne à la fois ${deja} et ${sym}`)
    vus.set(court, sym)
  }
})
