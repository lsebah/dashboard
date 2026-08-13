import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normaliseDateRun,
  ageJours,
  fraicheurParEmetteur,
  runsDecrement,
  runsFrn,
} from './veille-fraicheur.ts'

const NOW = new Date('2026-08-11T09:00:00Z')

test('normaliseDateRun : les deux formats réellement présents', () => {
  assert.equal(normaliseDateRun('10/08/2026'), '2026-08-10') // comparatif décrément
  assert.equal(normaliseDateRun('2026-08-10'), '2026-08-10') // grille FRN
})

test('normaliseDateRun : valeur illisible → undefined (jamais une date approchée)', () => {
  // Une date fausse ferait taire l'alarme : mieux vaut ignorer la ligne.
  assert.equal(normaliseDateRun(''), undefined)
  assert.equal(normaliseDateRun('août 2026'), undefined)
  assert.equal(normaliseDateRun(null), undefined)
  assert.equal(normaliseDateRun(undefined), undefined)
  assert.equal(normaliseDateRun(20260810), undefined)
})

test('ageJours : compte en jours calendaires UTC', () => {
  assert.equal(ageJours('2026-08-11', NOW), 0)
  assert.equal(ageJours('2026-08-10', NOW), 1)
  assert.equal(ageJours('2026-07-21', NOW), 21)
})

test('fraîcheur : retient le run le PLUS RÉCENT par émetteur', () => {
  const f = fraicheurParEmetteur(
    [
      { emetteur: 'BNPP', date: '2026-06-22' },
      { emetteur: 'BNPP', date: '2026-08-10' }, // le plus récent
      { emetteur: 'BNPP', date: '2026-07-21' },
    ],
    { now: NOW, slaJours: 10 },
  )
  assert.equal(f.length, 1)
  assert.equal(f[0].dernier, '2026-08-10')
  assert.equal(f[0].ageJours, 1)
  assert.equal(f[0].perime, false)
})

test('fraîcheur : périmé au-delà du SLA, frais en deçà', () => {
  const f = fraicheurParEmetteur(
    [
      { emetteur: 'Frais', date: '2026-08-10' }, // 1 j
      { emetteur: 'Limite', date: '2026-08-01' }, // 10 j — pile au SLA, PAS périmé
      { emetteur: 'Perime', date: '2026-07-31' }, // 11 j
    ],
    { now: NOW, slaJours: 10 },
  )
  const par = Object.fromEntries(f.map((x) => [x.emetteur, x.perime]))
  assert.equal(par.Frais, false)
  assert.equal(par.Limite, false)
  assert.equal(par.Perime, true)
})

test('fraîcheur : un émetteur ATTENDU mais totalement absent est périmé', () => {
  // C'est le cas le plus grave : sans `attendus`, un émetteur qui n'envoie plus
  // rien du tout n'apparaîtrait dans aucune ligne et resterait invisible.
  const f = fraicheurParEmetteur([{ emetteur: 'BNPP', date: '2026-08-10' }], {
    now: NOW,
    slaJours: 10,
    attendus: ['BNPP', 'Citi'],
  })
  const citi = f.find((x) => x.emetteur === 'Citi')
  assert.ok(citi)
  assert.equal(citi.dernier, null)
  assert.equal(citi.ageJours, null)
  assert.equal(citi.perime, true)
})

test('fraîcheur : tri du plus périmé au plus frais, absents en tête', () => {
  const f = fraicheurParEmetteur(
    [
      { emetteur: 'B', date: '2026-08-10' },
      { emetteur: 'A', date: '2026-06-01' },
    ],
    { now: NOW, slaJours: 10, attendus: ['Z'] },
  )
  assert.deepEqual(f.map((x) => x.emetteur), ['Z', 'A', 'B'])
})

test('runsDecrement / runsFrn : ignorent les lignes sans émetteur ou sans date', () => {
  assert.deepEqual(
    runsDecrement([
      { emetteur: 'BNPP', dateRun: '10/08/2026' },
      { emetteur: 'BofA', dateRun: null },
      { dateRun: '10/08/2026' },
    ]),
    [{ emetteur: 'BNPP', date: '2026-08-10' }],
  )
  assert.deepEqual(
    runsFrn([
      { issuer: 'CIBC', runDate: '2026-08-10' },
      { issuer: 'SG', runDate: '' },
    ]),
    [{ emetteur: 'CIBC', date: '2026-08-10' }],
  )
})
