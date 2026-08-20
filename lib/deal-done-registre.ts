// ─────────────────────────────────────────────────────────────────────────
//  Le REGISTRE DES COMMISSIONS comme second référentiel du Deal Done.
//
//  Règle posée par Laurent (17/08/2026) : « utilise comme référentiel mon
//  tableau de commissions qui reprend l'intégralité de mes deals ».
//
//  Le dossier Outlook « DEAL DONE » raconte ce que l'équipe a ANNONCÉ ; le
//  registre enregistre ce qui a été FAIT. Les deux ne se recouvrent pas :
//  une affaire peut être facturée sans avoir été annoncée au team, et une
//  annonce n'a pas toujours d'ISIN. Croiser les deux est le seul moyen d'avoir
//  la liste complète.
//
//  Deux opérations, jamais plus :
//    • ENRICHIR — un deal annoncé qui correspond à une ligne du registre
//      récupère son ISIN et sa date d'émission. Rien d'autre n'est écrasé :
//      l'UF du deal done fait foi (règle du 16/08).
//    • COMPLÉTER — une ligne du registre sans annonce correspondante devient un
//      deal à part entière, marqué comme venant du registre.
//
//  Le rapprochement est STRICT : ISIN identique, ou même émetteur ET nom de
//  produit qui se recouvrent fortement. Un rapprochement approximatif ferait
//  disparaître un deal réel derrière un autre — c'est pire qu'un doublon, qui
//  se voit.
// ─────────────────────────────────────────────────────────────────────────
import type { CommissionLigne } from './commissions'
import type { Deal } from './deal-done'
import { clefProduit } from './deal-done'
import { codeEmetteur } from './emetteurs'

/** Pseudo-ISIN agrégeant plusieurs tranches — hors périmètre (cf. coherence.ts). */
const ISIN_AGREGE = new Set(['FEI'])

/**
 * ISIN dont la ressemblance avec un autre a été explicitement tranchée par
 * Laurent comme DISTINCTE — jamais fusionnés, jamais re-signalés « à
 * vérifier ». Un thème commercial (« Réarmement Europe », « Basket 50 Points
 * DIV »…) se revend à plusieurs clients par plusieurs émetteurs sans être le
 * même deal ; le motif du texte suffit à les rapprocher visuellement mais pas
 * à prouver un doublon. N'ajouter une entrée qu'après confirmation explicite —
 * c'est ce qui distingue une exception d'un doublon non détecté.
 */
const DISTINCT_CONFIRME = new Set<string>([
  // Phoenix Mémoire Réarmement Europe — même thème, deux émissions distinctes :
  // BNP/OPTIMAL (XS3266613416, 26/02) et BBVA/APPN (XS3250102665, 20/02).
  // Confirmé par Laurent (19/08/2026).
  'XS3266613416',
  'XS3250102665',
])

/**
 * Mots vides : présents partout, ils ne prouvent aucune ressemblance.
 *
 * La première version ne listait que le vocabulaire de payoff, et le
 * vocabulaire des INDICES suffisait à rapprocher n'importe quoi : « Phoenix
 * Autocallable sur MSCI ACWI IMI Copper and Power Select 20 Fixed Basket 50
 * Points DIV » partageait « msci », « select » et « points » avec « Autocall
 * Dégressif MXEADT50 — MSCI Europe Aerospace & Defense Top 10 Select 50 Points
 * Decrement ». Deux produits sans rapport, un ISIN collé au mauvais.
 */
const VIDES = new Set([
  // payoff
  'phoenix', 'athena', 'athena', 'memoire', 'memory', 'autocall', 'autocallable',
  'worst', 'wof', 'airbag', 'degressif', 'mensuel', 'mensuelle', 'trimestriel',
  'trimestrielle', 'annuel', 'inverse', 'reverse', 'callable', 'participation',
  'note', 'buffered', 'enhanced', 'bonus', 'snowball', 'asynchrone', 'booster',
  // indices et habillage
  'msci', 'index', 'indice', 'indices', 'select', 'points', 'decrement',
  'basket', 'fixed', 'weighted', 'equal', 'europe', 'european', 'euro', 'eur',
  'usd', 'world', 'global', 'total', 'return', 'price',
  // grammaire
  'sur', 'de', 'du', 'la', 'le', 'les', 'et', 'aux', 'des', 'avec', 'pour',
])

