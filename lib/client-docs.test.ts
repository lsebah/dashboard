import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cheminWindows,
  docsDuClient,
  dossierDe,
  dossiersOrphelins,
  estDer,
  radicalCode,
  type InventaireDocs,
} from './client-docs'

// ── Détection du DER ────────────────────────────────────────────────────────
test('estDer reconnaît les nommages réellement utilisés', () => {
  assert.equal(estDer('DER_Abacus_2025.pdf'), true)
  assert.equal(estDer('der abacus.pdf'), true)
  assert.equal(estDer('2025-01-12 DER signé.pdf'), true)
  assert.equal(estDer('Document d’entrée en relation - Abacus.pdf'), true)
  assert.equal(estDer('Document d entree en relation.docx'), true)
})

test('estDer n’attrape pas les mots qui contiennent « der »', () => {
  // Sans frontière de mot, ces fichiers feraient croire qu'un DER est présent
  // alors que le document réglementaire manque — l'inverse du but recherché.
  assert.equal(estDer('dernier_releve_2025.pdf'), false)
  assert.equal(estDer('Ordre de souscription.pdf'), false)
  assert.equal(estDer('Calendrier.xlsx'), false)
  assert.equal(estDer('KYC.pdf'), false)
})

// ── Rapprochement dossier ↔ client ──────────────────────────────────────────
test('radicalCode retire le numéro de compte', () => {
  assert.equal(radicalCode('ABACUS - 05268'), 'abacus')
  assert.equal(radicalCode('MY WAY - 05692'), 'my way')
  assert.equal(radicalCode('MACIF'), 'macif')
})

const DOSSIERS = {
  'ABACUS - 05268': [{ nom: 'DER_Abacus.pdf' }, { nom: 'KYC.pdf' }],
  Scala: [{ nom: 'convention.pdf' }],
  'Ancien prospect': [{ nom: 'note.pdf' }],
}

test('dossierDe rapproche par égalité stricte puis par radical', () => {
  assert.equal(dossierDe('ABACUS - 05268', DOSSIERS), 'ABACUS - 05268')
  // Dossier « Scala » ↔ client « SCALA - 05722 » : le numéro manque côté OneDrive.
  assert.equal(dossierDe('SCALA - 05722', DOSSIERS), 'Scala')
  assert.equal(dossierDe('INCONNU - 00000', DOSSIERS), undefined)
})

test('dossierDe ne tranche pas une ambiguïté', () => {
  // Deux dossiers pour le même radical : associer l'un des deux au hasard
  // afficherait les pièces d'un client sur la fiche d'un autre.
  const amb = { SCALA: [{ nom: 'a.pdf' }], 'Scala - ancien': [{ nom: 'b.pdf' }] }
  assert.equal(dossierDe('SCALA - 05722', amb), undefined)
})

// ── Vue par client ──────────────────────────────────────────────────────────
const INV: InventaireDocs = { genere: '2026-08-13T06:00:00.000Z', racine: 'Documents/Clients', dossiers: DOSSIERS }

test('docsDuClient isole le DER et liste le reste', () => {
  const d = docsDuClient('ABACUS - 05268', INV)
  assert.equal(d.dossier, 'ABACUS - 05268')
  assert.equal(d.der?.nom, 'DER_Abacus.pdf')
  assert.deepEqual(d.autres.map((f) => f.nom), ['KYC.pdf'])
})

test('docsDuClient distingue « dossier sans DER » de « pas de dossier »', () => {
  const sansDer = docsDuClient('SCALA - 05722', INV)
  assert.equal(sansDer.dossier, 'Scala')
  assert.equal(sansDer.der, undefined)
  assert.deepEqual(sansDer.autres.map((f) => f.nom), ['convention.pdf'])

  const sansDossier = docsDuClient('MACIF', INV)
  assert.equal(sansDossier.dossier, undefined)
  assert.equal(sansDossier.der, undefined)
  assert.deepEqual(sansDossier.autres, [])
})

test('docsDuClient retient le DER le plus récent en cas de renouvellement', () => {
  const inv: InventaireDocs = {
    genere: null,
    racine: 'Documents/Clients',
    dossiers: {
      X: [
        { nom: 'DER 2023.pdf', modifie: '2023-03-01T00:00:00Z' },
        { nom: 'DER 2026.pdf', modifie: '2026-02-01T00:00:00Z' },
      ],
    },
  }
  const d = docsDuClient('X', inv)
  assert.equal(d.der?.nom, 'DER 2026.pdf')
  // L'ancien DER reste visible dans les autres pièces (il n'est pas perdu).
  assert.deepEqual(d.autres.map((f) => f.nom), ['DER 2023.pdf'])
})

test('docsDuClient sans inventaire ne prétend rien', () => {
  const d = docsDuClient('ABACUS - 05268', null)
  assert.equal(d.dossier, undefined)
  assert.equal(d.der, undefined)
  assert.equal(d.chemin, cheminWindows('ABACUS - 05268'))
})

test('cheminWindows pointe le dossier de référence', () => {
  assert.equal(
    cheminWindows('ABACUS - 05268'),
    'C:\\Users\\lseba\\OneDrive - CMF\\Documents\\Clients\\ABACUS - 05268',
  )
})

// ── Dossiers orphelins ──────────────────────────────────────────────────────
test('dossiersOrphelins signale les dossiers rattachés à aucun client', () => {
  const orph = dossiersOrphelins(['ABACUS - 05268', 'SCALA - 05722'], INV)
  assert.deepEqual(orph, ['Ancien prospect'])
})
