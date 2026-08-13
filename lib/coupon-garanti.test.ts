import { test } from 'node:test'
import assert from 'node:assert/strict'
import { products } from './products'
import { suiviCoupons } from './lifecycle'

// ─────────────────────────────────────────────────────────────────────────
//  Invariant : le badge « Coupon garanti » et le terme `couponGaranti` doivent
//  dire la même chose.
//
//  Origine : XS3262011201 (Marex Inverse Reverse Autocall USO) portait le badge
//  « Coupon garanti » et un commentaire « garanti » dans le code, mais PAS le
//  drapeau `terms.couponGaranti`. Or c'est ce drapeau — et lui seul — que lit
//  lib/lifecycle.ts pour décider si un coupon est acquis. Sans lui, la condition
//  est dérivée du niveau constaté face à une barrière de coupon qui n'existe
//  pas : les quatre trimestres restaient « à constater » alors que la termsheet
//  les garantit.
//
//  Le badge est ce que l'œil voit, le terme est ce que le calcul lit. Quand les
//  deux divergent, c'est le calcul qui gagne en silence — donc on interdit la
//  divergence.
// ─────────────────────────────────────────────────────────────────────────

const BADGE = 'Coupon garanti'

// Périmètre : les produits à mécanisme AUTOCALL. Le champ `couponGaranti` porte
// deux sens distincts selon la famille (lib/types.ts) — « coupon inconditionnel,
// sans barrière » pour un autocall, « coupon non réduit par les événements de
// crédit » pour une CLN. Confondre les deux ferait échouer l'invariant sur des
// produits parfaitement décodés (CLN Crossover, dettes privées).
const estAutocall = (p: (typeof products)[number]) =>
  (p.terms as { kind?: string } | undefined)?.kind === 'autocall'

test('tout produit badgé « Coupon garanti » porte le terme correspondant', () => {
  const manquants = products
    .filter(estAutocall)
    .filter((p) => (p.badges ?? []).includes(BADGE))
    .filter((p) => {
      const t = p.terms as { couponGaranti?: boolean; couponGarantiPct?: number } | undefined
      return t?.couponGaranti !== true && typeof t?.couponGarantiPct !== 'number'
    })
    .map((p) => `${p.isin} — ${p.nom}`)

  assert.deepEqual(
    manquants,
    [],
    `Badge « ${BADGE} » sans terme couponGaranti (le coupon sera calculé comme conditionnel) :\n  ${manquants.join('\n  ')}`,
  )
})

test('tout produit à coupon garanti l’affiche au porteur', () => {
  // Sens inverse : un coupon inconditionnel qui ne se voit pas sur la fiche est
  // une information due au client qui n'est pas donnée.
  const sansBadge = products
    .filter(estAutocall)
    .filter((p) => {
      const t = p.terms as { couponGaranti?: boolean } | undefined
      return t?.couponGaranti === true
    })
    .filter((p) => !(p.badges ?? []).includes(BADGE))
    .map((p) => `${p.isin} — ${p.nom}`)

  assert.deepEqual(sansBadge, [], `Coupon garanti non signalé par un badge :\n  ${sansBadge.join('\n  ')}`)
})

test('XS3262011201 est décodé comme un coupon garanti trimestriel', () => {
  // Termsheet Marex, section PRODUCT DESCRIPTION : « a pre-defined guaranteed
  // Coupon Amount » ; section COUPON : Coupon Rate 3,775 % aux 4 dates de
  // paiement (22/06/2026, 21/09/2026, 21/12/2026, 19/03/2027).
  const p = products.find((x) => x.isin === 'XS3262011201')
  assert.ok(p, 'produit introuvable')
  const t = p!.terms as { kind: string; couponGaranti?: boolean; couponPa?: number }
  assert.equal(t.couponGaranti, true)
  assert.equal(t.couponPa, 15.1)
  assert.equal(p!.observations?.length, 4)
  for (const o of p!.observations ?? []) assert.equal(o.couponPct, 3.775)
  // Aucune barrière de coupon : un coupon garanti n'en a pas, et en poser une
  // rendrait la condition dépendante du niveau.
  for (const o of p!.observations ?? []) assert.equal(o.niveauCouponPct, undefined)
})

test('XS3262011201 : un trimestre échu est ACQUIS, pas « à constater »', () => {
  // C'est le symptôme rapporté. Date figée juste après la 1re observation
  // (12/06/2026) pour que le test ne dépende pas du jour où il tourne.
  const p = products.find((x) => x.isin === 'XS3262011201')!
  const lignes = suiviCoupons(p, new Date('2026-06-20T00:00:00Z'))
  assert.deepEqual(
    lignes.map((l) => l.statut),
    ['paye', 'a_venir', 'a_venir', 'a_venir'],
  )
  // Le coupon garanti tombe sans regarder le niveau du sous-jacent : le cumul
  // acquis vaut le taux de la période, même sans niveau constaté (le cumul est
  // arrondi à 2 décimales par suiviCoupons, d'où 3,78 et non 3,775).
  assert.equal(lignes[0].cumulPayePct, 3.78)
})
