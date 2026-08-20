import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rendements,
  volatiliteRealisee,
  serieVolatilite,
  percentile,
  pointRadar,
  perf12Mois,
  quadrant,
  mediane,
  JOURS_BOURSE_AN,
  type Cloture,
} from './volatilite'

// ─────────────────────────────────────────────────────────────────────────
//  Le radar sert à décider quel payoff proposer : un percentile faux oriente
//  vers un autocall là où il fallait un participatif. On vérifie donc les
//  définitions elles-mêmes, contre des cas dont la réponse est connue à la
//  main — pas contre une capture d'écran de Bloomberg.
// ─────────────────────────────────────────────────────────────────────────

/** Série de clôtures à partir d'une liste de prix, dates ouvrées fictives. */
const serie = (prix: number[]): Cloture[] =>
  prix.map((close, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, close }))

test('les rendements sont logarithmiques et ignorent les prix non positifs', () => {
  const r = rendements(serie([100, 110]))
  assert.equal(r.length, 1)
  assert.ok(Math.abs(r[0] - Math.log(1.1)) < 1e-12)
})

test('une série strictement constante a une volatilité nulle', () => {
  const r = rendements(serie(Array(60).fill(100)))
  assert.equal(volatiliteRealisee(r, 50), 0)
})

test('la volatilité est annualisée sur 252 jours', () => {
  // Alternance +1 % / −1 % : l'écart-type des log-rendements est connu.
  const prix: number[] = [100]
  for (let i = 0; i < 60; i++) prix.push(prix[prix.length - 1] * (i % 2 === 0 ? 1.01 : 1 / 1.01))
  const r = rendements(serie(prix))
  const v = volatiliteRealisee(r, 60)!
  // Écart-type d'échantillon des ±ln(1,01), puis × √252, × 100.
  const u = Math.log(1.01)
  const ech = r.slice(-60)
  const moy = ech.reduce((s, x) => s + x, 0) / 60
  const attendu =
    Math.sqrt(ech.reduce((s, x) => s + (x - moy) ** 2, 0) / 59) * Math.sqrt(JOURS_BOURSE_AN) * 100
  assert.ok(Math.abs(v - attendu) < 1e-9)
  assert.ok(v > 0 && u > 0)
})

test('une fenêtre incomplète ne produit AUCUNE volatilité', () => {
  // Mieux vaut pas de chiffre qu'un chiffre calculé sur trois points et
  // présenté comme une volatilité 6 mois.
  assert.equal(volatiliteRealisee(rendements(serie([100, 101, 102])), 126), null)
})

test('le percentile compte les observations STRICTEMENT inférieures', () => {
  // Définition Bloomberg de l'outil d'origine : count(#diff < 0) / count(#diff).
  assert.equal(percentile([10, 20, 30, 40], 30), 50) // 10 et 20 sont sous 30
  assert.equal(percentile([10, 20, 30, 40], 10), 0) // rien n'est sous le minimum
  assert.equal(percentile([10, 20, 30, 40], 41), 100) // tout est sous
  // Les égalités ne comptent pas : trois valeurs identiques → 0 %.
  assert.equal(percentile([25, 25, 25], 25), 0)
})

test('un percentile sans historique n’est pas 0, il n’existe pas', () => {
  assert.equal(percentile([], 20), null)
})

test('la série glissante est datée sur la clôture de fin de fenêtre', () => {
  const bars = serie(Array.from({ length: 20 }, (_, i) => 100 + i))
  const s = serieVolatilite(bars, 5)
  assert.equal(s.length, rendements(bars).length - 5 + 1)
  // Le dernier point porte la date de la dernière clôture.
  assert.equal(s[s.length - 1].date, bars[bars.length - 1].date)
})

test('une vol qui monte en fin de série donne un percentile élevé', () => {
  // Douze mois calmes, puis une agitation qui s'AMPLIFIE : la fenêtre finale
  // doit être la plus volatile de toute la série, donc le point sort en haut.
  const prix: number[] = [100]
  for (let i = 0; i < 300; i++) prix.push(prix[prix.length - 1] * (i % 2 === 0 ? 1.001 : 1 / 1.001))
  for (let i = 0; i < 130; i++) {
    const ampleur = 1 + 0.001 + (i / 130) * 0.05 // de 0,1 % à ~5,1 %
    prix.push(prix[prix.length - 1] * (i % 2 === 0 ? ampleur : 1 / ampleur))
  }
  const p = pointRadar('TEST', 'Test', serie(prix), { fenetre: 20, fenetrePercentile: 252 })!
  assert.ok(p.percentile > 90, `percentile attendu élevé, obtenu ${p.percentile}`)
  assert.ok(p.vol > 0)
})

test('la performance 12 mois se lit sur la clôture d’il y a un an', () => {
  const bars: Cloture[] = [
    { date: '2025-08-20', close: 100 },
    { date: '2026-02-20', close: 150 },
    { date: '2026-08-20', close: 120 },
  ]
  assert.ok(Math.abs(perf12Mois(bars)! - 20) < 1e-9)
})

test('les quadrants suivent la lecture de la note Leonteq', () => {
  const base = { cle: 'X', nom: 'X', dernierNiveau: 1, dateNiveau: '2026-08-20', perf12m: null, observations: 252 }
  // Haut à droite : vol élevée ET au sommet de son année → autocall.
  assert.equal(quadrant({ ...base, vol: 30, percentile: 80 }, 20), 'autocall')
  // Bas à gauche : vol basse ET au creux → participatif.
  assert.equal(quadrant({ ...base, vol: 10, percentile: 20 }, 20), 'participatif')
  // Les deux cas mixtes ne recommandent rien.
  assert.equal(quadrant({ ...base, vol: 30, percentile: 20 }, 20), 'neutre')
  assert.equal(quadrant({ ...base, vol: 10, percentile: 80 }, 20), 'neutre')
})

test('la médiane sépare l’univers, y compris sur un nombre pair de points', () => {
  assert.equal(mediane([10, 20, 30, 40]), 25)
  assert.equal(mediane([10, 20, 30]), 20)
  assert.equal(mediane([]), 0)
})
