import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autocallsProbables, bilanRappels, nominalParDevise } from './autocall-proche.ts'
import type { Product } from './types.ts'

const LE_JOUR = new Date('2026-08-17T00:00:00Z')

const P = (over: Partial<Product> & { obs: string; barriere?: number }): Product =>
  ({
    id: over.isin ?? 'X',
    isin: over.isin ?? 'X',
    nom: over.nom ?? 'Produit',
    emetteur: 'Goldman Sachs',
    assetClass: 'equity',
    family: 'autocall',
    devise: over.devise ?? 'EUR',
    nominal: over.nominal ?? 100_000,
    dateConstatationInitiale: '2025-01-01',
    dateEcheance: '2030-01-01',
    frequence: 'trimestriel',
    basket: 'worst_of',
    sousJacents: [],
    statut: over.statut,
    terms: over.terms ?? { kind: 'autocall', sens: 'standard' },
    observations: [
      {
        n: 1,
        dateObservation: over.obs,
        datePaiement: over.obs,
        autocallActif: over.observations?.[0]?.autocallActif ?? true,
        niveauRappelPct: over.barriere ?? 100,
      },
    ],
  }) as unknown as Product

test('rappel probable : observation proche et barrière franchie', () => {
  const r = autocallsProbables([P({ isin: 'A', obs: '2026-08-25', barriere: 100 })], { A: 104 }, LE_JOUR)
  assert.equal(r.length, 1)
  assert.equal(r[0].joursRestants, 8)
  assert.equal(r[0].marge, 4)
  assert.equal(r[0].inverse, false)
})

test('la fenêtre est respectée aux deux bouts', () => {
  const dans31 = autocallsProbables([P({ isin: 'A', obs: '2026-09-17' })], { A: 120 }, LE_JOUR)
  assert.equal(dans31.length, 0, '31 jours : hors fenêtre')
  const dans30 = autocallsProbables([P({ isin: 'A', obs: '2026-09-16' })], { A: 120 }, LE_JOUR)
  assert.equal(dans30.length, 1, '30 jours : dans la fenêtre')
  const aujourdHui = autocallsProbables([P({ isin: 'A', obs: '2026-08-17' })], { A: 120 }, LE_JOUR)
  assert.equal(aujourdHui.length, 1, "aujourd'hui : dans la fenêtre")
})

test('barrière non franchie : rien à signaler', () => {
  assert.equal(autocallsProbables([P({ isin: 'A', obs: '2026-08-25' })], { A: 99.9 }, LE_JOUR).length, 0)
})

test('un autocall INVERSE se déclenche à la baisse', () => {
  // Le piège : avec la comparaison standard, ce produit ne serait jamais
  // signalé alors qu'il est le plus près d'être rappelé.
  const inv = P({
    isin: 'INV',
    obs: '2026-08-25',
    barriere: 90,
    terms: { kind: 'autocall', sens: 'inverse' } as Product['terms'],
  })
  const r = autocallsProbables([inv], { INV: 85 }, LE_JOUR)
  assert.equal(r.length, 1)
  assert.equal(r[0].inverse, true)
  assert.equal(r[0].marge, 5, 'la marge reste positive quand la barrière est franchie')
  assert.equal(autocallsProbables([inv], { INV: 95 }, LE_JOUR).length, 0)
})

test('sans niveau connu, on ne signale pas', () => {
  const p = [P({ isin: 'A', obs: '2026-08-25' })]
  assert.equal(autocallsProbables(p, {}, LE_JOUR).length, 0)
  assert.equal(autocallsProbables(p, { A: null }, LE_JOUR).length, 0)
})

test('un produit mort n’est plus surveillé', () => {
  for (const statut of ['rappele', 'vendu', 'echu'] as const)
    assert.equal(
      autocallsProbables([P({ isin: 'A', obs: '2026-08-25', statut })], { A: 120 }, LE_JOUR).length,
      0,
      statut,
    )
})

test('période de non-call : observation présente mais rappel inactif', () => {
  const p = P({ isin: 'A', obs: '2026-08-25' })
  ;(p.observations as { autocallActif: boolean }[])[0].autocallActif = false
  assert.equal(autocallsProbables([p], { A: 120 }, LE_JOUR).length, 0)
})

