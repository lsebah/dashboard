import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appliquerSurcouches } from './server-overlays'
import type { Product } from './types'

// Squelette minimal : seuls les champs utilisés par la fusion comptent.
const produit = (isin: string, extra: Partial<Product> = {}): Product =>
  ({ isin, nom: `Produit ${isin}`, ...extra }) as Product

const BASE = [
  produit('XS0000000001', { allocations: [{ client: 'ABACUS - 05268', montant: 100000 }] }),
  produit('XS0000000002', { statut: 'vivant' }),
]

test('sans surcouche, la liste du dépôt est rendue telle quelle', () => {
  const r = appliquerSurcouches(BASE, {})
  assert.equal(r.products.length, 2)
  assert.deepEqual(r.allocsOf(BASE[0]), [{ client: 'ABACUS - 05268', montant: 100000 }])
})

test('un trade saisi dans l’interface entre dans le périmètre du reporting', () => {
  // Cas réel : les tickets ARCHE du 18/08 et 21/08 n'existaient dans aucun
  // fichier du dépôt — ils étaient visibles au Portefeuille mais absents du relevé.
  const r = appliquerSurcouches(BASE, {
    produitsLocaux: [produit('XS3461528773')],
    allocations: { XS3461528773: [{ client: 'ARCHE - 05272', montant: 3525000 }] },
  })
  const ajoute = r.products.find((p) => p.isin === 'XS3461528773')
  assert.ok(ajoute, 'le produit local doit apparaître')
  assert.deepEqual(r.allocsOf(ajoute!), [{ client: 'ARCHE - 05272', montant: 3525000 }])
})

test('un produit local ne duplique pas un ISIN déjà présent, il le complète', () => {
  const r = appliquerSurcouches(BASE, { produitsLocaux: [produit('XS0000000001', { nom: 'Renommé' })] })
  assert.equal(r.products.filter((p) => p.isin === 'XS0000000001').length, 1)
  assert.equal(r.products.find((p) => p.isin === 'XS0000000001')!.nom, 'Renommé')
})

test('un statut forcé dans l’interface s’applique au reporting', () => {
  // Sans ça, un produit marqué Vendu à l'écran resterait sur le relevé du client.
  const r = appliquerSurcouches(BASE, { statuts: { XS0000000002: 'vendu' } })
  assert.equal(r.products.find((p) => p.isin === 'XS0000000002')!.statut, 'vendu')
})

test('un renommage manuel suit sur le relevé', () => {
  const r = appliquerSurcouches(BASE, { noms: { XS0000000001: 'Phoenix Mémoire — nom retenu' } })
  assert.equal(r.products.find((p) => p.isin === 'XS0000000001')!.nom, 'Phoenix Mémoire — nom retenu')
})

test('la surcouche d’allocation prime sur celle du feed', () => {
  const r = appliquerSurcouches(BASE, {
    allocations: { XS0000000001: [{ client: 'SCALA - 05722', montant: 50000 }] },
  })
  assert.deepEqual(r.allocsOf(BASE[0]), [{ client: 'SCALA - 05722', montant: 50000 }])
})

test('allocMap est exposée telle quelle pour la traversée serveur → client', () => {
  // Une fonction ne peut pas être passée à un composant client : c'est la map
  // brute qui voyage, et le composant reconstruit la résolution à l'identique.
  const allocations = { XS0000000001: [{ client: 'SCALA - 05722' }] }
  const r = appliquerSurcouches(BASE, { allocations })
  assert.deepEqual(r.allocMap, allocations)
})

test('des surcouches vides ou nulles ne cassent rien', () => {
  const r = appliquerSurcouches(BASE, { produitsLocaux: null, allocations: null, statuts: null, noms: null })
  assert.equal(r.products.length, 2)
  assert.deepEqual(r.allocMap, {})
})

test('un produit local sans ISIN exploitable est ignoré', () => {
  const r = appliquerSurcouches(BASE, {
    produitsLocaux: [produit(''), { nom: 'sans isin' } as Product, produit('XS9999999999')],
  })
  assert.deepEqual(
    r.products.map((p) => p.isin).sort(),
    ['XS0000000001', 'XS0000000002', 'XS9999999999'],
  )
})
