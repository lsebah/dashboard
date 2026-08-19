import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDataHealth } from './data-health'
import { products } from './products'
import { TERMSHEET_ISINS, INDEX_SYNC_LE, indexAgeJours } from './termsheets'

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

// ─────────────────────────────────────────────────────────────────────────
//  Les deux contrôles ci-dessus lisent l'INDEX, jamais le dossier. Du 20/07
//  au 19/08/2026 l'index est resté figé (secrets GRAPH_* absents) : ils sont
//  restés au VERT alors que 5 termsheets — dont XS3327842855 — dormaient dans
//  le dossier sans produit. Un index périmé doit donc être une alerte en soi,
//  sans quoi l'absence d'alerte ne prouve rien.
// ─────────────────────────────────────────────────────────────────────────

test('indexAgeJours compte les jours écoulés depuis le dernier alignement', () => {
  const sync = new Date(INDEX_SYNC_LE)
  const plus3 = new Date(sync.getTime() + 3 * 86_400_000)
  assert.equal(indexAgeJours(sync), 0)
  assert.equal(indexAgeJours(plus3), 3)
})

test('un index laissé sans alignement finit par être signalé périmé', () => {
  const frais = computeDataHealth(products).indexTermsheets
  assert.equal(frais.syncLe, INDEX_SYNC_LE)
  // Le seuil est franchi par le seul écoulement du temps : rien à faire pour
  // « casser » ce contrôle, il rougit tout seul si la synchro s'arrête.
  assert.equal(indexAgeJours(new Date(new Date(INDEX_SYNC_LE).getTime() + 11 * 86_400_000)) > 10, true)
})
