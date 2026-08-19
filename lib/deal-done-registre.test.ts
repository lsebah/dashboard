import { test } from 'node:test'
import assert from 'node:assert/strict'
import { croiserAvecRegistre, memeAffaire } from './deal-done-registre.ts'
import { dedoublonner } from './deal-done.ts'
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
  assert.equal(r.ajoutes[0].rr, 'LS', 'affaires reprises du registre = LS (confirmé le 18/08)')
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

test('le RR par défaut reste paramétrable', () => {
  const r = croiserAvecRegistre([], [L({ isin: 'XS9', description: 'Athena Vinci' })], '2026', 'MH')
  assert.equal(r.ajoutes[0].rr, 'MH')
})

test('les tickets saisis dans Lifecycle comptent autant que le fichier', () => {
  // Les deux tickets ARCHE d'août 2026 ne sont PAS dans commissions.json : ils
  // ont été saisis dans Lifecycle et vivent en KV. Ne croiser que le fichier
  // versionné les faisait disparaître du Deal Done.
  const local = L({
    isin: 'XS3461528773',
    issue: '2026-08-21',
    client: 'ARCHE - 05272',
    emetteur: 'BNP',
    devise: 'USD',
    nominal: 3525000,
    ufPct: 0.0045,
    description: '3.5Y Buffered Return Enhanced S&P 500',
  })
  const r = croiserAvecRegistre([], [local])
  assert.equal(r.ajoutes.length, 1)
  assert.equal(r.ajoutes[0].isin, 'XS3461528773')
  assert.equal(r.ajoutes[0].devise, 'USD')
  assert.equal(r.ajoutes[0].ufGlobal, 0.45)
})

test('c’est le STRIKE qui date une affaire reprise, pas l’émission', () => {
  // L'émission tombe souvent plusieurs semaines après le trade : dater sur elle
  // rangeait l'affaire bien après le moment où elle a été faite.
  const l = L({ isin: 'XS9', issue: '2026-04-22', description: 'Athena Vinci' })
  const r = croiserAvecRegistre([], [l], '2026', 'LS', { XS9: '2026-04-01' })
  assert.equal(r.ajoutes[0].date, '2026-04-01', 'strike')
  assert.equal(r.ajoutes[0].dateEmission, '2026-04-22', "l'émission reste dans son champ")
})

test('strike absent : la date d’émission prend le relais', () => {
  // Règle du 18/08 : « si date de strike absente, utilise issue date ».
  const r = croiserAvecRegistre([], [L({ isin: 'XS9', issue: '2026-04-22', description: 'Athena Vinci' })])
  assert.equal(r.ajoutes[0].date, '2026-04-22')
})

test('un ISIN présent des deux côtés TRANCHE, dans les deux sens', () => {
  // Le défaut qui a collé le FR1459ABG521 (Copper & Power) sur l'Autocall
  // MXEADT50 : le deal portait déjà SON ISIN, mais le rapprochement se faisait
  // quand même par libellé, et la ligne du registre disparaissait avec lui.
  const deal = D({ isin: 'XS-AUTRE', produit: 'Autocall Dégressif MXEADT50' })
  const l = L({ isin: 'FR-CELUI-CI', description: 'Phoenix MSCI ACWI Copper Power Select 50 Points' })
  assert.equal(memeAffaire(deal, l), false)
  const r = croiserAvecRegistre([deal], [l])
  assert.equal(r.ajoutes.length, 1, 'la ligne du registre devient une affaire, elle ne se perd pas')
  assert.equal(r.deals[0].isin, 'XS-AUTRE', "l'ISIN du deal n'est pas écrasé")
})

test('le vocabulaire d’indice ne rapproche rien', () => {
  const deal = D({ produit: 'Autocall Dégressif MXEADT50 MSCI Europe Aerospace Defense Select 50 Points Decrement' })
  const l = L({ description: 'Phoenix Autocallable MSCI ACWI IMI Copper Power Select 20 Fixed Basket 50 Points DIV' })
  assert.equal(memeAffaire(deal, l), false)
})

test('émetteurs différents : pas de rapprochement par libellé', () => {
  const deal = D({ produit: 'Phoenix Engie Nexans Schneider', emetteur: 'Barclays' })
  const l = L({ description: 'Phoenix Engie Nexans Schneider', emetteur: 'BBVA' })
  assert.equal(memeAffaire(deal, l), false)
})

test('un thème commercial confirmé DISTINCT n’est plus signalé « à vérifier »', () => {
  // Cas réel : « Phoenix Mémoire Réarmement Europe » vendu à deux clients par
  // deux émetteurs différents (BNP/OPTIMAL XS3266613416, BBVA/APPN
  // XS3250102665), aucun des deux annoncé dans Deal Done. Le même libellé et
  // des dates à 6 jours d'écart les faisaient ressortir comme un doublon
  // potentiel, alors que ce sont deux affaires réelles distinctes (Laurent,
  // 19/08/2026).
  const lignes: CommissionLigne[] = [
    L({
      isin: 'XS3266613416',
      issue: '2026-02-26',
      client: 'OPTIMAL - 01674',
      emetteur: 'BNP',
      description: 'Phoenix Mémoire Rearmement Europe',
      nominal: 300000,
    }),
    L({
      isin: 'XS3250102665',
      issue: '2026-02-20',
      client: 'APPN - 05277',
      emetteur: 'BBVA',
      description: 'Phoenix Memoire Réarmement Europe',
      nominal: 300000,
    }),
  ]
  const r = croiserAvecRegistre([], lignes)
  assert.equal(r.ajoutes.length, 2)
  assert.ok(r.ajoutes.every((d) => d.distinctConfirme === true))

  const { aVerifier } = dedoublonner(r.ajoutes)
  assert.equal(aVerifier.length, 0)
})
