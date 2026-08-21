import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPOSITIONS,
  composition,
  compositionEffective,
  ageComposition,
  compositionPerimee,
  membresRetenus,
  perimeeDepuis,
  retenirMembres,
  COMPOSITION_PERIMEE_JOURS,
} from './index-members'
import { INDICES_RADAR } from './indices-radar'

// ─────────────────────────────────────────────────────────────────────────
//  Si la composition est fausse, le radar attribue la volatilité d'une valeur
//  à un indice qui ne la contient pas — et la planche part chez des clients.
//  Ces tests verrouillent les deux garde-fous : on ne sert pas une liste vide
//  comme si elle était bonne, et on ne tronque jamais en silence.
// ─────────────────────────────────────────────────────────────────────────

test('une composition vide n’est pas une composition', () => {
  // À la création, les listes sont vides : aucune n'a été écrite de mémoire.
  // `composition()` doit renvoyer `undefined` plutôt qu'un objet à zéro membre,
  // sinon l'écran croit avoir de quoi tracer.
  assert.equal(composition('CETTE_CLE_NEXISTE_PAS'), undefined)
  for (const [cle, c] of Object.entries(COMPOSITIONS)) {
    if (cle.startsWith('_')) continue
    if (c.membres.length === 0) assert.equal(composition(cle), undefined, cle)
  }
})

test('chaque indice du radar a une entrée de composition, avec sa source citée', () => {
  for (const idx of INDICES_RADAR) {
    const c = COMPOSITIONS[idx.cle]
    assert.ok(c, `aucune entrée pour ${idx.cle}`)
    // La source est ce qu'on cite si la liste est contestée : jamais vide.
    assert.ok(c.source.trim().length > 0, `source vide pour ${idx.cle}`)
  }
})

test('une composition sans date est réputée périmée, pas fraîche', () => {
  // Une fraîcheur qu'on ne peut pas dater n'est pas une fraîcheur.
  assert.equal(ageComposition('CLE_INCONNUE'), Number.POSITIVE_INFINITY)
  assert.equal(compositionPerimee('CLE_INCONNUE'), true)
})

test('la péremption se déclenche par le seul écoulement du temps', () => {
  const cle = Object.keys(COMPOSITIONS).find((k) => !k.startsWith('_'))!
  const avant = { ...COMPOSITIONS[cle] }
  try {
    COMPOSITIONS[cle] = { ...avant, majLe: '2026-08-01' }
    assert.equal(ageComposition(cle, new Date('2026-08-10')), 9)
    assert.equal(compositionPerimee(cle, new Date('2026-08-10')), false)
    const bienPlusTard = new Date('2026-08-01')
    bienPlusTard.setDate(bienPlusTard.getDate() + COMPOSITION_PERIMEE_JOURS + 1)
    assert.equal(compositionPerimee(cle, bienPlusTard), true)
  } finally {
    COMPOSITIONS[cle] = avant
  }
})

test('les membres retenus sont les plus lourds, et la troncature est dite', () => {
  const cle = '__TEST__'
  COMPOSITIONS[cle] = {
    source: 'test',
    majLe: '2026-08-20',
    membres: [
      { symbole: 'C', nom: 'C', poids: 1 },
      { symbole: 'A', nom: 'A', poids: 10 },
      { symbole: 'B', nom: 'B', poids: 5 },
    ],
  }
  try {
    const r = membresRetenus(cle, 2)
    assert.deepEqual(r.membres.map((m) => m.symbole), ['A', 'B'])
    assert.equal(r.total, 3)
    // Le compte de ce qui reste dehors est la seule chose qui empêche un radar
    // tronqué de se faire passer pour l'univers entier.
    assert.equal(r.tronque, 1)
  } finally {
    delete COMPOSITIONS[cle]
  }
})

test('sans pondération publiée, l’ordre de la source est respecté', () => {
  const cle = '__TEST2__'
  COMPOSITIONS[cle] = {
    source: 'test',
    majLe: '2026-08-20',
    membres: [
      { symbole: 'X', nom: 'X' },
      { symbole: 'Y', nom: 'Y' },
    ],
  }
  try {
    assert.deepEqual(membresRetenus(cle, 10).membres.map((m) => m.symbole), ['X', 'Y'])
    assert.equal(membresRetenus(cle, 10).tronque, 0)
  } finally {
    delete COMPOSITIONS[cle]
  }
})

test('un indice sans composition ne retient rien, et ne prétend rien', () => {
  const r = membresRetenus('CLE_INCONNUE', 60)
  assert.deepEqual(r, { membres: [], total: 0, tronque: 0 })
})