test('tri : le plus imminent d’abord, puis la marge la plus large', () => {
  const r = autocallsProbables(
    [
      P({ isin: 'LOIN', obs: '2026-09-10' }),
      P({ isin: 'PROCHE-FAIBLE', obs: '2026-08-20' }),
      P({ isin: 'PROCHE-LARGE', obs: '2026-08-20' }),
    ],
    { LOIN: 130, 'PROCHE-FAIBLE': 100.5, 'PROCHE-LARGE': 115 },
    LE_JOUR,
  )
  assert.deepEqual(r.map((x) => x.isin), ['PROCHE-LARGE', 'PROCHE-FAIBLE', 'LOIN'])
})

test('nominalParDevise agrège sans mélanger les devises', () => {
  const r = autocallsProbables(
    [
      P({ isin: 'A', obs: '2026-08-25', nominal: 200_000 }),
      P({ isin: 'B', obs: '2026-08-26', nominal: 300_000 }),
      P({ isin: 'C', obs: '2026-08-27', nominal: 50_000, devise: 'USD' }),
    ],
    { A: 120, B: 120, C: 120 },
    LE_JOUR,
  )
  assert.deepEqual(nominalParDevise(r), { EUR: 500_000, USD: 50_000 })
})

// ── bilanRappels : le verdict complet, y compris ce qu'on ne sait pas ──────

test('un rappel DÉJÀ constaté quitte les probables', () => {
  // Cas Silver Miners : première observation active le 10/06 à 100 %, panier à
  // 170 % aujourd'hui. Sans les niveaux constatés, le produit s'affichait comme
  // « rappel probable le 10/09 » alors qu'il était rappelé depuis juin.
  const p = P({ isin: 'AG', obs: '2026-09-10', barriere: 100 })
  ;(p.observations as unknown[]).unshift({
    n: 0,
    dateObservation: '2026-06-10',
    datePaiement: '2026-06-10',
    autocallActif: true,
    niveauRappelPct: 100,
  })

  const sans = bilanRappels([p], { AG: 170 }, {}, LE_JOUR)
  assert.equal(sans.probables.length, 1, 'sans niveau constaté : faux positif')

  const avec = bilanRappels([p], { AG: 170 }, { AG: { '2026-06-10': 128 } }, LE_JOUR)
  assert.equal(avec.probables.length, 0)
  assert.equal(avec.constates.length, 1)
  assert.equal(avec.constates[0].date, '2026-06-10')
  assert.equal(avec.constates[0].niveau, 128)
})

test('ce qui ne peut pas être tranché est COMPTÉ, pas tu', () => {
  // Le silence est le vrai danger : un produit sans niveau disparaissait de la
  // liste, et son absence se lisait comme « rien à signaler ».
  const sansNiveau = P({ isin: 'SANS', obs: '2026-08-25', barriere: 100 })
  const sansBarriere = P({ isin: 'NOBAR', obs: '2026-08-26' })
  ;(sansBarriere.observations as { niveauRappelPct?: number }[])[0].niveauRappelPct = undefined

  const b = bilanRappels([sansNiveau, sansBarriere], { SANS: null }, {}, LE_JOUR)
  assert.equal(b.probables.length, 0)
  assert.equal(b.nonEvalues.length, 2)
  assert.deepEqual(
    b.nonEvalues.map((x) => [x.isin, x.motif]).sort(),
    [
      ['NOBAR', 'barrière non décodée'],
      ['SANS', 'niveau inconnu'],
    ],
  )
})

test('le non-call est une réponse, pas une lacune : compté à part', () => {
  const p = P({ isin: 'NC', obs: '2026-08-25', barriere: 100 })
  ;(p.observations as { autocallActif: boolean }[])[0].autocallActif = false
  const b = bilanRappels([p], { NC: 150 }, {}, LE_JOUR)
  assert.equal(b.nbNonCall, 1)
  assert.equal(b.nonEvalues.length, 0, 'ne doit PAS être rangé dans les non évalués')
  assert.equal(b.probables.length, 0)
})

test('bilanRappels et autocallsProbables s’accordent sur le cas simple', () => {
  const p = [P({ isin: 'A', obs: '2026-08-25', barriere: 100 })]
  const b = bilanRappels(p, { A: 104 }, {}, LE_JOUR)
  assert.deepEqual(b.probables, autocallsProbables(p, { A: 104 }, LE_JOUR))
})
