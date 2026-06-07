// ─────────────────────────────────────────────────────────────────────────
//  Correspondance ticker Bloomberg → symbole Yahoo Finance.
//  Sert à récupérer les clôtures historiques des sous-jacents pour calculer
//  le niveau du worst-of à chaque date d'observation (suivi des coupons).
//  Les indices propriétaires (décrément, iEdge, MerQube, Bloomberg…) n'ont pas
//  d'équivalent Yahoo → retournent null (niveau « à constater »).
// ─────────────────────────────────────────────────────────────────────────

// Suffixe de place Bloomberg → suffixe Yahoo.
const SUFFIXE: Record<string, string> = {
  FP: '.PA', // Euronext Paris
  IM: '.MI', // Borsa Italiana (Milan)
  GY: '.DE', // XETRA / Deutsche Börse
  GR: '.DE',
  SW: '.SW', // SIX Swiss
  SE: '.SW', // SIX Swiss (Roche…)
  LN: '.L', // London Stock Exchange
  NA: '.AS', // Euronext Amsterdam
  SM: '.MC', // Bolsa de Madrid
  BB: '.BR', // Euronext Bruxelles
  // Places US : pas de suffixe Yahoo (ticker seul).
  US: '',
  UN: '',
  UW: '',
  UQ: '',
  UP: '',
  UA: '',
}

// Cas particuliers où le « root » Bloomberg diffère du symbole Yahoo.
const SPECIAL: Record<string, string> = {
  'ROG SE': 'ROG.SW',
  'HOLN SW': 'HOLN.SW',
  'ENR GY': 'ENR.DE',
  'SIE GY': 'SIE.DE',
  'RHM GY': 'RHM.DE',
  'HEI GY': 'HEI.DE',
  'SAP GY': 'SAP.DE',
}

/**
 * Convertit un code Bloomberg (« BNP FP », « INTC US », « ROG SE »…) en symbole
 * Yahoo Finance (« BNP.PA », « INTC », « ROG.SW »). Retourne null si non mappable
 * (indice propriétaire, taux, code inconnu).
 */
export function yahooSymbol(bloomberg?: string): string | null {
  if (!bloomberg) return null
  const bbg = bloomberg.trim()
  if (SPECIAL[bbg]) return SPECIAL[bbg]
  // Les indices se terminent souvent par « Index » ou n'ont pas de place reconnue.
  if (/index/i.test(bbg)) return null
  const parts = bbg.split(/\s+/)
  if (parts.length < 2) return null
  const root = parts[0]
  const place = parts[parts.length - 1].toUpperCase()
  if (!(place in SUFFIXE)) return null
  return root + SUFFIXE[place]
}

/** Tous les sous-jacents d'un produit sont-ils mappables sur Yahoo ? */
export function tousMappables(bloombergs: (string | undefined)[]): boolean {
  return bloombergs.length > 0 && bloombergs.every((b) => yahooSymbol(b) !== null)
}
