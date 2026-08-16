import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assureurs,
  clefProduit,
  dealsDeLaSemaine,
  dedoublonner,
  enCommercialisation,
  lundiDeLaSemaine,
  type Deal,
} from './deal-done'

const D = (o: Partial<Deal> & Pick<Deal, 'id' | 'date' | 'rr' | 'produit'>): Deal => o as Deal

// ── Normalisation ───────────────────────────────────────────────────────────
test('clefProduit ignore accents, casse et ponctuation', () => {
  assert.equal(clefProduit('Athéna Dégressif — LVMH'), clefProduit('athena degressif lvmh'))
  assert.equal(clefProduit('Phoenix Mémoire  SpaceX'), 'phoenix memoire spacex')
})

// ── Doublons ────────────────────────────────────────────────────────────────
test('le stagiaire ne double pas un deal déjà annoncé par un sales', () => {
  // Cas visé par la contrainte : même produit, même émetteur, même nominal,
  // annoncé deux fois. C'est un doublon, on n'en garde qu'un.
  const r = dedoublonner([
    D({ id: 'a', date: '2026-06-24', rr: 'STA', produit: 'Phoenix Mémoire SpaceX', emetteur: 'Marex', nominal: 300000 }),
    D({ id: 'b', date: '2026-06-24', rr: 'MM', produit: 'Phoenix Mémoire SpaceX', emetteur: 'Marex', nominal: 300000 }),
  ])
  assert.equal(r.deals.length, 1)
  assert.equal(r.deals[0].rr, 'MM', 'le sales prime sur le stagiaire')
  assert.equal(r.doublons.length, 1)
  assert.equal(r.doublons[0].ecarte.rr, 'STA')
})

test('deux tickets du même jour et du même sous-jacent NE sont PAS fusionnés si le nominal diffère', () => {
  // Cas réel du 24/06 : 200 k annoncés par le stagiaire, 300 k par le sales.
  // Fusionner ferait disparaître une affaire ; on garde les deux et on signale.
  const r = dedoublonner([
    D({ id: 'a', date: '2026-06-24', rr: 'STA', produit: 'Phoenix Mémoire SpaceX', emetteur: 'Marex', nominal: 200000 }),
    D({ id: 'b', date: '2026-06-24', rr: 'MM', produit: 'Phoenix Mémoire SpaceX', emetteur: 'Marex', nominal: 300000 }),
  ])
  assert.equal(r.deals.length, 2)
  assert.equal(r.doublons.length, 0)
  assert.equal(r.aVerifier.length, 1)
  assert.match(r.aVerifier[0].motif, /nominal/)
})

test('une ressemblance déjà tranchée ne ressort pas en suspicion', () => {
  // Cas réel du 06/07 : le MÊME mail annonce deux « Athena dégressif IA
  // Electrification » — 3,25 M€ (rappel T4 à 100 %) et 1 M€ (rappel T4 à 90 %).
  // La lecture du mail a tranché ; laisser l'avertissement en permanence le
  // transformerait en bruit que plus personne ne lit.
  const r = dedoublonner([
    D({ id: 'a', date: '2026-07-06', rr: 'MH', produit: 'Athena IA', emetteur: 'MS', nominal: 3250000, distinctConfirme: true }),
    D({ id: 'b', date: '2026-07-06', rr: 'MH', produit: 'Athena IA', emetteur: 'MS', nominal: 1000000, distinctConfirme: true }),
  ])
  assert.equal(r.deals.length, 2)
  assert.equal(r.aVerifier.length, 0)
})

test('le drapeau « distinct » ne dédoublonne pas une identité strictement égale', () => {
  // Garde-fou : deux lignes rigoureusement identiques restent un doublon, même
  // marquées distinctes — sinon le drapeau deviendrait un moyen de dupliquer.
  const r = dedoublonner([
    D({ id: 'a', date: '2026-07-06', rr: 'STA', produit: 'X', emetteur: 'MS', nominal: 1000000, distinctConfirme: true }),
    D({ id: 'b', date: '2026-07-06', rr: 'MM', produit: 'X', emetteur: 'MS', nominal: 1000000, distinctConfirme: true }),
  ])
  assert.equal(r.deals.length, 1)
  assert.equal(r.doublons.length, 1)
})

