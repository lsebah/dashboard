import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lignesAFacturer } from './facturation'
import { construireFiches } from './fiches'
import { fiches } from './fiches'
import type { Product } from './types'
import type { CommissionLigne } from './commissions'

// ─────────────────────────────────────────────────────────────────────────
//  Une ligne « à établir » sert à RAPPELER qu'une facturation manque. Elle ne
//  doit donc rien affirmer sur l'argent : le jour où elle porterait un UF
//  plausible ou un net estimé, elle entrerait dans les totaux et le registre
//  cesserait d'être vérifiable. Ces tests verrouillent ce silence.
// ─────────────────────────────────────────────────────────────────────────

const produit = (p: Partial<Product> & { isin: string }): Product =>
  ({
    id: p.isin,
    nom: 'Produit test',
    emetteur: 'BNP Paribas',
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
    statut: 'vivant',
    ...p,
  }) as Product

const ligne = (l: Partial<CommissionLigne> & { isin: string }): CommissionLigne =>
  ({
    issue: '2026-06-15', client: 'X', emetteur: null, description: null, devise: null,
    nominal: null, ufPct: null, comCmf: null, retroPct: null, comClient: null,
    comTotal: null, facture: null, sent: null, credited: null, split: null, net: null,
    ...l,
  }) as CommissionLigne

test('un deal déjà facturé ne génère aucune ligne à établir', () => {
  const index = construireFiches([produit({ isin: 'XS0000000001' })], [ligne({ isin: 'XS0000000001' })])
  assert.deepEqual(lignesAFacturer(index), [])
})

test('un deal sans aucune ligne en génère une par allocation client', () => {
  const index = construireFiches(
    [
      produit({
        isin: 'XS0000000001',
        allocations: [
          { client: 'ALVES - 06001', montant: 200_000 },
          { client: 'VIA - 08001', montant: 300_000 },
        ],
      }),
    ],
    [],
  )
  const out = lignesAFacturer(index)
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((l) => l.nominal).sort((a, b) => (a ?? 0) - (b ?? 0)), [200_000, 300_000])
})

test('aucun montant de facturation n’est inventé', () => {
  const index = construireFiches(
    [produit({ isin: 'XS0000000001', allocations: [{ client: 'ALVES - 06001', montant: 200_000 }] })],
    [],
  )
  const [l] = lignesAFacturer(index)
  // Le nominal est LU (allocation dépositaire) ; tout le reste est à saisir.
  assert.equal(l.nominal, 200_000)
  for (const champ of ['ufPct', 'retroPct', 'comCmf', 'comClient', 'comTotal', 'net', 'facture', 'sent', 'credited', 'split'] as const) {
    assert.equal(l[champ], null, champ)
  }
  assert.equal(l.aFacturer, true)
})

test('un produit clos n’a plus rien à facturer', () => {
  const vivant = produit({ isin: 'XS0000000001', clients: ['A'] })
  const clos = produit({ isin: 'XS0000000002', clients: ['A'], statut: 'rappele' })
  const index = construireFiches([vivant, clos], [])
  assert.deepEqual(lignesAFacturer(index).map((l) => l.isin), ['XS0000000001'])
  // …sauf si on les demande explicitement.
  assert.equal(lignesAFacturer(index, { inclureClos: true }).length, 2)
})

test('un deal sans allocation connue reste visible, sans client', () => {
  const index = construireFiches([produit({ isin: 'XS0000000001' })], [])
  const out = lignesAFacturer(index)
  assert.equal(out.length, 1)
  assert.equal(out[0].client, null)
  assert.equal(out[0].nominal, null)
})

test('sur les vraies données, aucune ligne à établir ne double le registre', () => {
  const out = lignesAFacturer(fiches)
  const auRegistre = new Set<string>()
  fiches.forEach((f) => {
    if (f.commissions.length > 0) auRegistre.add(f.isin)
  })
  for (const l of out) assert.equal(auRegistre.has(l.isin), false, l.isin)
  // Et leur poids dans les totaux est nul, par construction.
  const somme = out.reduce((s, l) => s + (l.net ?? 0) + (l.comTotal ?? 0) + (l.comClient ?? 0), 0)
  assert.equal(somme, 0)
})