export const mots = (s?: string | null): Set<string> =>
  new Set(
    clefProduit(s ?? '')
      .split(' ')
      .filter((m) => m.length > 3 && !VIDES.has(m)),
  )

/**
 * Deux mots désignent-ils la même chose ? On compare par PRÉFIXE, pas à
 * l'identique : le registre écrit « Ferroviaires + Infra » là où l'annonce dit
 * « Ferroviaire / Infrastructure ». Un pluriel et une abréviation suffisaient à
 * faire échouer le rapprochement, et le produit apparaissait deux fois.
 */
const memeMot = (a: string, b: string): boolean => {
  const n = Math.min(a.length, b.length)
  return n >= 4 && a.slice(0, n) === b.slice(0, n)
}

export const communs = (a: Set<string>, b: Set<string>): number => {
  let n = 0
  a.forEach((m) => {
    let trouve = false
    b.forEach((x) => {
      if (!trouve && memeMot(m, x)) trouve = true
    })
    if (trouve) n++
  })
  return n
}

/**
 * Un deal annoncé et une ligne de registre désignent-ils la MÊME affaire ?
 *
 * L'ISIN tranche, dans les DEUX sens : deux ISIN présents et différents
 * signifient deux affaires, quels que soient les libellés. C'est ce qui manquait
 * — un deal portant déjà son ISIN se voyait apparier à une autre ligne, et la
 * ligne du registre disparaissait sans devenir une affaire à part entière.
 *
 * Sans ISIN côté deal, le rapprochement par libellé exige BEAUCOUP plus :
 * le même émetteur, et trois mots distinctifs communs. Les sous-jacents sont
 * les seuls mots qui identifient vraiment un produit ; tout le reste (payoff,
 * vocabulaire d'indice) est du décor et vit dans VIDES.
 */
export function memeAffaire(deal: Deal, ligne: CommissionLigne): boolean {
  if (deal.isin || ligne.isin) {
    if (deal.isin && ligne.isin) return deal.isin === ligne.isin
    if (deal.isin && !ligne.isin) return false
  }
  if (codeEmetteur(deal.emetteur) !== codeEmetteur(ligne.emetteur)) return false
  const a = mots(`${deal.produit} ${deal.description ?? ''}`)
  const b = mots(ligne.description)
  const n = communs(a, b)
  if (n >= 3) return true
  // Deux mots seulement : il faut une preuve de plus. La PROXIMITÉ DES DATES en
  // est une — une affaire est facturée dans les semaines qui suivent son
  // annonce. « Ferroviaire / Infrastructure » et « Ferroviaires + Infra » ne
  // partagent que deux mots, mais quatorze jours les séparent.
  return n >= 2 && joursEntre(deal.date, ligne.issue) <= 60
}

/** Écart en jours entre deux dates ISO ; `Infinity` si l'une manque. */
export const joursEntre = (a?: string, b?: string | null): number => {
  if (!a || !b) return Number.POSITIVE_INFINITY
  const x = new Date(a).getTime()
  const y = new Date(b).getTime()
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.POSITIVE_INFINITY
  return Math.abs(x - y) / 86_400_000
}

export interface CroisementRegistre {
  /** Deals annoncés, enrichis de l'ISIN et de la date d'émission du registre. */
  deals: Deal[]
  /** Deals créés depuis le registre, faute d'annonce correspondante. */
  ajoutes: Deal[]
  /** ISIN du registre rapprochés d'une annonce existante — traçabilité. */
  rapproches: string[]
}

/**
 * Croise les deals annoncés avec le registre des commissions.
 *
 * `annee` filtre les lignes du registre sur leur date d'émission. Les lignes
 * d'un même ISIN sont regroupées : plusieurs clients sur un produit ne font
 * qu'UN deal, dont le nominal est la somme des tickets.
 */