test('un même produit annoncé à deux mois d’écart reste deux affaires', () => {
  const r = dedoublonner([
    D({ id: 'a', date: '2026-06-24', rr: 'MM', produit: 'Phoenix SpaceX', emetteur: 'Marex', nominal: 300000 }),
    D({ id: 'b', date: '2026-08-24', rr: 'MM', produit: 'Phoenix SpaceX', emetteur: 'BNP', nominal: 500000 }),
  ])
  assert.equal(r.deals.length, 2)
  assert.equal(r.aVerifier.length, 0, 'plus de 7 jours d’écart → pas de suspicion')
})

test('entre deux sales, la première annonce fait référence', () => {
  const r = dedoublonner([
    D({ id: 'b', date: '2026-07-02', rr: 'MEG', produit: 'Athena Kospi', emetteur: 'BBVA', nominal: 250000 }),
    D({ id: 'a', date: '2026-07-01', rr: 'MM', produit: 'Athena Kospi', emetteur: 'BBVA', nominal: 250000 }),
  ])
  assert.equal(r.deals.length, 1)
  assert.equal(r.deals[0].rr, 'MM')
})

test('les deals retenus sortent du plus récent au plus ancien', () => {
  const r = dedoublonner([
    D({ id: 'a', date: '2026-06-01', rr: 'MM', produit: 'A' }),
    D({ id: 'c', date: '2026-08-01', rr: 'MM', produit: 'C' }),
    D({ id: 'b', date: '2026-07-01', rr: 'MM', produit: 'B' }),
  ])
  assert.deepEqual(r.deals.map((d) => d.produit), ['C', 'B', 'A'])
})

// ── Semaine ─────────────────────────────────────────────────────────────────
test('lundiDeLaSemaine cale bien sur le lundi, dimanche compris', () => {
  assert.equal(lundiDeLaSemaine(new Date('2026-08-12T10:00:00Z')), '2026-08-10') // mercredi
  assert.equal(lundiDeLaSemaine(new Date('2026-08-10T00:00:00Z')), '2026-08-10') // lundi
  assert.equal(lundiDeLaSemaine(new Date('2026-08-16T23:00:00Z')), '2026-08-10') // dimanche
})

test('dealsDeLaSemaine prend le lundi au dimanche, bornes incluses', () => {
  const deals = [
    D({ id: '1', date: '2026-08-09', rr: 'MM', produit: 'veille' }),
    D({ id: '2', date: '2026-08-10', rr: 'MM', produit: 'lundi' }),
    D({ id: '3', date: '2026-08-12', rr: 'MM', produit: 'mercredi' }),
    D({ id: '4', date: '2026-08-16', rr: 'MM', produit: 'dimanche' }),
    D({ id: '5', date: '2026-08-17', rr: 'MM', produit: 'lundi suivant' }),
  ]
  const s = dealsDeLaSemaine(deals, new Date('2026-08-12T12:00:00Z')).map((d) => d.produit)
  assert.deepEqual(s, ['lundi', 'mercredi', 'dimanche'])
})

// ── Commercialisation ───────────────────────────────────────────────────────
test('en commercialisation = date de fin annoncée et non dépassée', () => {
  const deals = [
    D({ id: '1', date: '2026-07-22', rr: 'MM', produit: 'ouvert', finCommercialisation: '2026-10-30' }),
    D({ id: '2', date: '2026-06-01', rr: 'MM', produit: 'clos', finCommercialisation: '2026-07-01' }),
    D({ id: '3', date: '2026-08-01', rr: 'MM', produit: 'sans date' }),
  ]
  const out = enCommercialisation(deals, new Date('2026-08-14T00:00:00Z')).map((d) => d.produit)
  assert.deepEqual(out, ['ouvert'])
})

test('le dernier jour de commercialisation compte encore', () => {
  const deals = [D({ id: '1', date: '2026-07-01', rr: 'MM', produit: 'x', finCommercialisation: '2026-08-14' })]
  assert.equal(enCommercialisation(deals, new Date('2026-08-14T09:00:00Z')).length, 1)
})

// ── AVF ─────────────────────────────────────────────────────────────────────
test('assureurs liste et dédoublonne les AVF', () => {
  const deals = [
    D({ id: '1', date: '2026-07-22', rr: 'MM', produit: 'a', avf: ['AXA', 'Selencia'] }),
    D({ id: '2', date: '2026-07-23', rr: 'MM', produit: 'b', avf: ['Selencia'] }),
    D({ id: '3', date: '2026-07-24', rr: 'MM', produit: 'c' }),
  ]
  assert.deepEqual(assureurs(deals), ['AXA', 'Selencia'])
})
