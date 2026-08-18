import { test } from 'node:test'
import assert from 'node:assert/strict'
import { codeEmetteur } from './emetteurs'

test('les codes dictés par Laurent', () => {
  assert.equal(codeEmetteur('Barclays'), 'BARC')
  assert.equal(codeEmetteur('Goldman Sachs'), 'GS')
  assert.equal(codeEmetteur('CIBC'), 'CIBC')
  assert.equal(codeEmetteur('Morgan Stanley'), 'MSCO')
  assert.equal(codeEmetteur('BNP Paribas'), 'BNP')
  assert.equal(codeEmetteur('Société Générale'), 'SG')
  assert.equal(codeEmetteur('Santander'), 'SANT')
  assert.equal(codeEmetteur('Marex'), 'MARX')
})

test('les variantes rencontrées dans les données tombent sur le même code', () => {
  // Les mails et les grilles écrivent l'émetteur de dix façons ; le code doit
  // être stable sinon un même émetteur se dédouble dans les filtres.
  assert.equal(codeEmetteur('Marex Financial'), 'MARX')
  assert.equal(codeEmetteur('GSFCI'), 'GS')
  assert.equal(codeEmetteur('MS'), 'MSCO')
  assert.equal(codeEmetteur('MSCO'), 'MSCO')
  assert.equal(codeEmetteur('BNPP'), 'BNP')
  assert.equal(codeEmetteur('BNP Paribas Issuance B.V.'), 'BNP')
  assert.equal(codeEmetteur('SG'), 'SG')
  assert.equal(codeEmetteur('SOCGEN'), 'SG')
  assert.equal(codeEmetteur('SG Issuer'), 'SG')
  assert.equal(codeEmetteur('BofA'), 'BOFA')
  assert.equal(codeEmetteur('Bank of America'), 'BOFA')
  assert.equal(codeEmetteur('Goldman Sachs Finance Corp International Ltd'), 'GS')
  assert.equal(codeEmetteur('Canadian Imperial Bank of Commerce'), 'CIBC')
})

test('aucun code ne dépasse quatre capitales', () => {
  const echantillon = [
    'Barclays', 'Goldman Sachs', 'CIBC', 'Morgan Stanley', 'BNP Paribas', 'Société Générale',
    'Santander', 'Marex Financial', 'BBVA', 'BofA', 'UBS', 'Citi', 'Deutsche Bank', 'CIC',
    'EFG', 'Mediobanca', 'Nomura', 'Vinga', 'Secured Invest Partners',
  ]
  for (const nom of echantillon) {
    const c = codeEmetteur(nom)
    assert.ok(c.length <= 4, `${nom} → ${c} (${c.length} caractères)`)
    assert.equal(c, c.toUpperCase(), `${nom} → ${c} n'est pas en capitales`)
  }
})

test('le repli tronque le premier mot pour un émetteur non listé', () => {
  assert.equal(codeEmetteur('Mediobanca'), 'MEDI')
  assert.equal(codeEmetteur('Nomura'), 'NOMU')
  assert.equal(codeEmetteur('Vinga'), 'VING')
})

test('un émetteur absent ne fabrique pas de code', () => {
  assert.equal(codeEmetteur(undefined), '—')
  assert.equal(codeEmetteur(null), '—')
  assert.equal(codeEmetteur('   '), '—')
})
