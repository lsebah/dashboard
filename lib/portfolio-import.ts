// ─────────────────────────────────────────────────────────────────────────
//  Import "catalogue" depuis le fichier Excel "Lifecycle" (snapshot 10/04/2026).
//  Échantillon représentatif couvrant TOUTES les classes : equity / crédit /
//  taux / FX / commodity, et tous les types (Phoenix, Athena, Booster, Airbag,
//  Participation, Call Spread, CLN, TARN, Fixed Rate Note, Dette Privée…).
//
//  ⚠️ Confidentialité : SEULES les caractéristiques produits sont importées.
//  Aucune donnée client ni commission/revenu n'est versionnée. L'axe
//  d'allocation par client se rebranche via un fichier local non suivi.
//  L'import complet (~160 lignes) se fera depuis un export propre du classeur.
// ─────────────────────────────────────────────────────────────────────────
import type {
  Product,
  AssetClass,
  ProductFamily,
  Frequency,
  ProductStatus,
} from './types'

const FREQ: Record<string, Frequency> = {
  Mensuel: 'mensuel',
  Trimestriel: 'trimestriel',
  Semestriel: 'semestriel',
  Annuel: 'annuel',
  'In Fine': 'in_fine',
}

function family(type: string): ProductFamily {
  if (/CLN/i.test(type)) return 'credit_linked'
  if (/TARN/i.test(type)) return 'rates_structured'
  if (/Fixed Rate Note|Callable FRN/i.test(type)) return 'rates_structured'
  if (/Participation|Call Spread/i.test(type)) return 'participation'
  if (/Phoenix|Athena|Booster|Airbag|Autocall|Oxygen/i.test(type)) return 'autocall'
  return 'other'
}

