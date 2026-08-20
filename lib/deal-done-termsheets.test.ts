import { test } from 'node:test'
import assert from 'node:assert/strict'
import { memeAffaireTermsheet, croiserAvecTermsheets } from './deal-done-termsheets'
import type { Deal } from './deal-done'
import type { TermsheetMeta } from './termsheets'

// ─────────────────────────────────────────────────────────────────────────
//  Rattacher un ISIN à une annonce qui n'en porte pas, c'est utile ; en
//  rattacher un FAUX, c'est pire que rien — le deal pointerait vers le payoff
//  d'un autre produit, et plus rien dans l'écran ne le dirait. Ces tests
//  gardent le curseur du côté de l'abstention.
// ─────────────────────────────────────────────────────────────────────────

const deal = (d: Partial<Deal> & { id: string }): Deal =>
  ({ date: '2026-07-27', rr: 'LS', produit: 'Produit', source: 'Deal Done', ...d }) as Deal

const ts = (t: Partial<TermsheetMeta> & { isin: string }): TermsheetMeta =>
  ({
    fichier: 'x.pdf',
    dateEmission: '2026-07-27',
    nom: 'Produit',
    emetteur: 'MSCO',
    conforme: true,
    ...t,
  }) as TermsheetMeta

test('une annonce qui porte déjà un ISIN n’est jamais réécrite', () => {
  const d = deal({ id: 'a', isin: 'XS0000000001', produit: 'Autocall MXEADT50' })
  assert.equal(memeAffaireTermsheet(d, ts({ isin: 'XS0000000002', nom: 'Autocall MXEADT50' })), false)
})

test('émetteurs différents ⇒ affaires différentes, quels que soient les mots', () => {
  const d = deal({ id: 'a', produit: 'Autocall Dégressif MXEADT50', emetteur: 'BNP Paribas' })
  assert.equal(memeAffaireTermsheet(d, ts({ isin: 'FRIP00002TE9', nom: 'Indice Défense MXEADT50' })), false)
})

test('deux mots distinctifs communs suffisent dans le mois', () => {
  const d = deal({ id: 'a', produit: 'Autocall Dégressif MXEADT50 Défense', emetteur: 'Morgan Stanley' })
  const t = ts({ isin: 'FRIP00002TE9', nom: 'Autocall Indice Défense MXEADT50' })
  assert.equal(memeAffaireTermsheet(d, t), true)
  // Au-delà du mois, le rapprochement retombe.
  assert.equal(memeAffaireTermsheet(d, ts({ ...t, dateEmission: '2026-05-01' })), false)
})

test('un seul mot commun n’est retenu que le jour même (à une semaine près)', () => {
  const d = deal({ id: 'a', date: '2026-06-24', produit: 'Phoenix Mémoire SpaceX', emetteur: 'BBVA' })
  const t = ts({ isin: 'XS3379913869', nom: 'Phoenix Memory SpaceX', emetteur: 'BBVA', dateEmission: '2026-06-24' })
  assert.equal(memeAffaireTermsheet(d, t), true)
  assert.equal(memeAffaireTermsheet(d, ts({ ...t, dateEmission: '2026-05-24' })), false)
})

test('aucun mot distinctif commun ⇒ jamais de rattachement', () => {
  const d = deal({ id: 'a', produit: 'Athéna Dégressif LVMH', emetteur: 'Morgan Stanley' })
  assert.equal(memeAffaireTermsheet(d, ts({ isin: 'FRIP00002TE9', nom: 'Autocall Indice Défense MXEADT50' })), false)
})

// ── Sur les VRAIES données du dossier ────────────────────────────────────

test('le croisement ne réécrit aucun ISIN déjà porté', () => {
  const avant: Deal[] = [
    deal({ id: 'garde', isin: 'XS3468899185', produit: 'Phoenix Mémoire Wof BNP' }),
    deal({ id: 'vide', produit: 'Produit sans rapport aucun' }),
  ]
  const { deals } = croiserAvecTermsheets(avant, { annee: '2026' })
  assert.equal(deals.find((d) => d.id === 'garde')!.isin, 'XS3468899185')
})

test('un même ISIN du dossier ne peut pas servir deux annonces', () => {
  const jumeaux: Deal[] = [
    deal({ id: 'a', date: '2026-07-27', produit: 'Autocall Dégressif MXEADT50', emetteur: 'Morgan Stanley' }),
    deal({ id: 'b', date: '2026-07-27', produit: 'Autocall Dégressif MXEADT50', emetteur: 'Morgan Stanley' }),
  ]
  const { deals, rattaches } = croiserAvecTermsheets(jumeaux, { annee: '2026' })
  assert.equal(rattaches.length, 1)
  assert.equal(deals.filter((d) => d.isin === 'FRIP00002TE9').length, 1)
})

test('les termsheets sans affaire sont signalées, jamais transformées en deals', () => {
  const { deals, sansDeal } = croiserAvecTermsheets([deal({ id: 'seul', produit: 'Rien' })], {
    annee: '2026',
    decodes: new Set(['XS3327842855']),
  })
  // Aucune ligne n'est fabriquée : on ressort avec le même nombre d'annonces.
  assert.equal(deals.length, 1)
  assert.equal(sansDeal.length > 0, true)
  // Le drapeau `decode` dit si le payoff est déjà lu — il ne l'invente pas.
  const msft = sansDeal.find((t) => t.isin === 'XS3327842855')
  if (msft) assert.equal(msft.decode, true)
  for (const t of sansDeal) assert.equal(t.date.startsWith('2026'), true)
})
