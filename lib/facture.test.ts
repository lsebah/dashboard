import { test } from 'node:test'
import assert from 'node:assert/strict'
import { factureMailto } from './facture'
import { pourcent } from './pourcentage'

// fr-FR sépare les milliers par une espace fine insécable (le même caractère
// que `pourcent()` place avant %) — jamais une espace ordinaire. Construire
// les montants attendus via toLocaleString évite de retaper ce caractère à
// la main dans les assertions ci-dessous (piège qui a fait échouer une
// première version de ce test : « 15 900 » tapé au clavier n'est PAS égal à
// « 15 900 » rendu par le code, un seul des deux ayant la bonne espace).
const eur = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })

// ─────────────────────────────────────────────────────────────────────────
//  Régression : URLSearchParams encode l'espace en « + » (convention
//  application/x-www-form-urlencoded), que les clients mail n'interprètent
//  PAS comme un espace dans un corps mailto: (RFC 6068 attend un %-encodage
//  RFC 3986, espace → %20). Le message affichait donc des « + » littéraux à
//  la place de chaque espace (signalé par Laurent le 19/08/2026).
// ─────────────────────────────────────────────────────────────────────────

const LIGNE = {
  emetteur: 'BARCLAYS',
  isin: 'XS3468899185',
  issue: '2026-09-18',
  description: 'Phoenix Mémoire Wof BNP + Société Générale + Intesa Sanpaolo',
  nominal: 265_000,
  ufPct: 0.06,
  comTotal: 15_900,
  retroPct: 0.035,
  comClient: 9_275,
  comCmf: 6_625,
  client: 'CAPITALL',
}

test('le corps mailto ne contient jamais de « + » littéral à la place d’un espace', () => {
  const url = factureMailto(LIGNE)
  const body = decodeURIComponent(url.split('body=')[1].split('&')[0])
  assert.ok(body.includes('Hello Gabrielle'), 'le corps se décode proprement')
  assert.ok(!url.includes('body=Hello+Gabrielle'), 'pas d’espace encodé en +')
})

test('Upfront Total / Rétro CGP / Net CMF apparaissent, avec le montant de rétro dans le rappel de reversement', () => {
  const url = factureMailto(LIGNE)
  const body = decodeURIComponent(url.split('body=')[1].split('&')[0])
  assert.ok(body.includes(`Upfront Total\tEUR ${eur(15_900)} (${pourcent(6, 2)})`))
  assert.ok(body.includes(`Rétro CGP\tEUR ${eur(9_275)} (${pourcent(3.5, 2)})`))
  assert.ok(body.includes(`Net CMF\t\tEUR ${eur(6_625)}`))
  assert.ok(
    body.includes(`Dès le règlement de cette facture reçu, il faudra reverser EUR ${eur(9_275)} à CAPITALL.`),
  )
})

test('sans rétrocession, ni la ligne Rétro/Net ni la phrase de reversement ne s’affichent', () => {
  const url = factureMailto({ ...LIGNE, retroPct: 0, comClient: 0 })
  const body = decodeURIComponent(url.split('body=')[1].split('&')[0])
  assert.ok(!body.includes('Rétro CGP'))
  assert.ok(!body.includes('Net CMF'))
  assert.ok(!body.includes('il faudra reverser'))
})
