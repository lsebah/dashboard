// ─────────────────────────────────────────────────────────────────────────
//  Correspondance ticker Bloomberg → symbole Yahoo Finance.
//  Sert à récupérer les clôtures historiques des sous-jacents pour calculer
//  le niveau du worst-of à chaque date d'observation (suivi des coupons) et la
//  performance courante affichée dans les fiches.
//  Les indices propriétaires (décrément, iEdge, MerQube, baskets sur mesure…)
//  n'ont pas d'équivalent Yahoo → retournent null (niveau « à constater »).
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
  DC: '.CO', // Nasdaq Copenhagen (Novo Nordisk…)
  // Places US : pas de suffixe Yahoo (ticker seul).
  US: '',
  UN: '',
  UW: '',
  UQ: '',
  UP: '',
  UA: '',
}

// Cas particuliers où le « root » Bloomberg diffère du symbole Yahoo, ET indices
// boursiers classiques (Yahoo « ^… ») qu'il faut sortir du filtre « Index ».
const SPECIAL: Record<string, string> = {
  'ROG SE': 'ROG.SW',
  'HOLN SW': 'HOLN.SW',
  'ENR GY': 'ENR.DE',
  'SIE GY': 'SIE.DE',
  'RHM GY': 'RHM.DE',
  'HEI GY': 'HEI.DE',
  'SAP GY': 'SAP.DE',
  'NOVOB DC': 'NOVO-B.CO', // Novo Nordisk B (Nasdaq Copenhague)
  // Indices boursiers cotés (Yahoo) — repère « ^ ».
  'SPX Index': '^GSPC', // S&P 500
  'SX5E Index': '^STOXX50E', // Euro Stoxx 50
  'NKY Index': '^N225', // Nikkei 225
  'NDX Index': '^NDX', // Nasdaq-100
  'SH000905 Index': '000905.SS', // CSI 500 (Shanghai)
}

// Suffixe de classe d'instrument Bloomberg à retirer (« USO UP Equity » → « USO UP »).
// « Index » est conservé : il sert au filtre des indices propriétaires plus bas.
const CLASSE = /\s+(Equity|Comdty|Curncy)$/i

/**
 * Convertit un code Bloomberg (« BNP FP », « INTC US », « ROG SE », « USO UP
 * Equity », « NDX Index »…) en symbole Yahoo Finance (« BNP.PA », « INTC »,
 * « ROG.SW », « USO », « ^NDX »). Retourne null si non mappable (indice
 * propriétaire, taux, code inconnu).
 */
export function yahooSymbol(bloomberg?: string): string | null {
  if (!bloomberg) return null
  let bbg = bloomberg.trim()
  if (SPECIAL[bbg]) return SPECIAL[bbg]
  bbg = bbg.replace(CLASSE, '').trim()
  if (SPECIAL[bbg]) return SPECIAL[bbg]
  // Les indices se terminent par « Index » et n'ont (sauf SPECIAL ci-dessus) pas
  // d'équivalent Yahoo.
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