export function croiserAvecRegistre(
  deals: Deal[],
  lignes: CommissionLigne[],
  annee = '2026',
  /**
   * RR attribué aux affaires reprises du registre. Le registre ne porte pas le
   * commercial ; Laurent a confirmé (18/08/2026) que ces affaires sont les
   * siennes — « il faut indiquer mon RR = LS sur ces deals ». Le paramètre
   * reste explicite : le jour où une reprise viendra d'un autre, il suffira de
   * le passer, sans toucher à la logique.
   */
  rrParDefaut: Deal['rr'] = 'LS',
  /**
   * ISIN → date de constatation initiale (strike), lue au portefeuille.
   *
   * Le registre ne connaît que la date d'ÉMISSION, qui tombe souvent plusieurs
   * semaines après le trade : l'affaire se retrouvait rangée bien après le
   * moment où elle a été faite. Laurent (18/08/2026) : « il fallait utiliser la
   * date de strike, pas l'issue date ». Le strike est le repère chronologique
   * qui correspond aux dates d'annonce des autres lignes du tableau.
   *
   * ISIN absent du portefeuille : on garde la date d'émission faute de mieux,
   * et on le dit dans la description.
   */
  strikeParIsin: Record<string, string> = {},
): CroisementRegistre {
  const retenues = lignes.filter(
    (l) => (l.issue ?? '').startsWith(annee) && !ISIN_AGREGE.has(l.isin),
  )

  // Un ISIN = un produit = un deal, quel que soit le nombre de clients.
  const parIsin = new Map<string, CommissionLigne[]>()
  for (const l of retenues) {
    const g = parIsin.get(l.isin)
    if (g) g.push(l)
    else parIsin.set(l.isin, [l])
  }

  const sortie = deals.map((d) => ({ ...d }))
  const ajoutes: Deal[] = []
  const rapproches: string[] = []
  const dejaPris = new Set<number>()

  parIsin.forEach((groupe, isin) => {
    const ref = groupe[0]
    // Le premier deal non encore apparié qui désigne la même affaire.
    const i = sortie.findIndex((d, idx) => !dejaPris.has(idx) && memeAffaire(d, ref))
    if (i >= 0) {
      dejaPris.add(i)
      rapproches.push(isin)
      // ENRICHISSEMENT seulement : on ne touche ni à l'UF ni au nominal du deal
      // done, qui font foi. On comble ce qui manque, rien de plus.
      if (!sortie[i].isin) sortie[i].isin = isin
      if (!sortie[i].dateEmission && ref.issue) sortie[i].dateEmission = ref.issue
      return
    }
    const nominal = groupe.reduce((s, l) => s + (l.nominal ?? 0), 0)
    // Le STRIKE fait le repère chronologique. À défaut — produit absent du
    // portefeuille, ou trade saisi sans strike —, la date d'émission le
    // remplace (règle de Laurent, 18/08/2026). Pas de mention alarmante : le
    // repli est la règle, pas une anomalie.
    const strike = strikeParIsin[isin]
    ajoutes.push({
      id: `registre-${isin}`,
      date: strike || ref.issue || '',
      rr: rrParDefaut,
      produit: ref.description ?? isin,
      description: `Repris du registre des commissions — aucun deal done correspondant dans le dossier Outlook.`,
      emetteur: ref.emetteur ?? undefined,
      devise: ref.devise ?? undefined,
      nominal: nominal > 0 ? nominal : undefined,
      ufGlobal: typeof ref.ufPct === 'number' ? Math.round(ref.ufPct * 10000) / 100 : undefined,
      isin,
      dateEmission: ref.issue ?? undefined,
      source: 'registre des commissions',
      distinctConfirme: DISTINCT_CONFIRME.has(isin) || undefined,
    })
  })

  ajoutes.sort((a, b) => b.date.localeCompare(a.date))
  return { deals: sortie, ajoutes, rapproches }
}
