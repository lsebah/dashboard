import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  abonne,
  ficheParDefaut,
  formatPourcentage,
  fusionnerFiches,
  motifBlocage,
  normaliserFiche,
  parsePourcentage,
  separerEmails,
} from './clients-fiches'

// ── Adresses ────────────────────────────────────────────────────────────────
test('separerEmails accepte les deux séparateurs du fichier historique', () => {
  const r = separerEmails('scome@appn.asso.fr, driboud.appn@wanadoo.fr; a@b.co')
  assert.deepEqual(r.valides, ['scome@appn.asso.fr', 'driboud.appn@wanadoo.fr', 'a@b.co'])
  assert.deepEqual(r.invalides, [])
})

test('separerEmails isole les adresses illisibles au lieu de les envoyer', () => {
  // L'ancien filtre était `e.includes('@')` : « jean@ » partait chez Resend et
  // échouait au milieu de l'envoi, sans qu'on sache lequel.
  const r = separerEmails('ok@cmf.finance, jean@, pas-une-adresse')
  assert.deepEqual(r.valides, ['ok@cmf.finance'])
  assert.deepEqual(r.invalides, ['jean@', 'pas-une-adresse'])
})

test('separerEmails dédoublonne sans tenir compte de la casse', () => {
  const r = separerEmails('L.Sebah@cmf.finance, l.sebah@cmf.finance')
  assert.equal(r.valides.length, 1)
})

test('separerEmails tolère une valeur absente', () => {
  assert.deepEqual(separerEmails(undefined).valides, [])
  assert.deepEqual(separerEmails('').valides, [])
})

// ── Pourcentage ─────────────────────────────────────────────────────────────
test('parsePourcentage convertit une saisie en pourcent vers un décimal', () => {
  assert.equal(parsePourcentage('0,5'), 0.005)
  assert.equal(parsePourcentage('0.5'), 0.005)
  assert.equal(parsePourcentage('0,5 %'), 0.005)
  assert.equal(parsePourcentage('1'), 0.01)
})

test('parsePourcentage refuse le hors-bornes plutôt que de l’approcher', () => {
  assert.equal(parsePourcentage('-1'), undefined)
  assert.equal(parsePourcentage('101'), undefined)
  assert.equal(parsePourcentage('abc'), undefined)
  assert.equal(parsePourcentage(''), undefined)
  assert.equal(parsePourcentage(null), undefined)
})

test('formatPourcentage fait l’aller-retour sans dérive', () => {
  assert.equal(formatPourcentage(0.005), '0,5')
  assert.equal(formatPourcentage(0.0125), '1,25')
  assert.equal(formatPourcentage(undefined), '')
  assert.equal(parsePourcentage(formatPourcentage(0.0075)), 0.0075)
})

// ── Migration sans régression ───────────────────────────────────────────────
test('la fiche par défaut reproduit le comportement d’avant la Maintenance', () => {
  // Aujourd'hui : le mensuel part à tous ceux qui ont une adresse ; l'hebdo ne
  // part à AUCUN client (il part en lot à Laurent). Le déploiement ne doit ni
  // ajouter ni retirer un destinataire.
  const avec = ficheParDefaut('ABACUS - 05268', 'nicolas.courivaud@abacuspatrimoine.com')
  assert.equal(avec.envoiMensuel, true)
  assert.equal(avec.envoiHebdo, false)

  const sans = ficheParDefaut('ALVES - 06001', '')
  assert.equal(sans.envoiMensuel, false)
  assert.equal(sans.envoiHebdo, false)
})

test('une adresse illisible ne vaut pas abonnement par défaut', () => {
  const f = ficheParDefaut('X', 'pas-une-adresse')
  assert.equal(f.envoiMensuel, false)
})

// ── Fusion ──────────────────────────────────────────────────────────────────
const HISTO = {
  _README: 'ignoré',
  'ABACUS - 05268': 'nicolas.courivaud@abacuspatrimoine.com',
  'ALVES - 06001': '',
}

test('fusionnerFiches fait l’union du portefeuille, du fichier et des fiches', () => {
  const out = fusionnerFiches({
    codesConnus: ['SAMY - 01674'],
    fiches: { 'NOUVEAU - 09999': { code: 'NOUVEAU - 09999', envoiHebdo: true, envoiMensuel: false } },
    emailsHistoriques: HISTO,
  })
  const codes = out.map((f) => f.code)
  assert.deepEqual(codes.sort(), ['ABACUS - 05268', 'ALVES - 06001', 'NOUVEAU - 09999', 'SAMY - 01674'].sort())
  // La clé de documentation du fichier historique n'est pas un client.
  assert.equal(codes.includes('_README'), false)
})