// ─────────────────────────────────────────────────────────────────────────
//  LA SURCOUCHE BLOOMBERG — trois indices du radar (CAC, SX5E, WORLD) n'ont
//  aucune source publique scrapable et arrivent par le run quotidien du
//  terminal. Ce qui se joue ici : elle doit combler les trous SANS jamais
//  effacer ce que le fichier tenait déjà, ni ce que les autres indices ont.
// ─────────────────────────────────────────────────────────────────────────

test('la surcouche prime pour l’indice qu’elle porte, et cite Bloomberg', () => {
  const cle = '__SURCOUCHE__'
  COMPOSITIONS[cle] = { source: 'fichier', majLe: '2026-07-01', membres: [{ symbole: 'A', nom: 'A' }] }
  try {
    const c = compositionEffective(cle, {
      asof: '2026-08-21T06:00:00.000Z',
      indices: {
        [cle]: { asof: '2026-08-21T06:00:00.000Z', membres: [{ symbole: 'SAF.PA', nom: 'Safran' }] },
      },
    })
    assert.deepEqual(c?.membres.map((m) => m.symbole), ['SAF.PA'])
    // La date affichée est celle du run, pas celle du fichier : l'écran cite sa
    // source, elle doit être exacte.
    assert.equal(c?.majLe, '2026-08-21')
    assert.match(c!.source, /Bloomberg/)
  } finally {
    delete COMPOSITIONS[cle]
  }
})

test('un indice absent de la surcouche garde le fichier', () => {
  const cle = '__SURCOUCHE2__'
  COMPOSITIONS[cle] = { source: 'fichier', majLe: '2026-07-01', membres: [{ symbole: 'A', nom: 'A' }] }
  try {
    const c = compositionEffective(cle, {
      asof: '2026-08-21T06:00:00.000Z',
      indices: { AUTRE: { asof: '2026-08-21T06:00:00.000Z', membres: [{ symbole: 'B', nom: 'B' }] } },
    })
    assert.equal(c?.source, 'fichier')
  } finally {
    delete COMPOSITIONS[cle]
  }
})

test('une surcouche vide n’efface pas la composition du fichier', () => {
  // Un run où le terminal a mal répondu ne doit pas éteindre le radar.
  const cle = '__SURCOUCHE3__'
  COMPOSITIONS[cle] = { source: 'fichier', majLe: '2026-07-01', membres: [{ symbole: 'A', nom: 'A' }] }
  try {
    const c = compositionEffective(cle, {
      asof: '2026-08-21T06:00:00.000Z',
      indices: { [cle]: { asof: '2026-08-21T06:00:00.000Z', membres: [] } },
    })
    assert.equal(c?.source, 'fichier')
    // Et sans KV du tout, le comportement est celui d'avant la surcouche.
    assert.equal(compositionEffective(cle, null)?.source, 'fichier')
    assert.equal(compositionEffective(cle)?.source, 'fichier')
  } finally {
    delete COMPOSITIONS[cle]
  }
})

test('c’est le plus récent qui gagne : un fichier relu après le run reprend la main', () => {
  const cle = '__SURCOUCHE4__'
  COMPOSITIONS[cle] = { source: 'fichier', majLe: '2026-08-22', membres: [{ symbole: 'A', nom: 'A' }] }
  try {
    const c = compositionEffective(cle, {
      asof: '2026-08-21T06:00:00.000Z',
      indices: { [cle]: { asof: '2026-08-21T06:00:00.000Z', membres: [{ symbole: 'B', nom: 'B' }] } },
    })
    assert.equal(c?.source, 'fichier')
  } finally {
    delete COMPOSITIONS[cle]
  }
})

test('la surcouche comble un indice que le fichier a laissé vide', () => {
  // Le cas réel : Euronext ne répond pas, le CAC est vide dans le fichier.
  const cle = '__SURCOUCHE5__'
  COMPOSITIONS[cle] = { source: 'live.euronext.com', majLe: '2026-08-20', membres: [] }
  try {
    const c = compositionEffective(cle, {
      asof: '2026-08-21T06:00:00.000Z',
      indices: {
        [cle]: {
          asof: '2026-08-21T06:00:00.000Z',
          membres: [{ symbole: 'SAF.PA', nom: 'Safran', poids: 3.1 }],
        },
      },
    })
    assert.equal(retenirMembres(c, 60).total, 1)
    assert.equal(perimeeDepuis(c?.majLe, new Date('2026-08-21')), false)
  } finally {
    delete COMPOSITIONS[cle]
  }
})
