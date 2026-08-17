import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ligneKey, ligneKeyLegacy, clesLegacyAmbigues } from './commissions.ts'

const L = (nominal?: number) => ({
  isin: 'FR1459ABG521',
  client: 'RENAUD GESTION PRIVEE',
  issue: '2026-09-21',
  nominal,
})

test('deux tickets du même client sur le même produit sont distincts', () => {
  // Cas réel : 63 000 € tradé le 12/06 puis un upsize de 24 000 € le 17/08,
  // tous deux émis le 21/09/2026. Sans le nominal, la même clé désignerait les
  // deux lignes — une rétro saisie sur l'une s'appliquerait à l'autre.
  assert.notEqual(ligneKey(L(63000)), ligneKey(L(24000)))
})

test('la clé est stable pour une même ligne', () => {
  assert.equal(ligneKey(L(63000)), ligneKey(L(63000)))
  assert.equal(ligneKey(L(63000)), 'FR1459ABG521|RENAUD GESTION PRIVEE|2026-09-21|63000')
})

test('l’ancienne clé ne connaît pas le nominal — c’est le bug qu’elle portait', () => {
  assert.equal(ligneKeyLegacy(L(63000)), ligneKeyLegacy(L(24000)))
  assert.equal(ligneKeyLegacy(L(63000)), 'FR1459ABG521|RENAUD GESTION PRIVEE|2026-09-21')
})

test('les champs absents ne cassent pas la clé', () => {
  assert.equal(ligneKey({ isin: 'X', client: null, issue: null, nominal: null }), 'X|||')
})

test('une ancienne clé partagée par deux lignes est déclarée ambiguë', () => {
  // Le cas qui a fait diverger le tableau (5,00 %) et la modale (4,46 %) sur
  // le même ticket : deux lignes, une seule ancienne clé.
  const a = clesLegacyAmbigues([L(63000), L(24000)])
  assert.equal(a.size, 1)
  assert.ok(a.has('FR1459ABG521|RENAUD GESTION PRIVEE|2026-09-21'))
})

test('une ancienne clé unique reste utilisable', () => {
  // Sans ambiguïté, le repli doit continuer de fonctionner — sinon toutes les
  // saisies antérieures au changement de clé seraient perdues.
  assert.equal(clesLegacyAmbigues([L(63000)]).size, 0)
  assert.equal(
    clesLegacyAmbigues([
      L(63000),
      { isin: 'XS1', client: 'A', issue: '2026-01-01', nominal: 1 },
    ]).size,
    0,
  )
})

test('trois tickets sur la même ancienne clé : toujours une seule entrée ambiguë', () => {
  const a = clesLegacyAmbigues([L(1), L(2), L(3)])
  assert.equal(a.size, 1)
})
