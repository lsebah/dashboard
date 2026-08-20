import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  construireFiches,
  dateTraite,
  debutFenetreRevue,
  clientsActifs,
  fiches,
  type Fiche,
} from './fiches'
import type { Product } from './types'
import type { CommissionLigne } from './commissions'

// ─────────────────────────────────────────────────────────────────────────
//  La fiche est la source unique des onglets Portefeuille, Commissions et
//  Calendrier. Ce qui se joue ici n'est pas cosmétique : si la jointure par
//  ISIN laisse tomber un produit ou dédouble un client, un onglet affiche un
//  portefeuille différent de son voisin — exactement le défaut qu'on corrige.
// ─────────────────────────────────────────────────────────────────────────

const produit = (p: Partial<Product> & { isin: string }): Product =>
  ({
    id: p.isin,
    nom: 'Produit test',
    emetteur: 'BNP',
    assetClass: 'equity',
    family: 'autocall',
    devise: 'EUR',
    nominal: 1_000_000,
    dateConstatationInitiale: '2026-06-01',
    dateEmission: '2026-06-15',
    dateConstatationFinale: '2031-06-01',
    dateEcheance: '2031-06-15',
    frequence: 'trimestriel',
    basket: 'single',
    sousJacents: [],
    ...p,
  }) as Product

const ligne = (l: Partial<CommissionLigne> & { isin: string }): CommissionLigne =>
  ({
    issue: null,
    client: null,
    emetteur: null,
    description: null,
    devise: null,
    nominal: null,
    ufPct: null,
    comCmf: null,
    retroPct: null,
    comClient: null,
    comTotal: null,
    facture: null,
    sent: null,
    credited: null,
    split: null,
    net: null,
    ...l,
  }) as CommissionLigne

test('la fiche réunit produit et registre, et n’oublie ni l’un ni l’autre', () => {
  const index = construireFiches(
    [produit({ isin: 'XS0000000001' }), produit({ isin: 'XS0000000002' })],
    [ligne({ isin: 'XS0000000002' }), ligne({ isin: 'XS0000000003' })],
  )
  // 1 produit seul + 1 produit avec commission + 1 ISIN connu du seul registre.
  assert.deepEqual(Array.from(index.keys()).sort(), [
    'XS0000000001',
    'XS0000000002',
    'XS0000000003',
  ])
  assert.equal(index.get('XS0000000001')!.commissions.length, 0)
  assert.equal(index.get('XS0000000002')!.commissions.length, 1)
  assert.equal(index.get('XS0000000003')!.produit, undefined)
})

test('« traité » = strike, jamais l’émission', () => {
  const p = produit({ isin: 'XS0000000001', dateConstatationInitiale: '2026-06-09' })
  const l = ligne({ isin: 'XS0000000001', issue: '2026-06-23' })
  assert.equal(dateTraite(p, [l]), '2026-06-09')
  // Sans produit décodé, le registre sert de repli — mais lui seul.
  assert.equal(dateTraite(undefined, [l]), '2026-06-23')
})

test('les libellés d’un même compte ne font qu’un client', () => {
  const index = construireFiches(
    [produit({ isin: 'XS0000000001', clients: ['CAPITALL - 01227'] })],
    [ligne({ isin: 'XS0000000001', client: 'CAPITALL' })],
  )
  assert.deepEqual(index.get('XS0000000001')!.clients, ['CAPITALL'])
})

test('l’alias OPTIMAL → SAMY est respecté (même compte 01674)', () => {
  const index = construireFiches(
    [produit({ isin: 'XS0000000001', clients: ['SAMY - 01674'] })],
    [ligne({ isin: 'XS0000000001', client: 'OPTIMAL - 01674' })],
  )
  assert.deepEqual(index.get('XS0000000001')!.clients, ['SAMY'])
})

test('la fenêtre de revue est ancrée au 1er du mois, douze mois plus tôt', () => {
  assert.equal(debutFenetreRevue(new Date('2026-08-19')).toISOString().slice(0, 10), '2025-08-01')
  // Le 1er comme le 28 du même mois donnent la MÊME fenêtre : la liste ne
  // bouge pas entre deux revues mensuelles.
  assert.equal(
    debutFenetreRevue(new Date('2026-08-01')).getTime(),
    debutFenetreRevue(new Date('2026-08-28')).getTime(),
  )
})

test('un client hors fenêtre disparaît des filtres, mais garde tous ses produits', () => {
  const index = construireFiches(
    [
      produit({ isin: 'XS0000000001', clients: ['ACTIF'], dateConstatationInitiale: '2026-05-01' }),
      produit({ isin: 'XS0000000002', clients: ['ACTIF'], dateConstatationInitiale: '2019-01-01' }),
      produit({ isin: 'XS0000000003', clients: ['DORMANT'], dateConstatationInitiale: '2019-01-01' }),
    ],
    [],
  )
  const actifs = clientsActifs(index, new Date('2026-08-19'))
  assert.deepEqual(
    actifs.map((c) => c.client),
    ['ACTIF'],
  )
  // Le compte porte TOUT son portefeuille, pas seulement la fenêtre : filtrer
  // sur un client doit montrer ses lignes anciennes aussi.
  assert.equal(actifs[0].produits, 2)
  assert.equal(actifs[0].derniereOperation, '2026-05-01')
})

test('sur les vraies données, tout ISIN du registre a sa fiche', () => {
  const orphelins: string[] = []
  fiches.forEach((f: Fiche) => {
    for (const l of f.commissions) if (l.isin !== f.isin) orphelins.push(l.isin)
  })
  assert.deepEqual(orphelins, [])
  assert.equal(fiches.size > 0, true)
})
