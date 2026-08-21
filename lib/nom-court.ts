// ─────────────────────────────────────────────────────────────────────────
//  NOM COURT D'UNE VALEUR — pour étiqueter un nuage de points.
//
//  Soixante titres sur un graphe, c'est soixante étiquettes : « Apple Inc. »,
//  « JPMorgan Chase & Co. », « International Business Machines Corporation ».
//  À cette densité, la forme juridique n'apporte rien et mange la place qui
//  manque au nom lui-même — le radar devenait illisible (Laurent, 21/08/2026).
//
//  Deux gestes, dans cet ordre :
//   1. les sociétés connues sous un ACRONYME reçoivent leur acronyme. Personne
//      n'écrit « International Business Machines » : on écrit IBM. La table est
//      explicite et courte — on ne devine pas un acronyme, on le reconnaît.
//   2. tout le reste est débarrassé de son habillage juridique et de ses
//      mentions de classe d'action.
//
//  Ce qui n'est PAS fait : tronquer à N caractères. Un nom coupé au milieu est
//  pire qu'un nom long — il devient faux.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sociétés que le marché désigne par un acronyme, indexées par leur symbole
 * Yahoo — sans ambiguïté possible, contrairement au nom.
 *
 * N'ajouter une entrée que si l'acronyme est réellement d'usage courant. Le
 * doute se tranche en faveur du nom : « Nvidia » se lit, « NVDA » se déchiffre.
 */
export const ACRONYMES: Record<string, string> = {
  IBM: 'IBM',
  AMD: 'AMD',
  'BRK-B': 'Berkshire',
  MMM: '3M',
  UPS: 'UPS',
  'T': 'AT&T',
  GE: 'GE',
  HPQ: 'HP',
  HPE: 'HPE',
  JNJ: 'J&J',
  PG: 'P&G',
  JPM: 'JPMorgan',
  GS: 'Goldman Sachs',
  MS: 'Morgan Stanley',
  BAC: 'Bank of America',
  KO: 'Coca-Cola',
  PEP: 'PepsiCo',
  PM: 'Philip Morris',
  RTX: 'RTX',
  LMT: 'Lockheed',
  NKE: 'Nike',
  MCD: "McDonald's",
  CRM: 'Salesforce',
  AXP: 'Amex',
  TRV: 'Travelers',
  CVX: 'Chevron',
  XOM: 'Exxon',
  WMT: 'Walmart',
  DIS: 'Disney',
  CSCO: 'Cisco',
  VZ: 'Verizon',
  UNH: 'UnitedHealth',
  CAT: 'Caterpillar',
  HD: 'Home Depot',
  SHW: 'Sherwin-Williams',
}

// Habillage juridique et mentions de classe, retirés en fin de nom. L'ordre
// compte peu, la répétition oui : « Alphabet Inc. Class A » perd les deux.
const SUFFIXES = [
  'incorporated', 'inc', 'corporation', 'corp', 'companies', 'company', 'co',
  'limited', 'ltd', 'plc', 'llc', 'lp', 'l.p.', 'nv', 'n.v.', 'sa', 's.a.',
  'ag', 'se', 'spa', 's.p.a.', 'ab', 'asa', 'oyj', 'nv/sa',
  'holdings', 'holding', 'group', 'trust', 'the',
]

const CLASSES = /\b(class|série|serie|cl\.?)\s+[a-c]\b/i

/** Retire l'habillage juridique, la ponctuation résiduelle et les classes. */
function degraisser(nom: string): string {
  let s = nom.replace(CLASSES, ' ').trim()
  // « The Goldman Sachs Group » → on retire l'article de tête aussi.
  s = s.replace(/^the\s+/i, '')
  let change = true
  while (change) {
    change = false
    const avant = s
    s = s.replace(/[,&\s]+$/, '').trim()
    for (const suf of SUFFIXES) {
      const re = new RegExp(`[,\\s]+${suf.replace(/\./g, '\\.')}\\.?$`, 'i')
      if (re.test(s)) {
        s = s.replace(re, '')
        change = true
      }
    }
    if (s !== avant) change = true
    if (s.length === 0) return nom.trim() // on ne rend jamais une chaîne vide
  }
  return s.replace(/[,&\s]+$/, '').trim() || nom.trim()
}

/**
 * Nom d'affichage d'une valeur sur le radar. `symbole` sert à reconnaître les
 * acronymes ; il ne remplace jamais un nom qui se lit bien.
 */
export function nomCourt(nom: string, symbole?: string): string {
  const acr = symbole ? ACRONYMES[symbole.toUpperCase()] : undefined
  if (acr) return acr
  const propre = degraisser(nom ?? '')
  return propre || (symbole ?? '').toUpperCase() || nom
}
