import { test } from 'node:test'
import assert from 'node:assert/strict'
import { productTypeLabel, aAirbag, airbagNiveau } from './classification.ts'
import type { Product } from './types.ts'

// Fabrique un produit minimal (la classification ne lit que quelques champs).
const P = (o: Partial<Product>): Product => ({ isin: 'X', nom: '', ...o }) as Product

// ── productTypeLabel : Autocall = Athéna ───────────────────────────────────
test('Autocall → Athéna (type, famille ou terms)', () => {
  assert.equal(productTypeLabel(P({ productType: 'Autocall' })), 'Athéna')
  assert.equal(productTypeLabel(P({ family: 'autocall' })), 'Athéna')
  assert.equal(productTypeLabel(P({ terms: { kind: 'autocall' } as Product['terms'] })), 'Athéna')
  assert.equal(productTypeLabel(P({ productType: 'Athena' })), 'Athéna')
  assert.equal(productTypeLabel(P({ productType: 'Athéna' })), 'Athéna')
})

test('Reverse / Inverse autocall → Athéna inverse', () => {
  assert.equal(productTypeLabel(P({ productType: 'Reverse Autocall' })), 'Athéna inverse')
  assert.equal(
    productTypeLabel(P({ terms: { kind: 'autocall', sens: 'inverse' } as Product['terms'] })),
    'Athéna inverse',
  )
})

test('« Airbag » jamais affiché dans Type', () => {
  assert.equal(productTypeLabel(P({ productType: 'Athéna Airbag', family: 'autocall' })), 'Athéna')
  // Participation Airbag = fonds (famille participation) → PAS Athéna (régression).
  assert.equal(productTypeLabel(P({ productType: 'Participation (Airbag)', family: 'participation' })), 'Participation')
})

test('Phoenix : « Mémoire » implicite, variante dégressive nommée', () => {
  assert.equal(productTypeLabel(P({ productType: 'Phoenix Mémoire' })), 'Phoenix')
  assert.equal(productTypeLabel(P({ productType: 'Phoenix Memory' })), 'Phoenix')
  assert.equal(productTypeLabel(P({ productType: 'Phoenix Mémoire Dégressif' })), 'Phoenix Ticket Mémoire')
})

test('Snowball → Athéna', () => {
  assert.equal(productTypeLabel(P({ productType: 'Snowball' })), 'Athéna')
  assert.equal(productTypeLabel(P({ badges: ['Snowball'] })), 'Athéna')
})

test('CLN tranche → « CLN Tranche »', () => {
  assert.equal(productTypeLabel(P({ terms: { kind: 'credit', type: 'tranche' } as Product['terms'] })), 'CLN Tranche')
})

test('productType absent → déduit du nom', () => {
  assert.equal(productTypeLabel(P({ nom: 'Autocall Classic on URW' })), 'Athéna')
  assert.equal(productTypeLabel(P({ nom: 'TARN (30-5) 10%+1%' })), 'TARN')
  assert.equal(productTypeLabel(P({ nom: 'CLN iTraxx Main 100% KG' })), 'CLN')
  assert.equal(productTypeLabel(P({ nom: 'QUARTZ 40 ENGIE DECREMENT' })), 'Quartz')
  assert.equal(productTypeLabel(P({ nom: 'Mini Futures Dassault' })), 'Mini Future')
  assert.equal(productTypeLabel(P({ nom: 'Objet non identifiable' })), '—')
})

test('autres types conservés', () => {
  assert.equal(productTypeLabel(P({ productType: 'Booster' })), 'Booster')
  assert.equal(productTypeLabel(P({ productType: 'Call Spread' })), 'Call Spread')
})

// ── aAirbag ────────────────────────────────────────────────────────────────
test('aAirbag : signal terms / badge, pas le nom seul', () => {
  assert.equal(aAirbag(P({ terms: { kind: 'autocall', airbag: true } as Product['terms'] })), true)
  assert.equal(aAirbag(P({ badges: ['Airbag'] })), true)
  assert.equal(aAirbag(P({ badges: ['Snowball'] })), true)
  // Nommé « Airbag » mais sans flag ni badge (cas EFG) → PAS un airbag.
  assert.equal(aAirbag(P({ nom: 'Athena Airbag AMD', terms: { kind: 'autocall' } as Product['terms'] })), false)
})

// ── airbagNiveau ─────────────────────────────────────────────────────────────
test('airbagNiveau : protectionPct puis pdiPct', () => {
  assert.equal(airbagNiveau(P({ terms: { kind: 'autocall', protectionPct: 60 } as Product['terms'] })), 60)
  assert.equal(airbagNiveau(P({ pdiPct: 70 })), 70)
  assert.equal(airbagNiveau(P({ terms: { kind: 'autocall' } as Product['terms'] })), undefined)
})
