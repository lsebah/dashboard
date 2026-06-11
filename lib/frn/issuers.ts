// ─────────────────────────────────────────────────────────────────────────
//  Émetteurs FRN + notations (Moody's / S&P / Fitch). Valeurs INDICATIVES,
//  curatées et facilement éditables ici (à vérifier / mettre à jour). Servent
//  d'étiquette sous le nom de l'émetteur dans les grilles FRN.
//  Ordre d'affichage = ordre de cette liste.
// ─────────────────────────────────────────────────────────────────────────
export interface IssuerInfo {
  name: string
  alias?: string[] // variantes rencontrées dans les emails (pour le parser)
  moody?: string
  sp?: string
  fitch?: string
}

export const ISSUERS: IssuerInfo[] = [
  { name: 'CACIB', alias: ['Credit Agricole', 'Crédit Agricole', 'CA-CIB', 'CASA'], moody: 'Aa3', sp: 'A+', fitch: 'AA-' },
  { name: 'CIC', alias: ['Credit Industriel', 'Crédit Mutuel', 'BFCM'], moody: 'Aa3', sp: 'A+', fitch: 'AA-' },
  { name: 'SG', alias: ['SocGen', 'Societe Generale', 'Société Générale', 'SG Issuer'], moody: 'A1', sp: 'A', fitch: 'A-' },
  { name: 'BNP', alias: ['BNP Paribas', 'BNPP'], moody: 'Aa3', sp: 'A+', fitch: 'AA-' },
  { name: 'Barclays', alias: ['BARC', 'Barclays Bank'], moody: 'A1', sp: 'A+', fitch: 'A+' },
  { name: 'GS', alias: ['Goldman', 'Goldman Sachs', 'GSI'], moody: 'A1', sp: 'BBB+', fitch: 'A' },
  { name: 'Citi', alias: ['Citigroup', 'Citibank'], moody: 'A3', sp: 'BBB+', fitch: 'A' },
  { name: 'Santander', alias: ['Banco Santander', 'SANTAN'], moody: 'A2', sp: 'A+', fitch: 'A-' },
  { name: 'BBVA', alias: ['Banco Bilbao'], moody: 'A3', sp: 'A', fitch: 'A-' },
  { name: 'CIBC', alias: ['Canadian Imperial'], moody: 'Aa2', sp: 'A+', fitch: 'AA-' },
  { name: 'Nomura', alias: ['Nomura Holdings', 'Nomura International', 'NOMURA'], moody: 'Baa1', sp: 'BBB+', fitch: 'A-' },
  { name: 'DB', alias: ['Deutsche Bank', 'DB Structured', 'DB-Structured', 'db.com'], moody: 'A1', sp: 'A', fitch: 'A' },
  { name: 'BofA', alias: ['Bank of America', 'BofA', 'BAML', 'Merrill', 'distributionfrance'], moody: 'A1', sp: 'A-', fitch: 'AA-' },
  { name: 'Mediobanca', alias: ['Mediobanca'], moody: 'Baa1', sp: 'BBB', fitch: 'BBB+' },
  { name: 'Marex', alias: ['Marex Financial'], moody: 'Baa1', sp: 'BBB', fitch: 'BBB+' },
]

const BY_NAME = new Map(ISSUERS.map((i) => [i.name, i]))

export const issuerInfo = (name: string): IssuerInfo | undefined => BY_NAME.get(name)

/** « Moody's / S&P / Fitch » (parties renseignées). */
export const ratingLine = (i?: IssuerInfo): string =>
  i ? [i.moody, i.sp, i.fitch].filter(Boolean).join(' / ') : ''

/** Index d'affichage d'un émetteur (ordre de la liste, inconnus à la fin). */
export const issuerOrder = (name: string): number => {
  const i = ISSUERS.findIndex((x) => x.name === name)
  return i < 0 ? ISSUERS.length : i
}

/** Détecte un émetteur connu dans un texte libre (nom ou alias). */
export function detectIssuer(text: string): string | null {
  const hay = text.toLowerCase()
  for (const i of ISSUERS) {
    if (hay.includes(i.name.toLowerCase())) return i.name
    for (const a of i.alias ?? []) if (hay.includes(a.toLowerCase())) return i.name
  }
  return null
}
