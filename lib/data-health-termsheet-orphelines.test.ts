import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDataHealth } from './data-health'
import { products } from './products'
import { TERMSHEET_ISINS } from './termsheets'

// ─────────────────────────────────────────────────────────────────────────
//  Une termsheet peut arriver dans le dossier OneDrive avant que quiconque
//  n'ait créé le produit correspondant dans l'app — et jusqu'ici, RIEN ne le
//  signalait : `sansTS` ne regarde que le sens produit → termsheet, jamais
//  l'inverse. Une termsheet neuve restait invisible tant que personne ne
//  parcourait le dossier OneDrive à l'œil (cas signalé par Laurent le
//  18/08/2026 : « les TS sont dans le dossier mais pas associées »).
//
//  `termsheetSansProduit` couvre ce sens manquant. Le test vérifie
//  l'invariant sur les VRAIES données (pas un fixture synthétique) : le
//  jour où ce test échoue, c'est qu'un ISIN vient d'apparaître ou de
//  disparaître de l'un des deux ensembles sans que l'autre bouge — un
//  signal réel, pas un faux positif de test.
// ─────────────────────────────────────────────────────────────────────────

test('termsheetSansProduit == TERMSHEET_ISINS \\ produits connus (exactement)', () => {
  const connus = new Set(products.map((p) => p.isin))
  const attendu = new Set(TERMSHEET_ISINS.filter((isin) => !connus.has(isin)))

  const h = computeDataHealth(products)
  const obtenu = new Set(h.termsheetSansProduit.map((x) => x.isin))

  assert.deepEqual(obtenu, attendu)
})

test('un ISIN de TERMSHEET_ISINS déjà porté par un produit vivant n’y figure pas', () => {
  const h = computeDataHealth(products)
  const orphelins = new Set(h.termsheetSansProduit.map((x) => x.isin))
  for (const p of products) assert.equal(orphelins.has(p.isin), false, p.isin)
})