test('une fiche enregistrée prime sur la valeur par défaut', () => {
  const out = fusionnerFiches({
    codesConnus: [],
    // ABACUS a une adresse dans l'historique → défaut = mensuel actif. La fiche
    // le désabonne : c'est la fiche qui doit gagner, sinon décocher ne sert à rien.
    fiches: { 'ABACUS - 05268': { code: 'ABACUS - 05268', envoiHebdo: false, envoiMensuel: false } },
    emailsHistoriques: HISTO,
  })
  const abacus = out.find((f) => f.code === 'ABACUS - 05268')!
  assert.equal(abacus.origine, 'fiche')
  assert.equal(abacus.envoiMensuel, false)
})

test('fusionnerFiches expose les destinataires exploitables', () => {
  const out = fusionnerFiches({ codesConnus: [], fiches: null, emailsHistoriques: HISTO })
  const abacus = out.find((f) => f.code === 'ABACUS - 05268')!
  assert.deepEqual(abacus.destinataires, ['nicolas.courivaud@abacuspatrimoine.com'])
  assert.equal(abacus.origine, 'defaut')
})

test('fusionnerFiches trie par code (lecture stable de la liste)', () => {
  const out = fusionnerFiches({ codesConnus: ['ZZZ', 'AAA'], fiches: null, emailsHistoriques: {} })
  assert.deepEqual(out.map((f) => f.code), ['AAA', 'ZZZ'])
})

// ── Abonnement / blocage ────────────────────────────────────────────────────
test('abonne lit la bonne case selon la cadence', () => {
  const f = { envoiHebdo: true, envoiMensuel: false }
  assert.equal(abonne(f, 'hebdo'), true)
  assert.equal(abonne(f, 'mensuel'), false)
})

test('motifBlocage nomme précisément ce qui empêche l’envoi', () => {
  const base = { code: 'X', envoiHebdo: true, envoiMensuel: true, origine: 'fiche' as const }
  assert.equal(motifBlocage({ ...base, destinataires: ['a@b.co'], emailsInvalides: [] }), undefined)
  assert.equal(motifBlocage({ ...base, destinataires: [], emailsInvalides: [] }), 'aucune adresse email')
  assert.match(
    motifBlocage({ ...base, destinataires: [], emailsInvalides: ['jean@'] })!,
    /illisible.*jean@/,
  )
})

// ── Normalisation de l'entrée ───────────────────────────────────────────────
test('normaliserFiche refuse une fiche sans code', () => {
  assert.equal(normaliserFiche({ nom: 'X' }), undefined)
  assert.equal(normaliserFiche({ code: '   ' }), undefined)
  assert.equal(normaliserFiche(null), undefined)
})

test('normaliserFiche filtre les assureurs inconnus et borne la rétro', () => {
  const f = normaliserFiche({
    code: 'X',
    avFrance: ['AXA', 'Inconnu', 'Nortia'],
    retroIndic: 0.005,
    envoiHebdo: true,
    envoiMensuel: 'oui',
  })!
  assert.deepEqual(f.avFrance, ['AXA', 'Nortia'])
  assert.equal(f.retroIndic, 0.005)
  assert.equal(f.envoiHebdo, true)
  // Toute valeur non booléenne vaut « non coché » : on n'abonne jamais par
  // interprétation d'une entrée douteuse.
  assert.equal(f.envoiMensuel, false)
})

test('normaliserFiche rejette une rétro hors [0 ; 1] au lieu de la tronquer', () => {
  assert.equal(normaliserFiche({ code: 'X', retroIndic: 5, envoiHebdo: false, envoiMensuel: false })!.retroIndic, undefined)
  assert.equal(normaliserFiche({ code: 'X', retroIndic: -0.1, envoiHebdo: false, envoiMensuel: false })!.retroIndic, undefined)
})

test('normaliserFiche vide les chaînes blanches (pas de « » fantôme)', () => {
  const f = normaliserFiche({ code: 'X', nom: '   ', tel: ' 06 12 ', envoiHebdo: false, envoiMensuel: false })!
  assert.equal(f.nom, undefined)
  assert.equal(f.tel, '06 12')
})
