import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pourcent, pourcentSigne, insecable, ESPACE_FINE } from './pourcentage'

test('le % ne peut pas être séparé de son nombre', () => {
  // C'est TOUT l'objet du module : une espace ordinaire est un point de coupure
  // pour le navigateur, une espace fine insécable n'en est pas un.
  assert.equal(pourcent(6.75), `6,75${ESPACE_FINE}%`)
  assert.ok(!pourcent(6.75).includes(' '), 'aucune espace ordinaire ne doit subsister')
  assert.equal(pourcent(11.76), `11,76${ESPACE_FINE}%`)
})

test('digits fixe la précision, la virgule reste française', () => {
  assert.equal(pourcent(6.5, 2), `6,50${ESPACE_FINE}%`)
  assert.equal(pourcent(10, 0), `10${ESPACE_FINE}%`)
  assert.equal(pourcent(3.14159, 1), `3,1${ESPACE_FINE}%`)
})

test('une valeur absente ne fabrique pas un pourcentage', () => {
  assert.equal(pourcent(undefined), '—')
  assert.equal(pourcent(null), '—')
  assert.equal(pourcent(Number.NaN), '—')
  assert.equal(pourcent(undefined, 2, ''), '')
})

test('pourcentSigne marque la hausse', () => {
  assert.equal(pourcentSigne(1.2), `+1,20${ESPACE_FINE}%`)
  assert.equal(pourcentSigne(-0.3), `-0,30${ESPACE_FINE}%`)
  assert.equal(pourcentSigne(0), `+0,00${ESPACE_FINE}%`)
})

test('insecable traite les unités des textes libres', () => {
  // Les descriptions de deals portent leurs pourcentages en toutes lettres ;
  // elles se coupaient exactement de la même façon.
  assert.equal(
    insecable('1er autocall au T2 à 95 % puis −5 %/trimestre (floor 50 %)'),
    `1er autocall au T2 à 95${ESPACE_FINE}% puis −5${ESPACE_FINE}%/trimestre (floor 50${ESPACE_FINE}%)`,
  )
  assert.equal(insecable('nominal 300 000 €'), `nominal 300 000${ESPACE_FINE}€`)
})

test('insecable ne touche pas au reste du texte', () => {
  assert.equal(insecable('best strike quotidien sur 2 semaines'), 'best strike quotidien sur 2 semaines')
  assert.equal(insecable('maturité 3 ans'), 'maturité 3 ans')
  assert.equal(insecable(undefined), '')
  assert.equal(insecable(''), '')
})
