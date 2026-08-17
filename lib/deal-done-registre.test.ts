import { test } from 'node:test'
import assert from 'node:assert/strict'
import { croiserAvecRegistre, memeAffaire } from './deal-done-registre.ts'
import type { Deal } from './deal-done.ts'
import type { CommissionLigne } from './commissions.ts'

const D = (o: Partial<Deal>): Deal =>
  ({ id: 'x', date: '2026-03-01', rr: 'MH', produit: 'Produit', ...o }) as Deal
const L = (o: Partial<CommissionLigne>): CommissionLigne =>
  ({ isin: 'XS1', issue: '2026-03-01', nominal: 100000, ufPct: 0.05, ...o }) as CommissionLigne

test('l’ISIN identique suffit à rapprocher', () => {
  assert.ok(memeAffaire(D({ isin: 'XS1', produit: 'Rien à voir' }), L({ description: 'Autre chose' })))
})

test('deux mots distinctifs rapprochent, un seul ne suffit pas', () => {
  // « Rheinmetall » seul apparaît dans quatre produits 2026 : un mot commun ne
  // prouve rien.
  const l = L({ description: 'Phoenix Mémoire Wof Rheinmetall + Safran' })
  assert.equal(memeAffaire(D({ produit: 'Athéna Rheinmetall + Thales' }), l), false)
  assert.ok(memeAffaire(D({ produit: 'Phoenix Mémoire Rheinmetall / Safran' }), l))
})

test('pluriels et abréviations ne cassent plus le rapprochement', () => {
  // Le registre écrit « Ferroviaires + Infra », l'annonce « Ferroviaire /
  // Infrastructure » : sans comparaison par préfixe, le produit sortait deux fois.
  assert.ok(
    memeAffaire(
      D({ produit: 'Phoenix Mémoire Ferroviaire / Infrastructure' }),
      L({ description: 'Phoenix Memoire Ferroviaires + Infra' }),
    ),
  )
})

test('une ligne sans annonce devient un deal marqué comme tel', () => {
  const r = croiserAvecRegistre([], [L({ isin: 'XS9', description: 'Athena Vinci Bouygues', emetteur: 'SG' })])
  assert.equal(r.ajoutes.length, 1)
  assert.equal(r.ajoutes[0].isin, 'XS9')
  assert.equal(r.ajoutes[0].ufGlobal, 5)
  assert.equal(r.ajoutes[0].rr, undefined, 'le registre ne porte pas de RR')
  assert.equal(r.ajoutes[0].source, 'registre des commissions')
})

test('plusieurs clients sur un ISIN ne font qu’un deal, nominal cumulé', () => {
  const r = croiserAvecRegistre(
    [],
    [
      L({ isin: 'XS9', client: 'A', nominal: 200000, description: 'Athena Vinci' }),
      L({ isin: 'XS9', client: 'B', nominal: 300000, description: 'Athena Vinci' }),
    ],
  )
  assert.equal(r.ajoutes.length, 1)
  assert.equal(r.ajoutes[0].nominal, 500000)
})

test('le rapprochement ENRICHIT sans écraser l’UF du deal done', () => {
  // Règle du 16/08 : l'upfront du deal done fait foi, celui du registre non.
  const deal = D({ produit: 'Phoenix Vinci Bouygues', ufGlobal: 3, nominal: 111 })
  const r = croiserAvecRegistre([deal], [L({ isin: 'XS9', description: 'Phoenix Vinci Bouygues', ufPct: 0.09, nominal: 999 })])
  assert.equal(r.ajoutes.length, 0)
  assert.deepEqual(r.rapproches, ['XS9'])
  assert.equal(r.deals[0].isin, 'XS9', 'ISIN comblé')
  assert.equal(r.deals[0].ufGlobal, 3, 'UF du deal done conservée')
  assert.equal(r.deals[0].nominal, 111, 'nominal du deal done conservé')
})

test('FEI et les autres années restent hors périmètre', () => {
  const r = croiserAvecRegistre([], [
    L({ isin: 'FEI', description: 'Dette privée' }),
    L({ isin: 'XS7', issue: '2025-06-01', description: 'Vieux deal' }),
  ])
  assert.equal(r.ajoutes.length, 0)
})

test('un ISIN du registre ne s’attache pas deux fois au même deal', () => {
  const deal = D({ produit: 'Phoenix Vinci Bouygues' })
  const r = croiserAvecRegistre([deal], [
    L({ isin: 'XS1', description: 'Phoenix Vinci Bouygues' }),
    L({ isin: 'XS2', description: 'Phoenix Vinci Bouygues' }),
  ])
  assert.equal(r.rapproches.length, 1)
  assert.equal(r.ajoutes.length, 1, "le second devient un deal à part, il n'est pas perdu")
})