/** "MM/DD/YY" → "20YY-MM-DD". */
function iso(d?: string): string | undefined {
  if (!d) return undefined
  const [mm, dd, yy] = d.split('/')
  return `20${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function addYears(d: string, y: number): string {
  const dt = new Date(d)
  dt.setFullYear(dt.getFullYear() + Math.floor(y))
  dt.setMonth(dt.getMonth() + Math.round((y % 1) * 12))
  return dt.toISOString().slice(0, 10)
}

interface Row {
  rr: string
  issue: string // MM/DD/YY
  isin: string
  last?: number
  pnl?: number
  statut?: ProductStatus
  next?: string // MM/DD/YY
  cy: string
  amount: number
  issuer: string
  freq: keyof typeof FREQ
  y: number
  desc: string
  cls: AssetClass
  type: string
  coupon?: number
  bAuto?: string
  bCoupon?: string
  pdi?: string
}

// Codes clients (colonne CLIENT INFO de l'Excel), par ISIN. Seed d'affichage ;
// l'utilisateur peut surcharger l'allocation localement (localStorage).
const CLIENTS: Record<string, string[]> = {
  XS3317870197: ['APPN - 05277'],
  XS3304996484: ['ALVES - 06001'],
  XS3309979311: ['ALVES - 06001'],
  XS3283137407: ['APPN - 05277'],
  XS3153607810: ['VIA - 08001'],
  FR0014013N00: ['SPG - 05774'],
  XS3149199807: ['ALVES - 06001'],
  XS3148625976: ['APPN - 05277'],
  XS2925309945: ['ALVES - 06001'],
  FRIP000014P8: ['GRICOURT - 05474'],
  XS2769371209: ['GRICOURT - 05474'],
  XS2872777334: ['ARCHE - 05272'],
  XS2884074795: ['PRESTINVEST - 05773'],
  XS3073984430: ['CAPITALL - 01227'],
  XS2979390502: ['SCALA - 05722'],
  XS2975786000: ['SAMY - 01674'],
  XS2919373816: ['SCALA - 05722'],
  XS2576621366: ['SCALA - 05722'],
  XS2442403130: ['SAMY - 01674'],
  XS2464629414: ['SAMY - 01674'],
  XS2110091449: ['SCALA - 05722'],
  FR001400T357: ['MANTU - 05626'],
  CH1271361060: ['SOCIPAR - 05762'],
  'FEI-2025': ['MACIF'],
  XS2621505341: ['PRESTINVEST - 05773'],
  XS2863761933: ['VIA - 08001'],
}

function mk(r: Row): Product {
  const issue = iso(r.issue)!
  return {
    id: r.isin,
    nom: r.desc,
    isin: r.isin,
    emetteur: r.issuer,
    assetClass: r.cls,
    family: family(r.type),
    devise: r.cy,
    nominal: r.amount,
    dateConstatationInitiale: issue,
    dateEmission: issue,
    dateConstatationFinale: addYears(issue, r.y),
    dateEcheance: addYears(issue, r.y),
    frequence: FREQ[r.freq],
    basket: /\bwof\b|worst/i.test(r.desc) ? 'worst_of' : 'single',
    sousJacents: [],
    prixMarche: r.last,
    pnlPct: r.pnl,
    statut: r.statut ?? 'vivant',
    rr: r.rr,
    productType: r.type,
    description: r.desc,
    nextEvent: iso(r.next),
    couponPaPct: r.coupon,
    barriereAutocall: r.bAuto,
    barriereCoupon: r.bCoupon,
    pdiText: r.pdi,
    clients: CLIENTS[r.isin],
  }
}

// — Lignes (instruments uniquement ; les 4 produits décodés par termsheet
//   sont ajoutés séparément dans products.ts) —
const rows: Row[] = [
  // ─ Equity ─────────────────────────────────────────────────────────────
  { rr: 'LS', issue: '04/10/26', isin: 'XS3317870197', last: 104.77, pnl: 4.77, next: '06/27/26', cy: 'EUR', amount: 300_000, issuer: 'BNP', freq: 'Trimestriel', y: 5, desc: 'Phoenix Mémoire Wof Accor + Carnival + United Airlines', cls: 'equity', type: 'Phoenix', coupon: 13.0 },
  { rr: 'LS', issue: '04/07/26', isin: 'XS3304996484', last: 101.25, pnl: 1.25, next: '06/20/26', cy: 'EUR', amount: 300_000, issuer: 'BARCLAYS', freq: 'Trimestriel', y: 5, desc: 'Phoenix Mémoire Wof Engie + Veolia + BNP', cls: 'equity', type: 'Phoenix', coupon: 10.1, bAuto: '100%', bCoupon: '50%', pdi: '50%' },
  { rr: 'LS', issue: '04/07/26', isin: 'XS3309979311', last: 95.5, pnl: 4.5, next: '06/20/26', cy: 'EUR', amount: 300_000, issuer: 'BNP', freq: 'Trimestriel', y: 5, desc: 'Phoenix Mémoire Software Wof CRM + MSFT + SAP', cls: 'equity', type: 'Phoenix', coupon: 9.2, bAuto: '98%', bCoupon: '50%', pdi: '50%' },
  { rr: 'LS', issue: '03/16/26', isin: 'XS3283137407', last: 97.63, pnl: 2.37, next: '06/02/26', cy: 'EUR', amount: 300_000, issuer: 'BNP', freq: 'Trimestriel', y: 5, desc: 'Phoenix Mémoire Wof Alphabet + Amazon + CrowdStrike', cls: 'equity', type: 'Phoenix', coupon: 10.7, bAuto: '75%', bCoupon: '50%', pdi: '50%' },
  { rr: 'PD', issue: '10/28/25', isin: 'XS3153607810', last: 100.2, pnl: 0.2, next: '10/13/26', cy: 'EUR', amount: 510_000, issuer: 'BNP', freq: 'Annuel', y: 5, desc: 'Athena Booster Wof SPX + SX5E + NKY', cls: 'equity', type: 'Booster', coupon: 8.15, bAuto: '100%', pdi: '60%' },
  { rr: 'LS', issue: '10/27/25', isin: 'FR0014013N00', last: 99.94, pnl: 0.06, next: '04/15/26', cy: 'EUR', amount: 650_000, issuer: 'BNP', freq: 'Semestriel', y: 6, desc: 'Autocall Équipondéré Schneider + Siemens Energy + Bouygues', cls: 'equity', type: 'Athena', coupon: 7.0, bAuto: '100%', pdi: '60%' },
  { rr: 'LS', issue: '10/22/25', isin: 'XS3149199807', last: 93.63, pnl: 6.37, next: '05/08/26', cy: 'EUR', amount: 300_000, issuer: 'SANTANDER', freq: 'Mensuel', y: 5, desc: 'Athena Airbag Dégressif BNP + Intesa + Crédit Agricole', cls: 'equity', type: 'Airbag', coupon: 10.5, bAuto: '100%', bCoupon: '50%', pdi: '50%' },
  { rr: 'LS', issue: '10/30/25', isin: 'XS3148625976', last: 66.1, pnl: 30.65, next: '04/16/26', cy: 'EUR', amount: 300_000, issuer: 'BBVA', freq: 'Trimestriel', y: 5, desc: 'Phoenix Mémoire Dégressif Wof RACE + ACA + NOVOB', cls: 'equity', type: 'Phoenix', coupon: 13.0, bAuto: '100%', bCoupon: '70%', pdi: '50%' },
  { rr: 'JLL', issue: '07/15/25', isin: 'XS2925309945', last: 40.77, pnl: 59.23, next: '04/30/26', cy: 'EUR', amount: 200_000, issuer: 'MAREX', freq: 'Mensuel', y: 5, desc: 'Autocall Airbag MSTR', cls: 'equity', type: 'Airbag', coupon: 13.5, bAuto: '100%', pdi: '50%' },
  { rr: 'LS', issue: '01/13/25', isin: 'FRIP000014P8', last: 54.62, pnl: 45.38, next: '12/23/26', cy: 'EUR', amount: 1_200_000, issuer: 'MSCO', freq: 'Annuel', y: 10, desc: 'Autocall Bonus Luxe', cls: 'equity', type: 'Athena' },
  { rr: 'LS', issue: '11/11/24', isin: 'XS2769371209', statut: 'rappele', cy: 'EUR', amount: 980_000, issuer: 'GS', freq: 'Annuel', y: 5, desc: 'Autocall Airbag ASML', cls: 'equity', type: 'Airbag', coupon: 10.6, bAuto: '100%', pdi: '60%' },
  { rr: 'LS', issue: '08/12/24', isin: 'XS2872777334', statut: 'vendu', cy: 'USD', amount: 3_030_000, issuer: 'CIBC', freq: 'In Fine', y: 4, desc: 'Participation note SPX no gearing - KG 18.8%', cls: 'equity', type: 'Participation' },
  { rr: 'LS', issue: '08/20/24', isin: 'XS2884074795', statut: 'rappele', cy: 'USD', amount: 500_000, issuer: 'CIBC', freq: 'In Fine', y: 1, desc: 'Call Spread Low Strike 75/135 - ASML', cls: 'equity', type: 'Call Spread' },

  // ─ Crédit ─────────────────────────────────────────────────────────────
  { rr: 'LS', issue: '08/07/25', isin: 'XS3073984430', last: 84.86, pnl: 11.14, next: '04/16/26', cy: 'EUR', amount: 410_000, issuer: 'BNP', freq: 'Trimestriel', y: 12, desc: 'Phoenix Bearish CMS10 Trimestriel 2.5/2.9 - 8%', cls: 'credit', type: 'Phoenix', coupon: 8.0, bAuto: '2.50%', bCoupon: '2.90%' },
  { rr: 'LS', issue: '03/25/25', isin: 'XS2979390502', last: 90.24, pnl: 0.54, next: '03/11/27', cy: 'EUR', amount: 1_950_000, issuer: 'BNP', freq: 'Annuel', y: 10, desc: 'Phoenix Bearish TEC10 3/3.80 - 10.30%', cls: 'credit', type: 'Phoenix', coupon: 10.3, bAuto: '3.80%', bCoupon: '3.00%' },
  { rr: 'LS', issue: '03/17/25', isin: 'XS2975786000', last: 46.14, pnl: 53.86, next: '01/06/28', cy: 'EUR', amount: 1_465_000, issuer: 'BNP', freq: 'In Fine', y: 3, desc: 'ZC CLN Tranche Crossover', cls: 'credit', type: 'CLN Tranche' },
  { rr: 'DS', issue: '01/02/25', isin: 'XS2919373816', last: 103.44, pnl: 3.44, next: '01/08/30', cy: 'EUR', amount: 990_000, issuer: 'BNP', freq: 'In Fine', y: 5, desc: 'CLN Tranche iTraxx Zero Recov 4/7', cls: 'credit', type: 'CLN Tranche' },
  { rr: 'DS', issue: '09/08/23', isin: 'XS2576621366', last: 133.55, pnl: 33.55, next: '07/04/28', cy: 'EUR', amount: 500_000, issuer: 'BNP', freq: 'In Fine', y: 5, desc: 'CLN iTraxx Main Balloon', cls: 'credit', type: 'CLN' },
  { rr: 'PD', issue: '11/25/22', isin: 'XS2442403130', last: 97.7, pnl: 2.3, next: '04/28/26', cy: 'EUR', amount: 1_500_000, issuer: 'BNP', freq: 'Trimestriel', y: 12, desc: 'TARN CMS 30Y - CMS 2Y', cls: 'credit', type: 'TARN' },
  { rr: 'PD', issue: '02/20/23', isin: 'XS2464629414', statut: 'rappele', cy: 'EUR', amount: 1_000_000, issuer: 'BNP', freq: 'Trimestriel', y: 12, desc: 'TARN Steepener 2s30s', cls: 'credit', type: 'TARN', coupon: 8.0 },
  { rr: 'DS', issue: '02/23/24', isin: 'XS2110091449', last: 98.69, pnl: 1.31, next: '02/09/27', cy: 'EUR', amount: 1_000_000, issuer: 'CITI', freq: 'Annuel', y: 15, desc: 'Callable FRN 5,35% p.a. NC2', cls: 'credit', type: 'Fixed Rate Note', coupon: 5.35 },
  { rr: 'LS', issue: '10/14/24', isin: 'FR001400T357', last: 87.77, pnl: 12.23, next: '09/30/26', cy: 'USD', amount: 500_000, issuer: 'SOCGEN', freq: 'Annuel', y: 7, desc: 'Bear Athena SOFR CMS10', cls: 'credit', type: 'Athena', coupon: 9.0, bAuto: '2.80%' },
  { rr: 'DS', issue: '12/01/23', isin: 'CH1271361060', last: 100.0, next: '06/01/26', cy: 'EUR', amount: 250_000, issuer: 'SOCIPAR', freq: 'Semestriel', y: 2, desc: 'Dette Privée - SIP Chabanais', cls: 'credit', type: 'Dette Privée', coupon: 10.25 },
  { rr: 'LS', issue: '04/15/25', isin: 'FEI-2025', last: 100.0, cy: 'EUR', amount: 6_114_286, issuer: 'FEI', freq: 'In Fine', y: 10, desc: 'FEI', cls: 'credit', type: 'FEI', coupon: 9.0 },

  // ─ FX ─────────────────────────────────────────────────────────────────
  { rr: 'LS', issue: '05/14/25', isin: 'XS2621505341', last: 97.21, pnl: 2.79, next: '05/07/26', cy: 'EUR', amount: 500_000, issuer: 'BNP', freq: 'Annuel', y: 10, desc: 'TRY Denominated NC3 Callable In Fine Note (EUR Settlement)', cls: 'fx', type: 'Callable Note' },

  // ─ Commodity ──────────────────────────────────────────────────────────
  { rr: 'PD', issue: '12/24/24', isin: 'XS2863761933', last: 106.72, pnl: 6.72, next: '12/24/27', cy: 'USD', amount: 1_000_000, issuer: 'BNP', freq: 'In Fine', y: 3, desc: 'Bond + Call Spread on Gold in USD', cls: 'commodity', type: 'Call Spread', coupon: 5.0 },
]

export const portfolioImport: Product[] = rows.map(mk)
