import { test } from 'node:test'
import assert from 'node:assert/strict'
import { products } from './products'
import { estInverse, rappelConstate } from './lifecycle'

// ─────────────────────────────────────────────────────────────────────────
//  Un Phoenix Bearish (taux) n'est PAS un autocall action inversé sur le
//  papier, mais partage exactement la même mécanique de sens : le rappel se
//  déclenche quand le sous-jacent est SOUS la barrière, pas au-dessus. Deux
//  écrans (Calendrier, Portefeuille) ne testaient que `kind === 'autocall'`
//  pour détecter ce sens, oubliant `kind === 'rates'` — un Phoenix Bearish
//  s'affichait donc « rappel probable » dès que le taux MONTAIT au-dessus de
//  la barrière, l'exact opposé de la réalité.
//
//  Cas réel : FR001400U1I0 (Generali Phoenix Bearish CMS10 2,80 %/2,20 %),
//  signalé par Laurent le 18/08/2026 — CMS10 à 3,28 % affiché « probable »
//  alors que la termsheet SG exige un fixing ≤ 2,20 % pour déclencher le
//  remboursement anticipé (jamais ≥).
// ─────────────────────────────────────────────────────────────────────────

const generaliBearish = products.find((p) => p.isin === 'FR001400U1I0')!

test('un Phoenix Bearish (taux) est bien détecté comme inverse', () => {
  assert.equal(estInverse(generaliBearish), true)
})

test('rappelConstate : un taux AU-DESSUS de la barrière ne déclenche PAS un Phoenix Bearish', () => {
  const premiereObsActive = generaliBearish.observations!.find((o) => o.autocallActif !== false)!
  const produit = {
    ...generaliBearish,
    observations: generaliBearish.observations!.map((o) =>
      o === premiereObsActive ? { ...o, niveauConstatePct: 3.28 } : o,
    ),
  }
  // Barrière 2,20 % ; 3,28 % est AU-DESSUS ⇒ pas de rappel pour un bearish.
  const futur = new Date(`${premiereObsActive.dateObservation}T00:00:00Z`)
  futur.setUTCDate(futur.getUTCDate() + 1)
  assert.equal(rappelConstate(produit, futur), undefined)
})

test('rappelConstate : un taux SOUS la barrière déclenche bien le Phoenix Bearish', () => {
  const premiereObsActive = generaliBearish.observations!.find((o) => o.autocallActif !== false)!
  const produit = {
    ...generaliBearish,
    observations: generaliBearish.observations!.map((o) =>
      o === premiereObsActive ? { ...o, niveauConstatePct: 2.0 } : o,
    ),
  }
  const futur = new Date(`${premiereObsActive.dateObservation}T00:00:00Z`)
  futur.setUTCDate(futur.getUTCDate() + 1)
  const r = rappelConstate(produit, futur)
  assert.equal(r?.date, premiereObsActive.dateObservation)
})
