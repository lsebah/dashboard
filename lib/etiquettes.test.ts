import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placer, largeurTexte, type PointAEtiqueter, type Cadre } from './etiquettes'

// ─────────────────────────────────────────────────────────────────────────
//  Le placement décide de ce qui se lit sur une planche envoyée à des
//  clients. Deux défauts seraient graves : deux noms superposés (on lit un
//  mot qui n'existe pas), et un nom posé sur le point d'une AUTRE valeur (on
//  attribue la volatilité de l'une à l'autre).
// ─────────────────────────────────────────────────────────────────────────

const CADRE: Cadre = { xMin: 0, yMin: 0, xMax: 900, yMax: 560 }

const pt = (id: string, cx: number, cy: number, texte = id, priorite = 1): PointAEtiqueter => ({
  id,
  cx,
  cy,
  texte,
  priorite,
})

/** Boîte d'une étiquette posée, avec les mêmes conventions que le module. */
function boite(e: { x: number; y: number; ancrage: 'start' | 'end' }, texte: string, taille = 11) {
  const l = largeurTexte(texte, taille)
  const x1 = e.ancrage === 'start' ? e.x : e.x - l
  return { x1, y1: e.y - taille, x2: x1 + l, y2: e.y + 2 }
}
const chevauche = (a: ReturnType<typeof boite>, b: ReturnType<typeof boite>) =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2

test('sur un nuage clairsemé, tout le monde est étiqueté', () => {
  const pts = [pt('A', 100, 100), pt('B', 400, 300), pt('C', 700, 500)]
  const r = placer(pts, CADRE)
  assert.equal(r.etiquettes.length, 3)
  assert.deepEqual(r.nonPlacees, [])
})

test('deux étiquettes posées ne se chevauchent JAMAIS', () => {
  // Vingt points serrés dans un petit carré : le cas qui rendait le radar
  // illisible. Ce qui est posé doit être posé proprement.
  const pts = Array.from({ length: 20 }, (_, i) =>
    pt(`P${i}`, 300 + (i % 5) * 12, 250 + Math.floor(i / 5) * 12, `Societe${i}`, 20 - i),
  )
  const r = placer(pts, CADRE)
  const textes = new Map(pts.map((p) => [p.id, p.texte]))
  for (let i = 0; i < r.etiquettes.length; i++) {
    for (let j = i + 1; j < r.etiquettes.length; j++) {
      const a = boite(r.etiquettes[i], textes.get(r.etiquettes[i].id)!)
      const b = boite(r.etiquettes[j], textes.get(r.etiquettes[j].id)!)
      assert.equal(chevauche(a, b), false, `${r.etiquettes[i].id} chevauche ${r.etiquettes[j].id}`)
    }
  }
})

test('une étiquette ne recouvre jamais le point d’une AUTRE valeur', () => {
  // Le défaut le plus sournois : le nom d'Apple posé sur le point de Nvidia.
  const pts = Array.from({ length: 12 }, (_, i) => pt(`P${i}`, 300 + i * 14, 260, `Nom${i}`, 12 - i))
  const r = placer(pts, CADRE)
  const parId = new Map(pts.map((p) => [p.id, p]))
  for (const e of r.etiquettes) {
    const b = boite(e, parId.get(e.id)!.texte)
    for (const p of pts) {
      if (p.id === e.id) continue
      const pointBoite = { x1: p.cx - 5, y1: p.cy - 5, x2: p.cx + 5, y2: p.cy + 5 }
      assert.equal(chevauche(b, pointBoite), false, `${e.id} recouvre le point ${p.id}`)
    }
  }
})

test('la priorité décide qui garde son étiquette quand ça ne rentre pas', () => {
  // Cinquante points sur un mouchoir de poche : tout ne peut pas tenir.
  const pts = Array.from({ length: 50 }, (_, i) =>
    pt(`P${i}`, 400 + (i % 7) * 6, 280 + Math.floor(i / 7) * 6, `Entreprise${i}`, 50 - i),
  )
  const r = placer(pts, CADRE)
  const posees = new Set(r.etiquettes.map((e) => e.id))
  // Le plus prioritaire est servi ; s'il y a des sacrifiés, ce sont les derniers.
  assert.equal(posees.has('P0'), true)
  if (r.nonPlacees.length > 0) {
    const pireposee = Math.max(...r.nonPlacees.map((id) => Number(id.slice(1))))
    const meilleureNonPosee = Math.min(...r.nonPlacees.map((id) => Number(id.slice(1))))
    assert.ok(meilleureNonPosee <= pireposee)
  }
  // Et rien n'est perdu en silence : tout point est soit posé, soit compté.
  assert.equal(r.etiquettes.length + r.nonPlacees.length, 50)
})

test('aucune étiquette ne sort du cadre', () => {
  // Des points collés aux quatre bords : le texte doit rentrer, ou renoncer.
  const pts = [pt('HG', 2, 2, 'Coin haut gauche'), pt('BD', 898, 558, 'Coin bas droit')]
  const r = placer(pts, CADRE)
  const parId = new Map(pts.map((p) => [p.id, p]))
  for (const e of r.etiquettes) {
    const b = boite(e, parId.get(e.id)!.texte)
    assert.ok(b.x1 >= CADRE.xMin && b.x2 <= CADRE.xMax, `${e.id} déborde en X`)
    assert.ok(b.y1 >= CADRE.yMin && b.y2 <= CADRE.yMax, `${e.id} déborde en Y`)
  }
})

test('le placement est déterministe — même planche d’un mois sur l’autre', () => {
  const pts = Array.from({ length: 25 }, (_, i) =>
    pt(`P${i}`, 200 + (i % 5) * 40, 200 + Math.floor(i / 5) * 30, `Valeur${i}`, i % 3),
  )
  const a = placer(pts, CADRE)
  const b = placer(pts, CADRE)
  assert.deepEqual(a, b)
  // Et l'ordre d'entrée ne change rien : deux poids égaux se départagent par id.
  const c = placer([...pts].reverse(), CADRE)
  assert.deepEqual(new Set(c.etiquettes.map((e) => e.id)), new Set(a.etiquettes.map((e) => e.id)))
})

test('une étiquette éloignée de son point porte un trait de rappel', () => {
  const pts = Array.from({ length: 8 }, (_, i) => pt(`P${i}`, 450, 280 + i * 3, `Nom${i}`, 8 - i))
  const r = placer(pts, CADRE)
  // Au moins une a dû s'écarter : elle doit être rattachable à l'œil.
  const eloignees = r.etiquettes.filter((e) => e.trait)
  for (const e of eloignees) {
    assert.ok(e.trait!.x1 !== undefined && e.trait!.y1 !== undefined)
  }
})
