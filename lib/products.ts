// ─────────────────────────────────────────────────────────────────────────
//  Données de référence — produits encodés à partir de termsheets réelles.
//  Sert d'amorce (seed) tant que la base de données n'est pas branchée.
//  Les 4 produits couvrent : single / indice décrément / panier équipondéré /
//  worst-of, autocall standard & inverse, Airbag, Oxygène, barrière dégressive.
// ─────────────────────────────────────────────────────────────────────────
import type {
  Product,
  AssetClass,
  ProductFamily,
  Frequency,
  BasketType,
  Underlying,
} from './types'
import { buildObservations, pnlAvecCoupons, rappelConstate } from './lifecycle'
import { portfolioImport } from './portfolio-import'
import { termsheetUrl, termsheetFile, termsheetMeta } from './termsheets'
import {
  feedIsins,
  priceByIsin,
  statutByIsin,
  deviseByIsin,
  amountByIsin,
  allocByIsin,
  descByIsin,
} from './feed'

// ── 1) MAREX — Inverse (Barrier) Autocall sur United States Oil Fund ─────────
const usoObs = ['2026-06-12', '2026-09-14', '2026-12-14', '2027-03-12']
const usoPay = ['2026-06-22', '2026-09-21', '2026-12-21', '2027-03-19']

const marexUso: Product = {
  id: 'XS3262011201',
  nom: 'Inverse Reverse Autocall USO',
  isin: 'XS3262011201',
  valor: '153809020',
  emetteur: 'Marex Financial',
  notationEmetteur: 'BBB (S&P)',
  assetClass: 'commodity',
  family: 'autocall',
  eusipa: '1260 — Barrier Express',
  devise: 'USD',
  nominal: 5_300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-12',
  dateEmission: '2026-03-26',
  dateConstatationFinale: '2027-03-12',
  dateEcheance: '2027-03-19',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    {
      nom: 'United States Oil Fund LP',
      bloomberg: 'USO UP Equity',
      marche: 'NYSE Arca',
      devise: 'USD',
      niveauInitial: 118.39,
    },
  ],
  terms: {
    kind: 'autocall',
    sens: 'inverse', // rappel si le cours est SOUS le niveau d'autocall
    effetMemoire: false,
    couponPa: 15.1, // 3.775% / trimestre, garanti
    barriereRappelPct: 100,
    protectionPct: 175, // barrière haute (inverse) : événement si final ≥ 175%
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(usoObs, usoPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: 100,
    couponPct: 3.775,
  }),
  statut: 'vivant',
  rr: 'LS',
  productType: 'Reverse Autocall',
  description: '1Y Inverse Reverse Autocall USO',
  clients: ['NATAF - 05627'],
  badges: ['Inverse', 'Coupon garanti'],
  termsheetFichier:
    '260326_1Y_Inverse Reverse Autocall USO_Trimestriel_XS3262011201_MAREX.PDF',
}

// ── 2) BNP — Athena Airbag SX5E 8x Repo (indice à décrément, non-call 3 obs.) ─
const sx5eObs = [
  '2027-03-05', '2027-06-07', '2027-09-06', '2027-12-07', '2028-03-06',
  '2028-06-05', '2028-09-05', '2028-12-05', '2029-03-05', '2029-06-05',
  '2029-09-05', '2029-12-05', '2030-03-05', '2030-06-05', '2030-09-05',
  '2030-12-05', '2031-03-05', '2031-06-05', '2031-09-05', '2031-12-05',
  '2032-03-05', '2032-06-07', '2032-09-06', '2032-12-07', '2033-03-07',
  '2033-06-06', '2033-09-05', '2033-12-05',
]
const sx5ePay = [
  '2027-03-12', '2027-06-14', '2027-09-13', '2027-12-14', '2028-03-13',
  '2028-06-12', '2028-09-12', '2028-12-12', '2029-03-12', '2029-06-12',
  '2029-09-12', '2029-12-12', '2030-03-12', '2030-06-12', '2030-09-12',
  '2030-12-12', '2031-03-12', '2031-06-12', '2031-09-12', '2031-12-12',
  '2032-03-12', '2032-06-14', '2032-09-13', '2032-12-14', '2033-03-14',
  '2033-06-13', '2033-09-12', '2033-12-12',
]

const bnpSx5e: Product = {
  id: 'XS3291617812',
  nom: 'Athena Airbag SX5E 8x Repo',
  isin: 'XS3291617812',
  valor: '153148581',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-05',
  dateEmission: '2026-03-12',
  dateConstatationFinale: '2034-03-06',
  dateEcheance: '2034-03-13',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    {
      nom: 'Bloomberg Eurozone 50 Financing Cost Decrement',
      bloomberg: 'BEU50CFC Index',
      niveauInitial: 1580.26,
      spot: 1499.99, // ≈ 94.92% de l'initial (capture vizibility)
      perf: -5.08,
    },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false, // Athena à prime : pas de coupon mémoire (TS)
    couponPa: 11.0, // rendement indicatif du step de prime (2,75 %/trim.), pas un coupon distribué
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
    decrement: 'Financing Cost Decrement',
    bonusFinalPct: 88,
  },
  // Athena : la prime de remboursement croît de 2,75 %/trimestre (108,25 % + n×2,75 %).
  // PAS de coupon périodique distribué ⇒ on ne met pas couponPct (sinon double compte au P&L).
  observations: buildObservations(sx5eObs, sx5ePay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => 108.25 + n * 2.75,
    rappelActifAPartirDe: 4, // non-call : rappel actif à partir du T4
  }),
  prixMarche: 100.38,
  pnlPct: 0.38,
  pdiPct: 60,
  statut: 'vivant',
  rr: 'LS',
  productType: 'Athena',
  description: '8Y Athena SX5E 8x Repo — prime 108,25 %+n×2,75 %, non-call 3 obs., KI 60 % européen',
  clients: ['ALVES - 06001'],
  badges: ['Non-call (3 obs.)', 'Décrément'],
  termsheetFichier:
    '260312_8Y_Athena Airbag SX5E 8x Repo_Annuel_XS3291617812_BNP.PDF',
}

// ── 3) SocGen — Autocall Energy Europe 2025 (panier équipondéré, dégressif) ──
const sgObs = ['2026-04-16', '2027-04-16', '2028-04-18', '2029-04-16', '2030-04-16']
const sgPay = ['2026-04-23', '2027-04-23', '2028-04-25', '2029-04-23', '2030-04-25']
const sgRappel = [100, 97.5, 95, 92.5] // barrières dégressives (0 / -2.5 / -5 / -7.5%)

const socgenEnergy: Product = {
  id: 'FRSG00015XB8',
  nom: 'Autocall Energy Europe 2025',
  isin: 'FRSG00015XB8',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-04-16',
  dateEmission: '2025-03-25',
  dateConstatationFinale: '2030-04-16',
  dateEcheance: '2030-04-25',
  frequence: 'annuel',
  basket: 'equipondere',
  sousJacents: [
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', marche: 'Euronext Paris', niveauInitial: 51.68 },
    { nom: 'Shell PLC', bloomberg: 'SHELL NA', marche: 'Euronext Amsterdam', niveauInitial: 28.47 },
    { nom: 'ENI SpA', bloomberg: 'ENI IM', marche: 'Borsa Italiana', niveauInitial: 12.174 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: true,
    barriereRappelPct: 100,
    protectionPct: 60, // barrière activante européenne si perf moyenne < -40%
    protectionStyle: 'europeenne',
    bonusFinalPct: 35, // si perf moyenne ≥ -10% à l'échéance
  },
  observations: buildObservations(sgObs.slice(0, 4), sgPay.slice(0, 4), {
    niveauRappelPct: (n) => sgRappel[n - 1],
    montantRemboursementPct: (n) => 100 + n * 7,
  }).concat({
    n: 5,
    dateObservation: sgObs[4],
    datePaiement: sgPay[4],
    autocallActif: false,
    resultat: 'Échéance : bonus +35% si perf. moyenne ≥ -10%',
  }),
  pdiPct: 60,
  statut: 'vivant',
  rr: 'LS',
  productType: 'Autocall',
  description: '5Y Autocall Équipondéré TTE + Shell + ENI',
  clients: ['SPG - 05774'],
  badges: ['Équipondéré', 'Dégressif', 'Collatéralisé'],
  termsheetFichier:
    '250325_4Y_Autocall Equipondéré TotalEnergies ENI Shell_Annuel_FRSG00015XB8_SOCGEN.pdf',
}

// ── 4) BNP — Athena Airbag Worst-of Défense (Safran / Thales / Rheinmetall) ──
const defObs = [
  '2027-02-25', '2027-03-25', '2027-04-26', '2027-05-25', '2027-06-25',
  '2027-07-26', '2027-08-25', '2027-09-27', '2027-10-25', '2027-11-25',
  '2027-12-27', '2028-01-25', '2028-02-25', '2028-03-27', '2028-04-25',
  '2028-05-25', '2028-06-26', '2028-07-25', '2028-08-25', '2028-09-25',
  '2028-10-25', '2028-11-27', '2028-12-27', '2029-01-25', '2029-02-26',
  '2029-03-26', '2029-04-25', '2029-05-25', '2029-06-25', '2029-07-25',
  '2029-08-27', '2029-09-25', '2029-10-25', '2029-11-26', '2029-12-27',
  '2030-01-25', '2030-02-25', '2030-03-25', '2030-04-25', '2030-05-27',
  '2030-06-25', '2030-07-25', '2030-08-26', '2030-09-25', '2030-10-25',
  '2030-11-25', '2030-12-27', '2031-01-27',
]
const defPay = [
  '2027-03-11', '2027-04-12', '2027-05-10', '2027-06-08', '2027-07-09',
  '2027-08-09', '2027-09-08', '2027-10-11', '2027-11-08', '2027-12-09',
  '2028-01-10', '2028-02-08', '2028-03-10', '2028-04-10', '2028-05-10',
  '2028-06-08', '2028-07-10', '2028-08-08', '2028-09-08', '2028-10-09',
  '2028-11-08', '2028-12-11', '2029-01-11', '2029-02-08', '2029-03-12',
  '2029-04-11', '2029-05-10', '2029-06-08', '2029-07-09', '2029-08-08',
  '2029-09-10', '2029-10-09', '2029-11-08', '2029-12-10', '2030-01-11',
  '2030-02-08', '2030-03-11', '2030-04-08', '2030-05-10', '2030-06-10',
  '2030-07-09', '2030-08-08', '2030-09-09', '2030-10-09', '2030-11-08',
  '2030-12-09', '2031-01-13', '2031-02-10',
]

const bnpDefense: Product = {
  id: 'XS3266363806',
  nom: 'Athena Airbag Worst-of Défense',
  isin: 'XS3266363806',
  valor: '153148026',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 700_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-02-25',
  dateEmission: '2026-03-11',
  dateConstatationFinale: '2031-02-25',
  dateEcheance: '2031-03-11',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Safran SA', bloomberg: 'SAF FP' },
    { nom: 'Thales SA', bloomberg: 'HO FP' },
    { nom: 'Rheinmetall AG', bloomberg: 'RHM GY' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    airbag: true, // rappel à 85%
    barriereRappelPct: 85,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    bonusFinalPct: 56,
  },
  observations: buildObservations(defObs, defPay, {
    niveauRappelPct: 85,
    montantRemboursementPct: (n) => 110.26667 + n * 0.93333,
  }),
  pdiPct: 50,
  statut: 'vivant',
  rr: 'LS',
  productType: 'Athena',
  description: '5Y Athena Airbag Wof Safran + Thales + Rheinmetall',
  clients: ['ALVES - 06001'],
  badges: ['Airbag', 'Worst-of', 'Mensuel'],
  termsheetFichier:
    '260311_5Y_Athena Airbag Mensuel sur Thales Safran et Rheinmetall_Mensuel_XS3266363806_BNP.PDF',
}

// ── 5) BBVA — Phoenix Mémoire Dégressif Worst-of RACE + ACA + NOVOB ──────────
//    Décodé depuis la termsheet (Series 34935). Autocall dégressif 100→70 %
//    (−2 %/trim.), non-call 3 trimestres, coupon 3,25 %/trim. à mémoire (13 % p.a.),
//    barrière coupon 70 %, protection KI 50 % européenne.
const raceObs = [
  '2026-01-16', '2026-04-16', '2026-07-16', '2026-10-16', '2027-01-18',
  '2027-04-16', '2027-07-16', '2027-10-18', '2028-01-17', '2028-04-18',
  '2028-07-17', '2028-10-16', '2029-01-16', '2029-04-16', '2029-07-16',
  '2029-10-16', '2030-01-16', '2030-04-16', '2030-07-16', '2030-10-16',
]
const racePay = [
  '2026-01-23', '2026-04-23', '2026-07-23', '2026-10-23', '2027-01-25',
  '2027-04-23', '2027-07-23', '2027-10-25', '2028-01-24', '2028-04-25',
  '2028-07-24', '2028-10-23', '2029-01-23', '2029-04-23', '2029-07-23',
  '2029-10-23', '2030-01-23', '2030-04-25', '2030-07-23', '2030-10-23',
]
// Barème d'autocall dégressif (obs 4 → 19 ; non-call sur 1-3, maturité en 20).
const raceAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 98, 96, 94, 92, 90, 88,
  86, 84, 82, 80, 78, 76, 74, 72, 70, undefined,
]

const bbvaRaceAcaNovob: Product = {
  id: 'XS3148625976',
  nom: 'Phoenix Mémoire Dégressif RACE + ACA + NOVOB',
  isin: 'XS3148625976',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria',
  notationEmetteur: 'Moody’s A2 / S&P A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-10-16',
  dateEmission: '2025-10-30',
  dateConstatationFinale: '2030-10-16',
  dateEcheance: '2030-10-23',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Novo Nordisk', bloomberg: 'NOVOB DC', isin: 'DK0062498333', marche: 'Copenhague' },
    { nom: 'Crédit Agricole SA', bloomberg: 'ACA FP', isin: 'FR0000045072', marche: 'Euronext Paris' },
    { nom: 'Ferrari NV', bloomberg: 'RACE IM', isin: 'NL0011585146', marche: 'Borsa Italiana' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 13.0,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(raceObs, racePay, {
    niveauRappelPct: (n) => raceAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 3.25,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Dégressif Wof RACE + ACA + NOVOB',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '251030_5Y_Phoenix Memory Degressif RACE + ACA + NOVOB_Trimestriel_XS3148625976_BBVA.pdf',
}

// ── 6) Santander — Phoenix Mémoire Bancaires Françaises (Wof GLE+ACA+BNP) ────
//    Décodé (Series 5007). Autocall dégressif 100→71,25 % (−1,25 %/trim.),
//    28 observations, non-call 3 trim., coupon 2,3375 %/trim. à mémoire (9,35 % p.a.),
//    barrière coupon 70 %, protection KI 50 % européenne.
const bkObs = [
  '2026-03-05', '2026-06-05', '2026-09-07', '2026-12-07', '2027-03-05',
  '2027-06-07', '2027-09-06', '2027-12-06', '2028-03-06', '2028-06-05',
  '2028-09-05', '2028-12-05', '2029-03-05', '2029-06-05', '2029-09-05',
  '2029-12-05', '2030-03-05', '2030-06-05', '2030-09-05', '2030-12-05',
  '2031-03-05', '2031-06-05', '2031-09-05', '2031-12-05', '2032-03-05',
  '2032-06-07', '2032-09-06', '2032-12-06',
]
const bkPay = [
  '2026-03-19', '2026-06-19', '2026-09-21', '2026-12-21', '2027-03-19',
  '2027-06-21', '2027-09-20', '2027-12-20', '2028-03-20', '2028-06-19',
  '2028-09-19', '2028-12-19', '2029-03-19', '2029-06-19', '2029-09-19',
  '2029-12-19', '2030-03-19', '2030-06-19', '2030-09-19', '2030-12-19',
  '2031-03-19', '2031-06-19', '2031-09-19', '2031-12-19', '2032-03-19',
  '2032-06-21', '2032-09-20', '2032-12-20',
]
const bkAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 98.75, 97.5, 96.25, 95, 93.75, 92.5,
  91.25, 90, 88.75, 87.5, 86.25, 85, 83.75, 82.5, 81.25, 80, 78.75, 77.5,
  76.25, 75, 73.75, 72.5, 71.25, undefined,
]

const santanderBancaires: Product = {
  id: 'XS3231258727',
  nom: 'Phoenix Mémoire Bancaires Françaises',
  isin: 'XS3231258727',
  valor: '150224206',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-12-05',
  dateEmission: '2025-12-19',
  dateConstatationFinale: '2032-12-06',
  dateEcheance: '2032-12-20',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Société Générale SA', bloomberg: 'GLE FP', isin: 'FR0000130809', marche: 'Euronext Paris' },
    { nom: 'Crédit Agricole SA', bloomberg: 'ACA FP', isin: 'FR0000045072', marche: 'Euronext Paris' },
    { nom: 'BNP Paribas SA', bloomberg: 'BNP FP', isin: 'FR0000131104', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.35,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(bkObs, bkPay, {
    niveauRappelPct: (n) => bkAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.3375,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '7Y Phoenix Mémoire Bancaires Françaises (GLE + ACA + BNP)',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '251219_7Y_Phoenix Memoire Bancaires Francaises_Trimestriel_XS3231258727_SANTANDER.pdf',
}

// ── XS3049563219 — Santander Phoenix Mémoire BNP + SocGen + Crédit Agricole ──
const sbgObs = [
  '2025-08-11', '2025-11-10', '2026-02-10', '2026-05-11', '2026-08-10',
  '2026-11-10', '2027-02-10', '2027-05-10', '2027-08-10', '2027-11-10',
  '2028-02-10', '2028-05-10', '2028-08-10', '2028-11-10', '2029-02-12',
  '2029-05-10', '2029-08-10', '2029-11-12', '2030-02-11', '2030-05-10',
  '2030-08-12', '2030-11-11', '2031-02-10', '2031-05-12',
]
const sbgPay = [
  '2025-08-18', '2025-11-17', '2026-02-16', '2026-05-18', '2026-08-17',
  '2026-11-16', '2027-02-16', '2027-05-17', '2027-08-16', '2027-11-16',
  '2028-02-16', '2028-05-16', '2028-08-16', '2028-11-16', '2029-02-16',
  '2029-05-16', '2029-08-16', '2029-11-16', '2030-02-18', '2030-05-16',
  '2030-08-16', '2030-11-18', '2031-02-17', '2031-05-16',
]
// Barrière d'autocall dégressive (-1.5%/trim. de 100% à 80%, puis plancher 80%).
// Non-call jusqu'au n=3 ; n=24 = maturité (rachat final à barrière 50%).
const sbgAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 98.5, 97, 95.5, 94, 92.5, 91,
  89.5, 88, 86.5, 85, 83.5, 82, 80.5, 80, 80, 80, 80, 80, 80, undefined,
]
const santanderBnpGleAca: Product = {
  id: 'XS3049563219',
  nom: 'Phoenix Mémoire BNP + SocGen + Crédit Agricole',
  isin: 'XS3049563219',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-04-28',
  dateEmission: '2025-05-16',
  dateConstatationFinale: '2031-05-12',
  dateEcheance: '2031-05-16',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'BNP Paribas SA', bloomberg: 'BNP FP', isin: 'FR0000131104', marche: 'Euronext Paris' },
    { nom: 'Société Générale SA', bloomberg: 'GLE FP', isin: 'FR0000130809', marche: 'Euronext Paris' },
    { nom: 'Crédit Agricole SA', bloomberg: 'ACA FP', isin: 'FR0000045072', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.68,
    barriereCouponPct: 80,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(sbgObs, sbgPay, {
    niveauRappelPct: (n) => sbgAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.42,
    niveauCouponPct: 80,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '6Y Phoenix Mémoire Bancaires Françaises (BNP + GLE + ACA)',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '250516_6Y_Phoenix Memoire BNP  Société Générale  Crédit Agricole _Trimestriel_XS3049563219 _SANTANDER.pdf',
}

// ── XS2862503435 — Barclays Phoenix Memory Wof ASML + Saint-Gobain + Total ──
const aspObs = [
  '2025-03-27', '2025-09-29', '2026-03-27', '2026-09-28', '2027-03-30',
  '2027-09-27', '2028-03-27', '2028-09-27', '2029-03-27', '2029-09-27',
]
const aspPay = [
  '2025-04-10', '2025-10-13', '2026-04-14', '2026-10-12', '2027-04-13',
  '2027-10-11', '2028-04-10', '2028-10-11', '2029-04-12', '2029-10-11',
]
// Autocall à barrière constante 100% ; non-call sur la 1re obs ; n=10 = maturité.
const aspAer: (number | undefined)[] = [
  undefined, 100, 100, 100, 100, 100, 100, 100, 100, undefined,
]
const barclaysAsmlSgoTte: Product = {
  id: 'XS2862503435',
  nom: 'Phoenix Mémoire ASML + Saint-Gobain + TotalEnergies',
  isin: 'XS2862503435',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'Moody’s A1 / S&P A+ / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 2_200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-09-27',
  dateEmission: '2024-10-11',
  dateConstatationFinale: '2029-09-27',
  dateEcheance: '2029-10-11',
  frequence: 'semestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'ASML Holding NV', bloomberg: 'ASML NA', marche: 'Euronext Amsterdam' },
    { nom: 'Compagnie de Saint-Gobain SA', bloomberg: 'SGO FP', marche: 'Euronext Paris' },
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 11.0,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(aspObs, aspPay, {
    niveauRappelPct: (n) => aspAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 5.5,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 2,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof ASML + Saint-Gobain + TotalEnergies',
  badges: ['Worst-of', 'Effet mémoire'],
  termsheetFichier:
    '241011_5Y_Phoenix Memory  Wof ASML + Saint-Gobin + TotalEnergies_Semestriel_XS2862503435_BARCLAYS.pdf',
}

// ── XS2653912068 — GS Snowball Autocall Wof Pfizer + Roche + Sanofi ──────────
// Pas de coupon conditionnel périodique : la prime de rappel croît (snowball)
// de 119,5% à 197,5% (+4,875%/trim.), trigger d'autocall constant 100%.
const gsObs = [
  '2025-03-11', '2025-06-11', '2025-09-11', '2025-12-11', '2026-03-11',
  '2026-06-11', '2026-09-11', '2026-12-11', '2027-03-11', '2027-06-11',
  '2027-09-13', '2027-12-13', '2028-03-13', '2028-06-12', '2028-09-11',
  '2028-12-11', '2029-03-12',
]
const gsPay = [
  '2025-03-25', '2025-06-25', '2025-09-25', '2025-12-29', '2026-03-25',
  '2026-06-25', '2026-09-25', '2026-12-28', '2027-03-25', '2027-06-25',
  '2027-09-27', '2027-12-27', '2028-03-27', '2028-06-26', '2028-09-25',
  '2028-12-27', '2029-03-26',
]
const gsErv = [
  119.5, 124.375, 129.25, 134.125, 139, 143.875, 148.75, 153.625, 158.5,
  163.375, 168.25, 173.125, 178, 182.875, 187.75, 192.625, 197.5,
]
const gsSnowball: Product = {
  id: 'XS2653912068',
  nom: 'Autocall Snowball Pfizer + Roche + Sanofi',
  isin: 'XS2653912068',
  emetteur: 'Goldman Sachs Finance Corp International',
  garant: 'The Goldman Sachs Group, Inc.',
  notationEmetteur: 'Moody’s A2 / S&P BBB+ / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 5_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-03-11',
  dateEmission: '2024-04-03',
  dateConstatationFinale: '2029-03-12',
  dateEcheance: '2029-03-26',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Pfizer Inc.', bloomberg: 'PFE UN', isin: 'US7170811035', marche: 'NYSE' },
    { nom: 'Roche Holding AG', bloomberg: 'ROG SE', isin: 'CH0012032048', marche: 'SIX Swiss' },
    { nom: 'Sanofi S.A.', bloomberg: 'SAN FP', isin: 'FR0000120578', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: false,
    couponPa: 19.5,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(gsObs, gsPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => gsErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Snowball',
  description: '5Y Autocall Snowball Wof Pfizer + Roche + Sanofi (prime croissante)',
  badges: ['Worst-of', 'Snowball', 'Quanto EUR'],
  termsheetFichier:
    '240403_5Y_Autocall Airbag  Wof PFE + ROG.SE + SAN.FP_Trimestriel_XS2653912068_GS.pdf',
}

// ── XS3103610385 — Santander Phoenix Mémoire Schneider + Siemens Energy + Total
// (le nom de fichier mentionne « Suez » à tort ; sous-jacents réels ci-dessous)
const sseObs = [
  '2025-12-29', '2026-06-24', '2026-12-28', '2027-06-24', '2027-12-27',
  '2028-06-26', '2028-12-26', '2029-06-25', '2029-12-26', '2030-06-24',
]
const ssePay = [
  '2026-01-19', '2026-07-20', '2027-01-18', '2027-07-19', '2028-01-18',
  '2028-07-18', '2029-01-18', '2029-07-18', '2030-01-18', '2030-07-18',
]
// Autocall « low-strike » dégressif 80%→71,25% (-1,25%/sem.) ; non-call sur la
// 1re obs ; n=10 = maturité (rachat final à barrière 40%).
const sseAer: (number | undefined)[] = [
  undefined, 80, 78.75, 77.5, 76.25, 75, 73.75, 72.5, 71.25, undefined,
]
const santanderSchneiderEnrTte: Product = {
  id: 'XS3103610385',
  nom: 'Phoenix Mémoire Schneider + Siemens Energy + TotalEnergies',
  isin: 'XS3103610385',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2 / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-06-24',
  dateEmission: '2025-07-18',
  dateConstatationFinale: '2030-06-24',
  dateEcheance: '2030-07-18',
  frequence: 'semestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Schneider Electric SE', bloomberg: 'SU FP', isin: 'FR0000121972', marche: 'Euronext Paris' },
    { nom: 'Siemens Energy AG', bloomberg: 'ENR GY', isin: 'DE000ENER6Y0', marche: 'XETRA' },
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', isin: 'FR0000120271', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.0,
    barriereCouponPct: 60,
    barriereRappelPct: 80,
    protectionPct: 40,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(sseObs, ssePay, {
    niveauRappelPct: (n) => sseAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 5,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 2,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Schneider + Siemens Energy + TotalEnergies',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '250718_5Y_Phoenix Memory Wof Suez + Siemens Energy TotalEnergies_Semestriel_XS3103610385_SANTANDER.pdf',
}

// ── XS3010088303 — BNP Phoenix Snowball Wof Albemarle + CF Industries ────────
const albObs = [
  '2025-10-27', '2026-04-27', '2026-10-26', '2027-04-26', '2027-10-25',
  '2028-04-25', '2028-10-25', '2029-04-25', '2029-10-25', '2030-04-25',
  '2030-10-25', '2031-04-25',
]
const albPay = [
  '2025-11-10', '2026-05-12', '2026-11-09', '2027-05-10', '2027-11-08',
  '2028-05-10', '2028-11-08', '2029-05-10', '2029-11-08', '2030-05-10',
  '2030-11-08', '2031-05-12',
]
// Autocall dégressif 100%→73% (-3%/sem.) ; non-call sur la 1re obs ;
// n=12 = maturité (KI européen 50%). Coupon snowball 6,20%×(1+T).
const albAer: (number | undefined)[] = [
  undefined, 100, 97, 94, 91, 88, 85, 82, 79, 76, 73, undefined,
]
const bnpAlbemarleCf: Product = {
  id: 'XS3010088303',
  nom: 'Phoenix Snowball Albemarle + CF Industries',
  isin: 'XS3010088303',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-04-25',
  dateEmission: '2025-05-09',
  dateConstatationFinale: '2031-04-25',
  dateEcheance: '2031-05-12',
  frequence: 'semestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Albemarle Corp', bloomberg: 'ALB UN', marche: 'NYSE' },
    { nom: 'CF Industries Holdings Inc', bloomberg: 'CF UN', marche: 'NYSE' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 12.4,
    barriereCouponPct: 50,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(albObs, albPay, {
    niveauRappelPct: (n) => albAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 6.2,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 2,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '6Y Phoenix Snowball Wof Albemarle + CF Industries (EUR Quanto)',
  badges: ['Worst-of', 'Dégressif', 'Snowball'],
  termsheetFichier:
    '250509_6Y_Phoenix Memory Wof CF Industries  + Albermarle_Semestriel_XS3010088303_BNP.pdf',
}

// ── XS3062217446 — Barclays Phoenix Mémoire Copper Miners (BHP+AngloAm+Freeport)
const cuObs = [
  '2026-01-07', '2026-07-07', '2027-01-07', '2027-07-07', '2028-01-07',
  '2028-07-07', '2029-01-08', '2029-07-09', '2030-01-07', '2030-07-08',
]
const cuPay = [
  '2026-01-21', '2026-07-21', '2027-01-21', '2027-07-21', '2028-01-21',
  '2028-07-21', '2029-01-22', '2029-07-23', '2030-01-21', '2030-07-22',
]
// Autocall à barrière constante 100% ; non-call sur la 1re obs ; n=10 = maturité.
const cuAer: (number | undefined)[] = [
  undefined, 100, 100, 100, 100, 100, 100, 100, 100, undefined,
]
const barclaysCopperMiners: Product = {
  id: 'XS3062217446',
  nom: 'Phoenix Mémoire Copper Miners',
  isin: 'XS3062217446',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'Moody’s A1 / S&P A+ / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 2_200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-07-07',
  dateEmission: '2025-07-21',
  dateConstatationFinale: '2030-07-08',
  dateEcheance: '2030-07-22',
  frequence: 'semestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'BHP Group Ltd', bloomberg: 'BHP UN', marche: 'NYSE' },
    { nom: 'Anglo American PLC', bloomberg: 'AAL LN', isin: 'GB00BTK05J60', marche: 'London Stock Exchange' },
    { nom: 'Freeport-McMoRan Inc.', bloomberg: 'FCX UN', isin: 'US35671D8570', marche: 'NYSE' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 8.5,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(cuObs, cuPay, {
    niveauRappelPct: (n) => cuAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 4.25,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 2,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Copper Miners (BHP + Anglo American + Freeport)',
  badges: ['Worst-of', 'Effet mémoire'],
  termsheetFichier:
    '250721_5Y_Phoenix Memory Copper Miners (Wof  BHP.US + FCX.US + AAL.LN)_Semestriel_XS3062217446_BARCLAYS.pdf',
}

// ── XS3109495153 — Santander Phoenix Mémoire Intel + Rheinmetall + Renault ───
const irrObs = [
  '2025-11-12', '2026-02-11', '2026-05-11', '2026-08-11', '2026-11-12',
  '2027-02-11', '2027-05-11', '2027-08-11', '2027-11-12', '2028-02-11',
  '2028-05-11', '2028-08-11', '2028-11-13', '2029-02-12', '2029-05-11',
  '2029-08-13', '2029-11-13', '2030-02-11', '2030-05-13', '2030-08-12',
]
const irrPay = [
  '2025-11-19', '2026-02-19', '2026-05-19', '2026-08-19', '2026-11-19',
  '2027-02-19', '2027-05-19', '2027-08-19', '2027-11-19', '2028-02-21',
  '2028-05-19', '2028-08-21', '2028-11-20', '2029-02-19', '2029-05-21',
  '2029-08-20', '2029-11-19', '2030-02-19', '2030-05-20', '2030-08-19',
]
// Autocall dégressif 100%→80% (-1,25%/trim.) ; non-call n=1-2 ; n=20 = maturité.
const irrAer: (number | undefined)[] = [
  undefined, undefined, 100, 98.75, 97.5, 96.25, 95, 93.75, 92.5, 91.25,
  90, 88.75, 87.5, 86.25, 85, 83.75, 82.5, 81.25, 80, undefined,
]
const santanderIntelRhmRno: Product = {
  id: 'XS3109495153',
  nom: 'Phoenix Mémoire Intel + Rheinmetall + Renault',
  isin: 'XS3109495153',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2 / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 950_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-07-21',
  dateEmission: '2025-09-15',
  dateConstatationFinale: '2030-08-12',
  dateEcheance: '2030-08-19',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Intel Corp', bloomberg: 'INTC US', isin: 'US4581401001', marche: 'NASDAQ' },
    { nom: 'Rheinmetall AG', bloomberg: 'RHM GY', isin: 'DE0007030009', marche: 'XETRA' },
    { nom: 'Renault SA', bloomberg: 'RNO FP', isin: 'FR0000131906', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 17.75,
    barriereCouponPct: 75,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(irrObs, irrPay, {
    niveauRappelPct: (n) => irrAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 4.4375,
    niveauCouponPct: 75,
    rappelActifAPartirDe: 3,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Intel + Rheinmetall + Renault',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '250915_5Y_Phoenix Memory  Wof Intel +  Rheinmetall  +  Renault_Trimestriel_XS3109495153_SANTANDER.pdf',
}

// ── XS3149224761 — Santander Phoenix Mémoire Mensuel MSFT + Nvidia + Marvell ──
const semObs = [
  '2025-09-22', '2025-10-20', '2025-11-20', '2025-12-22', '2026-01-20',
  '2026-02-20', '2026-03-20', '2026-04-20', '2026-05-20', '2026-06-22',
  '2026-07-20', '2026-08-20', '2026-09-21', '2026-10-20', '2026-11-20',
  '2026-12-21', '2027-01-20', '2027-02-22', '2027-03-22', '2027-04-20',
  '2027-05-20', '2027-06-21', '2027-07-20', '2027-08-20', '2027-09-20',
  '2027-10-20', '2027-11-22', '2027-12-20', '2028-01-20', '2028-02-22',
  '2028-03-20', '2028-04-20', '2028-05-22', '2028-06-20', '2028-07-20',
  '2028-08-21',
]
const semPay = [
  '2025-09-29', '2025-10-28', '2025-11-28', '2025-12-29', '2026-01-28',
  '2026-02-27', '2026-03-30', '2026-04-28', '2026-05-28', '2026-06-29',
  '2026-07-28', '2026-08-28', '2026-09-28', '2026-10-28', '2026-11-30',
  '2026-12-28', '2027-01-28', '2027-02-26', '2027-03-30', '2027-04-28',
  '2027-05-28', '2027-06-28', '2027-07-28', '2027-08-30', '2027-09-28',
  '2027-10-28', '2027-11-29', '2027-12-28', '2028-01-28', '2028-02-28',
  '2028-03-28', '2028-04-28', '2028-05-29', '2028-06-28', '2028-07-28',
  '2028-08-28',
]
// Autocall mensuel dégressif 90%→78,5% (-0,5%/mois) ; non-call n=1-11 ; n=36 = maturité.
const semAer: (number | undefined)[] = [
  undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined,
  90, 89.5, 89, 88.5, 88, 87.5, 87, 86.5, 86, 85.5, 85, 84.5, 84, 83.5,
  83, 82.5, 82, 81.5, 81, 80.5, 80, 79.5, 79, 78.5, undefined,
]
const santanderMsftNvdaMrvl: Product = {
  id: 'XS3149224761',
  nom: 'Phoenix Mémoire Mensuel Microsoft + Nvidia + Marvell',
  isin: 'XS3149224761',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2 / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 410_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-08-20',
  dateEmission: '2025-09-10',
  dateConstatationFinale: '2028-08-21',
  dateEcheance: '2028-08-28',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Microsoft Corp', bloomberg: 'MSFT US', isin: 'US5949181045', marche: 'NASDAQ' },
    { nom: 'Nvidia Corp', bloomberg: 'NVDA US', isin: 'US67066G1040', marche: 'NASDAQ' },
    { nom: 'Marvell Technology Inc', bloomberg: 'MRVL US', isin: 'US5738741041', marche: 'NASDAQ' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 11.4,
    barriereCouponPct: 70,
    barriereRappelPct: 90,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(semObs, semPay, {
    niveauRappelPct: (n) => semAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 0.95,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 12,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '3Y Phoenix Mémoire Mensuel Wof Microsoft + Nvidia + Marvell (11,4 %)',
  badges: ['Worst-of', 'Mensuel', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '250910_3Y_Phoenix Memoire Mensuel  MRVL + MSFT + NVDA  11.4%_Mensuel_XS3149224761_SANTANDER.pdf',
}

// ── FRIP00000HS8 — Morgan Stanley Phoenix Mémoire Kering + URW ───────────────
const kerObs = [
  '2024-07-29', '2024-10-29', '2025-01-29', '2025-04-29', '2025-07-29',
  '2025-10-29', '2026-01-29', '2026-04-29', '2026-07-29', '2026-10-29',
  '2027-01-29', '2027-04-29', '2027-07-29', '2027-10-29', '2028-01-31',
  '2028-04-28', '2028-07-31', '2028-10-30', '2029-01-29', '2029-04-30',
]
const kerPay = [
  '2024-08-05', '2024-11-05', '2025-02-05', '2025-05-07', '2025-08-05',
  '2025-11-05', '2026-02-05', '2026-05-07', '2026-08-05', '2026-11-05',
  '2027-02-05', '2027-05-06', '2027-08-05', '2027-11-05', '2028-02-07',
  '2028-05-08', '2028-08-07', '2028-11-06', '2029-02-05', '2029-05-08',
]
// Autocall à barrière constante 100% ; non-call n=1-3 ; n=20 = maturité.
const kerAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 100, 100, 100, 100, 100, 100,
  100, 100, 100, 100, 100, 100, 100, 100, 100, undefined,
]
const msKeringUrw: Product = {
  id: 'FRIP00000HS8',
  nom: 'Phoenix Mémoire Kering + Unibail-Rodamco-Westfield',
  isin: 'FRIP00000HS8',
  emetteur: 'Morgan Stanley & Co. International plc',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 500_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-04-29',
  dateEmission: '2024-05-14',
  dateConstatationFinale: '2029-04-30',
  dateEcheance: '2029-05-08',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Kering SA', bloomberg: 'KER FP', isin: 'FR0000121485', marche: 'Euronext Paris' },
    { nom: 'Unibail-Rodamco-Westfield', bloomberg: 'URW FP', isin: 'FR0013326246', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 9.0,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(kerObs, kerPay, {
    niveauRappelPct: (n) => kerAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.25,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Kering + Unibail-Rodamco-Westfield',
  badges: ['Worst-of', 'Effet mémoire'],
  termsheetFichier:
    '240514_5Y_Phoenix Memory on KER + URW_Trimestriel_FRIP00000HS8_MSCO.pdf',
}

// ── CH1316655518 — EFG « Athena Airbag » AMD + Intel + Nvidia ────────────────
// Nommé « Airbag » mais le remboursement sous barrière divise par le niveau
// initial (pas la barrière) : c'est un KI européen 60% standard, sans airbag.
const aniObs = [
  '2024-04-25', '2024-07-25', '2024-10-25', '2025-01-27', '2025-04-25',
  '2025-07-25', '2025-10-27', '2026-01-26', '2026-04-27', '2026-07-27',
  '2026-10-26', '2027-01-25',
]
const aniPay = [
  '2024-05-03', '2024-08-01', '2024-11-01', '2025-02-03', '2025-05-05',
  '2025-08-01', '2025-11-03', '2026-02-02', '2026-05-05', '2026-08-03',
  '2026-11-02', '2027-02-08',
]
const efgAmdIntelNvda: Product = {
  id: 'CH1316655518',
  nom: 'Athena Airbag AMD + Intel + Nvidia',
  isin: 'CH1316655518',
  emetteur: 'EFG International Finance (Guernsey) Ltd',
  garant: 'EFG International AG',
  notationEmetteur: 'Moody’s A3 / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 10_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-01-25',
  dateEmission: '2024-02-08',
  dateConstatationFinale: '2027-01-25',
  dateEcheance: '2027-02-08',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Advanced Micro Devices', bloomberg: 'AMD US', marche: 'NASDAQ' },
    { nom: 'Intel Corp', bloomberg: 'INTC US', isin: 'US4581401001', marche: 'NASDAQ' },
    { nom: 'Nvidia Corp', bloomberg: 'NVDA US', isin: 'US67066G1040', marche: 'NASDAQ' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 11.75,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(aniObs, aniPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: 100,
    couponPct: 2.938,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description: '3Y Athena AMD + Intel + Nvidia (coupon mémoire, Quanto EUR)',
  badges: ['Worst-of', 'Effet mémoire', 'Quanto EUR'],
  termsheetFichier:
    '240208_3Y_Athena Airbag AMD + Intel + NVDA_Trimestriel_CH1316655518_EFG.pdf',
}

// ── FRIP00001I09 — Morgan Stanley Phoenix Mémoire iEdge Transatlantic AI 10 ──
const iaiObs = [
  '2025-09-02', '2025-12-01', '2026-03-02', '2026-06-01', '2026-08-31',
  '2026-11-30', '2027-03-01', '2027-06-01', '2027-08-30', '2027-11-30',
  '2028-02-29', '2028-05-30', '2028-08-30', '2028-11-30', '2029-02-28',
  '2029-05-30', '2029-08-30', '2029-11-30', '2030-02-28', '2030-05-30',
  '2030-08-30', '2030-12-02', '2031-02-28', '2031-05-30', '2031-09-02',
  '2031-12-01', '2032-03-01', '2032-06-01', '2032-08-30', '2032-11-30',
  '2033-02-28', '2033-05-31', '2033-08-30', '2033-11-30', '2034-02-28',
  '2034-05-30', '2034-08-30', '2034-11-30', '2035-02-28', '2035-05-30',
  '2035-08-30', '2035-11-30', '2036-02-29', '2036-05-30', '2036-09-02',
  '2036-12-01', '2037-03-02', '2037-06-01',
]
const iaiPay = [
  '2025-09-09', '2025-12-08', '2026-03-09', '2026-06-08', '2026-09-07',
  '2026-12-07', '2027-03-08', '2027-06-08', '2027-09-06', '2027-12-07',
  '2028-03-07', '2028-06-06', '2028-09-06', '2028-12-07', '2029-03-07',
  '2029-06-06', '2029-09-06', '2029-12-07', '2030-03-07', '2030-06-06',
  '2030-09-06', '2030-12-09', '2031-03-07', '2031-06-06', '2031-09-09',
  '2031-12-08', '2032-03-08', '2032-06-08', '2032-09-06', '2032-12-07',
  '2033-03-07', '2033-06-07', '2033-09-06', '2033-12-07', '2034-03-07',
  '2034-06-06', '2034-09-06', '2034-12-07', '2035-03-07', '2035-06-06',
  '2035-09-06', '2035-12-07', '2036-03-07', '2036-06-06', '2036-09-09',
  '2036-12-08', '2037-03-09', '2037-06-08',
]
// Autocall dégressif 95%→71% (-1%/trim. de n=4 à n=28) puis plancher 70%
// (n=29→47) ; non-call n=1-3 ; n=48 = maturité.
const iaiAer: (number | undefined)[] = [
  undefined, undefined, undefined, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86,
  85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 70, 70,
  70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, undefined,
]
const msIEdgeAi: Product = {
  id: 'FRIP00001I09',
  nom: 'Phoenix Mémoire iEdge Transatlantic AI 10',
  isin: 'FRIP00001I09',
  emetteur: 'Morgan Stanley & Co. International plc',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-04-29',
  dateEmission: '2025-05-20',
  dateConstatationFinale: '2037-06-01',
  dateEcheance: '2037-06-08',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'iEdge Transatlantic Artificial Intelligence 10 Decrement 50pts GTR', bloomberg: 'IETAI10', marche: 'Indice' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 8.0,
    barriereCouponPct: 70,
    barriereRappelPct: 95,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    decrement: '50 points',
  },
  observations: buildObservations(iaiObs, iaiPay, {
    niveauRappelPct: (n) => iaiAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.0,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '12Y Phoenix Mémoire sur indice iEdge Transatlantic AI 10 (décrément 50 pts)',
  badges: ['Indice décrément', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '250520_12Y_Phoenix Memoire iEdge Transatlantic Artificial Intelligence 10 _Annuel_FRIP00001I09 _MSCO.pdf',
}

// ── FRIP000020P5 — Morgan Stanley Phoenix Mémoire « Ferroviaires » ───────────
// (Alstom + Thales + Siemens — rail / défense / industrie)
const ferObs = [
  '2026-04-07', '2026-07-07', '2026-10-07', '2027-01-07', '2027-04-07',
  '2027-07-07', '2027-10-07', '2028-01-07', '2028-04-07', '2028-07-07',
  '2028-10-09', '2029-01-08', '2029-04-09', '2029-07-09', '2029-10-08',
  '2030-01-07', '2030-04-08', '2030-07-08', '2030-10-07', '2031-01-07',
]
const ferPay = [
  '2026-04-14', '2026-07-14', '2026-10-14', '2027-01-14', '2027-04-14',
  '2027-07-14', '2027-10-14', '2028-01-14', '2028-04-18', '2028-07-14',
  '2028-10-16', '2029-01-15', '2029-04-16', '2029-07-16', '2029-10-15',
  '2030-01-14', '2030-04-15', '2030-07-15', '2030-10-14', '2031-01-14',
]
// Autocall dégressif 100%→70% (-2%/trim.) ; non-call n=1-3 ; n=20 = maturité.
const ferAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 98, 96, 94, 92, 90, 88, 86, 84,
  82, 80, 78, 76, 74, 72, 70, undefined,
]
const msFerroviaires: Product = {
  id: 'FRIP000020P5',
  nom: 'Phoenix Mémoire Ferroviaires (Alstom + Thales + Siemens)',
  isin: 'FRIP000020P5',
  emetteur: 'Morgan Stanley & Co. International plc',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-01-07',
  dateEmission: '2026-01-21',
  dateConstatationFinale: '2031-01-07',
  dateEcheance: '2031-01-14',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Alstom SA', bloomberg: 'ALO FP', isin: 'FR0010220475', marche: 'Euronext Paris' },
    { nom: 'Thales SA', bloomberg: 'HO FP', isin: 'FR0000121329', marche: 'Euronext Paris' },
    { nom: 'Siemens AG', bloomberg: 'SIE GY', isin: 'DE0007236101', marche: 'XETRA' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.0,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(ferObs, ferPay, {
    niveauRappelPct: (n) => ferAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.25,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Alstom + Thales + Siemens',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '260121_5Y_Phoenix Mémoire Ferrovaires_Trimestriel_FRIP000020P5_MSCO.pdf',
}

// ── XS3231246805 — Santander Phoenix Mémoire Micron + Marvell ───────────────
const muObs = [
  '2026-03-11', '2026-06-11', '2026-09-11', '2026-12-11', '2027-03-11',
  '2027-06-11', '2027-09-13', '2027-12-13', '2028-03-13', '2028-06-12',
  '2028-09-11', '2028-12-11', '2029-03-12', '2029-06-11', '2029-09-11',
  '2029-12-11', '2030-03-11', '2030-06-11', '2030-09-11', '2030-12-11',
]
const muPay = [
  '2026-04-07', '2026-07-06', '2026-10-06', '2027-01-06', '2027-04-06',
  '2027-07-06', '2027-10-06', '2028-01-06', '2028-04-06', '2028-07-06',
  '2028-10-06', '2029-01-08', '2029-04-06', '2029-07-06', '2029-10-08',
  '2030-01-07', '2030-04-08', '2030-07-08', '2030-10-07', '2031-01-06',
]
// Autocall dégressif 100%→53,05% (-3,13%/trim.) ; non-call n=1-3 ; n=20 = maturité.
const muAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 96.87, 93.74, 90.61, 87.48, 84.35,
  81.22, 78.09, 74.96, 71.83, 68.7, 65.57, 62.44, 59.31, 56.18, 53.05, undefined,
]
const santanderMicronMarvell: Product = {
  id: 'XS3231246805',
  nom: 'Phoenix Mémoire Micron + Marvell',
  isin: 'XS3231246805',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 400_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-12-11',
  dateEmission: '2026-01-06',
  dateConstatationFinale: '2030-12-11',
  dateEcheance: '2031-01-06',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Micron Technology Inc', bloomberg: 'MU US', isin: 'US5951121038', marche: 'NASDAQ' },
    { nom: 'Marvell Technology Inc', bloomberg: 'MRVL US', isin: 'US5738741041', marche: 'NASDAQ' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 12.8,
    barriereCouponPct: 50,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(muObs, muPay, {
    niveauRappelPct: (n) => muAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 3.2,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Micron + Marvell (Quanto EUR)',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire', 'Quanto EUR'],
  termsheetFichier:
    '260106_5Y_Phoenix Memoire MRVL + MU_Trimestriel_XS3231246805_SANTANDER.pdf',
}

// ── XS3309979311 — BNP Phoenix Snowball Mensuel Microsoft + Salesforce + SAP ─
const swObs = [
  '2026-04-20', '2026-05-20', '2026-06-22', '2026-07-20', '2026-08-20',
  '2026-09-21', '2026-10-20', '2026-11-20', '2026-12-21', '2027-01-20',
  '2027-02-22', '2027-03-22', '2027-04-20', '2027-05-20', '2027-06-21',
  '2027-07-20', '2027-08-20', '2027-09-20', '2027-10-20', '2027-11-22',
  '2027-12-20', '2028-01-20', '2028-02-22', '2028-03-20', '2028-04-20',
  '2028-05-22', '2028-06-20', '2028-07-20', '2028-08-21', '2028-09-20',
  '2028-10-20', '2028-11-20', '2028-12-20', '2029-01-22', '2029-02-20',
  '2029-03-20', '2029-04-20', '2029-05-21', '2029-06-20', '2029-07-20',
  '2029-08-20', '2029-09-20', '2029-10-22', '2029-11-20', '2029-12-20',
  '2030-01-22', '2030-02-20', '2030-03-20', '2030-04-23', '2030-05-20',
  '2030-06-20', '2030-07-22', '2030-08-20', '2030-09-20', '2030-10-21',
  '2030-11-20', '2030-12-20', '2031-01-21', '2031-02-20', '2031-03-20',
]
const swPay = [
  '2026-05-05', '2026-06-03', '2026-07-06', '2026-08-03', '2026-09-03',
  '2026-10-05', '2026-11-03', '2026-12-04', '2027-01-06', '2027-02-03',
  '2027-03-08', '2027-04-07', '2027-05-04', '2027-06-03', '2027-07-05',
  '2027-08-03', '2027-09-03', '2027-10-04', '2027-11-03', '2027-12-06',
  '2028-01-03', '2028-02-03', '2028-03-07', '2028-04-03', '2028-05-05',
  '2028-06-05', '2028-07-04', '2028-08-03', '2028-09-04', '2028-10-04',
  '2028-11-03', '2028-12-04', '2029-01-08', '2029-02-05', '2029-03-06',
  '2029-04-05', '2029-05-07', '2029-06-04', '2029-07-04', '2029-08-03',
  '2029-09-03', '2029-10-04', '2029-11-05', '2029-12-04', '2030-01-08',
  '2030-02-05', '2030-03-06', '2030-04-03', '2030-05-08', '2030-06-03',
  '2030-07-04', '2030-08-05', '2030-09-03', '2030-10-04', '2030-11-04',
  '2030-12-04', '2031-01-08', '2031-02-04', '2031-03-06', '2031-04-03',
]
// Snowball mensuel : autocall dégressif 98%→51% (-1%/mois) ; non-call n=1-11 ; n=60 = maturité.
const swAer: (number | undefined)[] = [
  undefined, undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined,
  98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81,
  80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63,
  62, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, undefined,
]
const bnpSoftware: Product = {
  id: 'XS3309979311',
  nom: 'Phoenix Mémoire Mensuel Software (Microsoft + Salesforce + SAP)',
  isin: 'XS3309979311',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-20',
  dateEmission: '2026-04-07',
  dateConstatationFinale: '2031-03-20',
  dateEcheance: '2031-04-03',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Microsoft Corp', bloomberg: 'MSFT UW', isin: 'US5949181045', marche: 'NASDAQ' },
    { nom: 'Salesforce Inc', bloomberg: 'CRM UN', isin: 'US79466L3024', marche: 'NYSE' },
    { nom: 'SAP SE', bloomberg: 'SAP GY', isin: 'DE0007164600', marche: 'XETRA' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.2,
    barriereCouponPct: 50,
    barriereRappelPct: 98,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(swObs, swPay, {
    niveauRappelPct: (n) => swAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 0.767,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 12,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Snowball Mensuel Wof Microsoft + Salesforce + SAP',
  badges: ['Worst-of', 'Mensuel', 'Dégressif', 'Snowball'],
  termsheetFichier:
    '260407_5Y_Phoenix Mémoire Software (CRM + MSFT + SAP)_Trimestriel_XS3309979311_BNP.pdf',
}

// ── XS3317870197 — BNP Phoenix Snowball Accor + Carnival + United Airlines ───
const accObs = [
  '2026-06-29', '2026-09-28', '2026-12-28', '2027-03-30', '2027-06-28',
  '2027-09-27', '2027-12-27', '2028-03-27', '2028-06-27', '2028-09-27',
  '2028-12-27', '2029-03-27', '2029-06-27', '2029-09-27', '2029-12-27',
  '2030-03-27', '2030-06-27', '2030-09-27', '2030-12-27', '2031-03-27',
]
const accPay = [
  '2026-07-13', '2026-10-12', '2027-01-12', '2027-04-13', '2027-07-12',
  '2027-10-11', '2028-01-10', '2028-04-10', '2028-07-11', '2028-10-11',
  '2029-01-11', '2029-04-12', '2029-07-11', '2029-10-11', '2030-01-11',
  '2030-04-10', '2030-07-11', '2030-10-11', '2031-01-13', '2031-04-10',
]
// Autocall dégressif 90%→52,5% (-2,5%/trim.) ; non-call n=1-3 ; n=20 = maturité.
const accAer: (number | undefined)[] = [
  undefined, undefined, undefined, 90, 87.5, 85, 82.5, 80, 77.5, 75, 72.5,
  70, 67.5, 65, 62.5, 60, 57.5, 55, 52.5, undefined,
]
const bnpAccorCarnivalUal: Product = {
  id: 'XS3317870197',
  nom: 'Phoenix Mémoire Accor + Carnival + United Airlines',
  isin: 'XS3317870197',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-27',
  dateEmission: '2026-04-10',
  dateConstatationFinale: '2031-03-27',
  dateEcheance: '2031-04-10',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Accor SA', bloomberg: 'AC FP', isin: 'FR0000120404', marche: 'Euronext Paris' },
    { nom: 'Carnival Corp', bloomberg: 'CCL UN', isin: 'US1436583006', marche: 'NYSE' },
    { nom: 'United Airlines Holdings Inc', bloomberg: 'UAL UW', isin: 'US9100471096', marche: 'NASDAQ' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 13.0,
    barriereCouponPct: 50,
    barriereRappelPct: 90,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(accObs, accPay, {
    niveauRappelPct: (n) => accAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 3.25,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Accor + Carnival + United Airlines',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '260410_5Y_Phoenix Mémoire Worst of Accor + Carnival corp  + United Airlines_Trimestriel_XS3317870197_BNP.PDF',
}

// ── XS3204634086 — BBVA Autocall + Bonus Europe Healthcare (indice décrément) ─
// Snowball : trigger d'autocall plat 100%, prime de rappel croissante
// 110%→215% (+5%/sem.) ; coupon Phoenix 6% digital seulement sur les 3 1res obs ;
// bonus final 220% si l'indice ≥ 100% à maturité. KI 50% européen.
const hcObs = [
  '2027-03-15', '2027-09-13', '2028-03-13', '2028-09-13', '2029-03-13',
  '2029-09-13', '2030-03-13', '2030-09-13', '2031-03-13', '2031-09-15',
  '2032-03-15', '2032-09-13', '2033-03-14', '2033-09-13', '2034-03-13',
  '2034-09-13', '2035-03-13', '2035-09-13', '2036-03-13', '2036-09-15',
  '2037-03-13', '2037-09-14', '2038-03-15',
]
const hcPay = [
  '2027-03-22', '2027-09-20', '2028-03-20', '2028-09-20', '2029-03-20',
  '2029-09-20', '2030-03-20', '2030-09-20', '2031-03-20', '2031-09-22',
  '2032-03-22', '2032-09-20', '2033-03-21', '2033-09-20', '2034-03-20',
  '2034-09-20', '2035-03-20', '2035-09-20', '2036-03-20', '2036-09-22',
  '2037-03-20', '2037-09-21', '2038-03-22',
]
// Prime de rappel croissante (n=1→22) puis bonus 220% à maturité (n=23).
const hcErv = [
  110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175,
  180, 185, 190, 195, 200, 205, 210, 215, 220,
]
const bbvaHealthcareBonus: Product = {
  id: 'XS3204634086',
  nom: 'Autocall Bonus Europe Healthcare',
  isin: 'XS3204634086',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria, S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-13',
  dateEmission: '2026-01-07',
  dateConstatationFinale: '2038-03-15',
  dateEcheance: '2038-03-22',
  frequence: 'semestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'Bloomberg Europe Health Care Select Multi Factor Decrement 50pts GR', bloomberg: 'EURHGPT', marche: 'Indice' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: false,
    couponPa: 12.0,
    barriereCouponPct: 100,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    bonusFinalPct: 120,
  },
  observations: buildObservations(hcObs, hcPay, {
    niveauRappelPct: (n) => (n <= 22 ? 100 : undefined),
    montantRemboursementPct: (n) => hcErv[n - 1],
    couponPct: (n) => (n <= 3 ? 6 : undefined),
    niveauCouponPct: 100,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall Bonus',
  description: '12Y Autocall Bonus sur indice Bloomberg Europe Healthcare (décrément 50 pts)',
  badges: ['Indice décrément', 'Snowball', 'Bonus'],
  termsheetFichier:
    '260107_12Y_Autocall + Bonus Europe Healthcare_Semestriel_XS3204634086_BBVA.pdf',
}

// ── XS3250102665 — BBVA Phoenix Mémoire « Réarmement Europe » (défense) ──────
const rearObs = [
  '2026-04-27', '2026-07-27', '2026-10-26', '2027-01-26', '2027-04-26',
  '2027-07-26', '2027-10-26', '2028-01-26', '2028-04-26', '2028-07-26',
  '2028-10-26', '2029-01-26', '2029-04-26', '2029-07-26', '2029-10-26',
  '2030-01-28', '2030-04-26', '2030-07-26', '2030-10-28', '2031-01-27',
]
const rearPay = [
  '2026-05-05', '2026-08-03', '2026-11-02', '2027-02-02', '2027-05-03',
  '2027-08-02', '2027-11-02', '2028-02-02', '2028-05-04', '2028-08-02',
  '2028-11-02', '2029-02-02', '2029-05-04', '2029-08-02', '2029-11-02',
  '2030-02-04', '2030-05-06', '2030-08-02', '2030-11-04', '2031-02-03',
]
// Autocall à barrière constante 90% ; non-call n=1-4 ; n=20 = maturité.
const rearAer: (number | undefined)[] = [
  undefined, undefined, undefined, undefined, 90, 90, 90, 90, 90, 90, 90,
  90, 90, 90, 90, 90, 90, 90, 90, undefined,
]
const bbvaRearmement: Product = {
  id: 'XS3250102665',
  nom: 'Phoenix Mémoire Réarmement Europe (Leonardo + Rheinmetall + Safran)',
  isin: 'XS3250102665',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria, S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-01-26',
  dateEmission: '2026-02-20',
  dateConstatationFinale: '2031-01-27',
  dateEcheance: '2031-02-03',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Leonardo SpA', bloomberg: 'LDO IM', isin: 'IT0003856405', marche: 'Borsa Italiana' },
    { nom: 'Rheinmetall AG', bloomberg: 'RHM GY', isin: 'DE0007030009', marche: 'XETRA' },
    { nom: 'Safran SA', bloomberg: 'SAF FP', isin: 'FR0000073272', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 10.0,
    barriereCouponPct: 65,
    barriereRappelPct: 90,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(rearObs, rearPay, {
    niveauRappelPct: (n) => rearAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.5,
    niveauCouponPct: 65,
    rappelActifAPartirDe: 5,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Leonardo + Rheinmetall + Safran (défense européenne)',
  badges: ['Worst-of', 'Effet mémoire'],
  termsheetFichier:
    '260220_5Y_Phoenix Memoire Réarmement Europe_Trimestriel_XS3250102665_BBVA.pdf',
}

// ── XS3292034843 — Santander Phoenix Mémoire LafargeHolcim + Heidelberg + Legrand
const matObs = [
  '2026-07-24', '2026-10-26', '2027-01-25', '2027-04-26', '2027-07-26',
  '2027-10-25', '2028-01-24', '2028-04-24', '2028-07-24', '2028-10-24',
  '2029-01-24', '2029-04-24', '2029-07-24', '2029-10-24', '2030-01-24',
  '2030-04-24', '2030-07-24', '2030-10-24', '2031-01-24', '2031-04-24',
  '2031-07-24', '2031-10-24', '2032-01-26', '2032-04-26',
]
const matPay = [
  '2026-08-10', '2026-11-09', '2027-02-08', '2027-05-10', '2027-08-09',
  '2027-11-08', '2028-02-08', '2028-05-08', '2028-08-08', '2028-11-08',
  '2029-02-08', '2029-05-08', '2029-08-08', '2029-11-08', '2030-02-08',
  '2030-05-08', '2030-08-08', '2030-11-08', '2031-02-10', '2031-05-08',
  '2031-08-08', '2031-11-10', '2032-02-09', '2032-05-10',
]
// Autocall dégressif 100%→85% (-1,5%/trim. puis plancher 85%) ; non-call n=1-3 ; n=24 = maturité.
const matAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 98.5, 97, 95.5, 94, 92.5, 91, 89.5,
  88, 86.5, 85, 85, 85, 85, 85, 85, 85, 85, 85, 85, undefined,
]
const santanderMaterials: Product = {
  id: 'XS3292034843',
  nom: 'Phoenix Mémoire LafargeHolcim + HeidelbergCement + Legrand',
  isin: 'XS3292034843',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-04-24',
  dateEmission: '2026-05-08',
  dateConstatationFinale: '2032-04-26',
  dateEcheance: '2032-05-10',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'LafargeHolcim Ltd', bloomberg: 'HOLN SW', isin: 'CH0012214059', marche: 'SIX Swiss' },
    { nom: 'HeidelbergCement AG', bloomberg: 'HEI GY', isin: 'DE0006047004', marche: 'XETRA' },
    { nom: 'Legrand SA', bloomberg: 'LR FP', isin: 'FR0010307819', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.2,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(matObs, matPay, {
    niveauRappelPct: (n) => matAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.3,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '6Y Phoenix Mémoire Wof LafargeHolcim + HeidelbergCement + Legrand',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '260508_5YY_Phoenix Memoire Heidelberg materials + Holcim + Legrand_Trimestriel_XS3292034843_SANTANDER.pdf',
}

// ── XS3262087797 — Marex Inverse Reverse Autocall USO (bearish pétrole) ──────
// Rappel anticipé si USO ≤ 100% ; risque capital à la HAUSSE (barrière 150%).
const usoInvObs = ['2026-06-15', '2026-09-14', '2026-12-14', '2027-03-15']
const usoInvPay = ['2026-06-23', '2026-09-21', '2026-12-21', '2027-03-22']
const marexUsoInverse: Product = {
  id: 'XS3262087797',
  nom: 'Inverse Reverse Autocall USO',
  isin: 'XS3262087797',
  emetteur: 'Marex Financial',
  notationEmetteur: 'S&P BBB',
  assetClass: 'commodity',
  family: 'autocall',
  devise: 'USD',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-13',
  dateEmission: '2026-03-27',
  dateConstatationFinale: '2027-03-15',
  dateEcheance: '2027-03-22',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'United States Oil Fund LP', bloomberg: 'USO UP', marche: 'NYSE Arca' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'inverse',
    effetMemoire: false,
    degressif: false,
    couponPa: 21.752,
    couponGaranti: true,
    barriereRappelPct: 100,
    protectionPct: 150,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(usoInvObs, usoInvPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: 100,
    couponPct: 5.438,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Reverse Autocall',
  description: '1Y Inverse Reverse Autocall USO — coupon 5,438 %/trim. garanti, barrière haute 150 %',
  badges: ['Inverse', 'Single', 'Coupon garanti'],
  termsheetFichier:
    '260327_1Y_Inverse Reverse Autocall USO_Trimestriel_XS3262087797_MAREX.PDF',
}

// ── XS3045914713 — BNP Phoenix Mémoire Silver Miners ────────────────────────
const silObs = [
  '2025-09-10', '2025-12-10', '2026-03-10', '2026-06-10', '2026-09-10',
  '2026-12-10', '2027-03-10', '2027-06-10', '2027-09-10', '2027-12-10',
  '2028-03-10', '2028-06-12', '2028-09-11', '2028-12-11', '2029-03-12',
  '2029-06-11', '2029-09-10', '2029-12-10', '2030-03-11', '2030-06-10',
]
const silPay = [
  '2025-09-24', '2025-12-24', '2026-03-24', '2026-06-24', '2026-09-24',
  '2026-12-24', '2027-03-24', '2027-06-24', '2027-09-24', '2027-12-24',
  '2028-03-24', '2028-06-26', '2028-09-25', '2028-12-27', '2029-03-26',
  '2029-06-25', '2029-09-24', '2029-12-24', '2030-03-25', '2030-06-24',
]
// Autocall constant 100% ; non-call n=1-3 ; n=20 = maturité.
const silAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 100, 100, 100, 100, 100, 100, 100,
  100, 100, 100, 100, 100, 100, 100, 100, undefined,
]
const bnpSilverMiners: Product = {
  id: 'XS3045914713',
  nom: 'Phoenix Mémoire Silver Miners',
  isin: 'XS3045914713',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 250_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-06-10',
  dateEmission: '2025-07-01',
  dateConstatationFinale: '2030-06-10',
  dateEcheance: '2030-06-24',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'First Majestic Silver Corp', bloomberg: 'AG UN', marche: 'NYSE' },
    { nom: 'Newmont Corp', bloomberg: 'NEM UN', marche: 'NYSE' },
    { nom: 'Pan American Silver Corp', bloomberg: 'PAAS UN', marche: 'NASDAQ' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 11.0,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(silObs, silPay, {
    niveauRappelPct: (n) => silAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.75,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Silver Miners (First Majestic + Newmont + Pan American, Quanto EUR)',
  badges: ['Worst-of', 'Effet mémoire', 'Quanto EUR'],
  termsheetFichier:
    '250701_5Y_Phoenix Memory Wof Silver Miners - 11%_Trimestriel_XS3045914713_BNP.pdf',
}

// ── XS3304996484 — Barclays Phoenix Mémoire BNP + Veolia + Engie ─────────────
const bveObs = [
  '2026-06-22', '2026-09-21', '2026-12-21', '2027-03-22', '2027-06-21',
  '2027-09-20', '2027-12-20', '2028-03-20', '2028-06-20', '2028-09-20',
  '2028-12-20', '2029-03-20', '2029-06-20', '2029-09-20', '2029-12-20',
  '2030-03-20', '2030-06-20', '2030-09-20', '2030-12-20', '2031-03-20',
]
const bvePay = [
  '2026-07-06', '2026-10-05', '2027-01-06', '2027-04-07', '2027-07-05',
  '2027-10-04', '2028-01-03', '2028-04-03', '2028-07-04', '2028-10-04',
  '2029-01-08', '2029-04-05', '2029-07-04', '2029-10-04', '2030-01-08',
  '2030-04-03', '2030-07-04', '2030-10-04', '2031-01-08', '2031-04-03',
]
// Autocall dégressif 100%→76% (-1,5%/trim.) ; non-call n=1-2 ; n=20 = maturité.
const bveAer: (number | undefined)[] = [
  undefined, undefined, 100, 98.5, 97, 95.5, 94, 92.5, 91, 89.5, 88, 86.5,
  85, 83.5, 82, 80.5, 79, 77.5, 76, undefined,
]
const barclaysBnpVeoliaEngie: Product = {
  id: 'XS3304996484',
  nom: 'Phoenix Mémoire BNP + Veolia + Engie',
  isin: 'XS3304996484',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 2_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-20',
  dateEmission: '2026-04-07',
  dateConstatationFinale: '2031-03-20',
  dateEcheance: '2031-04-03',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'BNP Paribas SA', bloomberg: 'BNP FP', isin: 'FR0000131104', marche: 'Euronext Paris' },
    { nom: 'Veolia Environnement SA', bloomberg: 'VIE FP', isin: 'FR0000124141', marche: 'Euronext Paris' },
    { nom: 'Engie SA', bloomberg: 'ENGI FP', isin: 'FR0010208488', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.1,
    barriereCouponPct: 50,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(bveObs, bvePay, {
    niveauRappelPct: (n) => bveAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.525,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 3,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof BNP + Veolia + Engie',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier: 'TS - XS3304996484.pdf',
}

// ── FRSG00015O52 — SG Athena Autocall LVMH (single) ─────────────────────────
const lvmhObs = [
  '2026-03-17', '2026-09-17', '2027-03-17', '2027-09-17', '2028-03-17',
  '2028-09-18', '2029-03-19', '2029-09-17', '2030-03-18',
]
const lvmhPay = [
  '2026-03-24', '2026-09-24', '2027-03-24', '2027-09-24', '2028-03-24',
  '2028-09-25', '2029-03-26', '2029-09-24', '2030-03-25',
]
// Athena : coupon versé seulement au rappel = 100% + i×5% (croissant) ; rappel
// à barrière 100% dès la 1re obs ; +50% bonus à maturité si perf ≥ 0%.
const lvmhErv = [110, 115, 120, 125, 130, 135, 140, 145, 150]
const sgLvmh: Product = {
  id: 'FRSG00015O52',
  nom: 'Athena Autocall LVMH',
  isin: 'FRSG00015O52',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-03-17',
  dateEmission: '2025-03-17',
  dateConstatationFinale: '2030-03-18',
  dateEcheance: '2030-03-25',
  frequence: 'semestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'LVMH Moët Hennessy Louis Vuitton SE', bloomberg: 'MC FP', isin: 'FR0000121014', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false, // Athena à prime : pas de coupon mémoire (TS)
    degressif: false,
    couponPa: 10.0, // prime indicative (+5 %/semestre) ; aucun coupon distribué
    barriereRappelPct: 100,
    protectionPct: 70,
    protectionStyle: 'europeenne',
    bonusFinalPct: 50,
  },
  observations: buildObservations(lvmhObs, lvmhPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => lvmhErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description: '5Y Athena Autocall LVMH — prime au rappel 100%+i×5%, KI 70% européen, bonus +50%',
  badges: ['Single', 'Athena', 'Bonus +50%'],
  termsheetFichier: 'TS_FRSG00015O52.pdf',
}

// ── XS3250077966 — BBVA Athena Airbag step-up LVMH + TotalEnergies (« strikée »)
// Pas de coupon périodique : prime de rappel croissante 110%→160% (~0,83%/mois),
// barrière de rappel dégressive par année 100→95→90→85→80%, airbag (strike au
// plus bas des 2 fixings), KI 50% européen, bonus 160% à maturité si worst ≥ 75%.
const lvtObs = [
  '2027-03-30', '2027-04-27', '2027-05-27', '2027-06-28', '2027-07-27',
  '2027-08-27', '2027-09-27', '2027-10-27', '2027-11-29', '2027-12-27',
  '2028-01-27', '2028-02-28', '2028-03-27', '2028-04-27', '2028-05-29',
  '2028-06-27', '2028-07-27', '2028-08-28', '2028-09-27', '2028-10-27',
  '2028-11-27', '2028-12-27', '2029-01-29', '2029-02-27', '2029-03-27',
  '2029-04-27', '2029-05-28', '2029-06-27', '2029-07-27', '2029-08-27',
  '2029-09-27', '2029-10-29', '2029-11-27', '2029-12-27', '2030-01-28',
  '2030-02-27', '2030-03-27', '2030-04-29', '2030-05-27', '2030-06-27',
  '2030-07-29', '2030-08-27', '2030-09-27', '2030-10-28', '2030-11-27',
  '2030-12-27', '2031-01-27', '2031-02-27', '2031-03-27', '2031-04-28',
  '2031-05-27', '2031-06-27', '2031-07-28', '2031-08-27', '2031-09-29',
  '2031-10-27', '2031-11-27', '2031-12-29', '2032-01-27', '2032-02-27',
  '2032-03-30',
]
const lvtPay = [
  '2027-04-06', '2027-05-04', '2027-06-03', '2027-07-05', '2027-08-03',
  '2027-09-03', '2027-10-04', '2027-11-03', '2027-12-06', '2028-01-03',
  '2028-02-03', '2028-03-06', '2028-04-03', '2028-05-05', '2028-06-05',
  '2028-07-04', '2028-08-03', '2028-09-04', '2028-10-04', '2028-11-03',
  '2028-12-04', '2029-01-04', '2029-02-05', '2029-03-06', '2029-04-05',
  '2029-05-07', '2029-06-04', '2029-07-04', '2029-08-03', '2029-09-03',
  '2029-10-04', '2029-11-05', '2029-12-04', '2030-01-04', '2030-02-04',
  '2030-03-06', '2030-04-03', '2030-05-07', '2030-06-03', '2030-07-04',
  '2030-08-05', '2030-09-03', '2030-10-04', '2030-11-04', '2030-12-04',
  '2031-01-06', '2031-02-03', '2031-03-06', '2031-04-03', '2031-05-06',
  '2031-06-03', '2031-07-04', '2031-08-04', '2031-09-03', '2031-10-06',
  '2031-11-03', '2031-12-04', '2032-01-06', '2032-02-03', '2032-03-05',
  '2032-04-06',
]
const lvtErv = [
  110.0008, 110.8342, 111.6676, 112.501, 113.3344, 114.1678, 115.0012,
  115.8346, 116.668, 117.5014, 118.3348, 119.1682, 120.0016, 120.835,
  121.6684, 122.5018, 123.3352, 124.1686, 125.002, 125.8354, 126.6688,
  127.5022, 128.3356, 129.169, 130.0024, 130.8358, 131.6692, 132.5026,
  133.336, 134.1694, 135.0028, 135.8362, 136.6696, 137.503, 138.3364,
  139.1698, 140.0032, 140.8366, 141.67, 142.5034, 143.3368, 144.1702,
  145.0036, 145.837, 146.6704, 147.5038, 148.3372, 149.1706, 150.004,
  150.8374, 151.6708, 152.5042, 153.3376, 154.171, 155.0044, 155.8378,
  156.6712, 157.5046, 158.338, 159.1714, 160.0048,
]
// Barrière de rappel dégressive par année : 100%(an1)→95→90→85→80% ; n=61 = maturité.
const lvtBarriere = (n: number): number | undefined => {
  if (n > 60) return undefined
  if (n <= 12) return 100
  if (n <= 24) return 95
  if (n <= 36) return 90
  if (n <= 48) return 85
  return 80
}
const bbvaLvmhTotalAirbag: Product = {
  id: 'XS3250077966',
  nom: 'Athena Airbag LVMH + TotalEnergies',
  isin: 'XS3250077966',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria, S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 500_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-01-29',
  dateEmission: '2026-03-27',
  dateConstatationFinale: '2032-03-30',
  dateEcheance: '2032-04-06',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'LVMH Moët Hennessy Louis Vuitton SE', bloomberg: 'MC FP', isin: 'FR0000121014', marche: 'Euronext Paris' },
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', isin: 'FR0000120271', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: true,
    airbag: true,
    couponPa: 10.0,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    bonusFinalPct: 60,
  },
  observations: buildObservations(lvtObs, lvtPay, {
    niveauRappelPct: (n) => lvtBarriere(n),
    montantRemboursementPct: (n) => lvtErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description: '6Y Athena Airbag mensuel Wof LVMH + TotalEnergies (prime croissante 110→160 %, KI 50 %)',
  badges: ['Worst-of', 'Mensuel', 'Airbag', 'Bonus', 'Dégressif'],
  termsheetFichier: 'TS_XS3250077966_strikée.pdf',
}

// ── XS3362988811 — BNP Phoenix Snowball Leonardo + Rheinmetall + Safran ──────
const lrsObs = [
  '2026-08-13', '2026-11-13', '2027-02-15', '2027-05-13', '2027-08-13',
  '2027-11-15', '2028-02-14', '2028-05-15', '2028-08-14', '2028-11-13',
  '2029-02-13', '2029-05-14', '2029-08-13', '2029-11-13', '2030-02-13',
  '2030-05-13', '2030-08-13', '2030-11-13', '2031-02-13', '2031-05-13',
]
const lrsPay = [
  '2026-08-27', '2026-11-27', '2027-03-01', '2027-05-27', '2027-08-27',
  '2027-11-29', '2028-02-28', '2028-05-29', '2028-08-28', '2028-11-27',
  '2029-02-27', '2029-05-28', '2029-08-27', '2029-11-27', '2030-02-27',
  '2030-05-27', '2030-08-27', '2030-11-27', '2031-02-27', '2031-05-27',
]
// Autocall dégressif 89%→66,5% (-1,5%/trim.) ; non-call n=1-4 ; n=20 = maturité.
const lrsAer: (number | undefined)[] = [
  undefined, undefined, undefined, undefined, 89, 87.5, 86, 84.5, 83, 81.5,
  80, 78.5, 77, 75.5, 74, 72.5, 71, 69.5, 68, 66.5,
]
const bnpLeonardoRhmSaf: Product = {
  id: 'XS3362988811',
  nom: 'Phoenix Snowball Leonardo + Rheinmetall + Safran',
  isin: 'XS3362988811',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-05-13',
  dateEmission: '2026-06-04',
  dateConstatationFinale: '2031-05-13',
  dateEcheance: '2031-05-27',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Leonardo SpA', bloomberg: 'LDO IM', isin: 'IT0003856405', marche: 'Borsa Italiana' },
    { nom: 'Rheinmetall AG', bloomberg: 'RHM GY', isin: 'DE0007030009', marche: 'XETRA' },
    { nom: 'Safran SA', bloomberg: 'SAF FP', isin: 'FR0000073272', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 11.15,
    barriereCouponPct: 65,
    barriereRappelPct: 89,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(lrsObs, lrsPay, {
    niveauRappelPct: (n) => lrsAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.7875,
    niveauCouponPct: 65,
    rappelActifAPartirDe: 5,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Snowball Wof Leonardo + Rheinmetall + Safran (défense)',
  badges: ['Worst-of', 'Dégressif', 'Snowball'],
  termsheetFichier: 'TS_XS3362988811.PDF',
}

// ── XS3362988902 — BNP Phoenix Snowball GE + Lockheed Martin + RTX ───────────
const gltObs = [
  '2026-08-13', '2026-11-13', '2027-02-16', '2027-05-13', '2027-08-13',
  '2027-11-15', '2028-02-14', '2028-05-15', '2028-08-14', '2028-11-13',
  '2029-02-13', '2029-05-14', '2029-08-13', '2029-11-13', '2030-02-13',
  '2030-05-13', '2030-08-13', '2030-11-13', '2031-02-13', '2031-05-13',
]
const gltPay = [
  '2026-08-27', '2026-11-27', '2027-03-02', '2027-05-27', '2027-08-27',
  '2027-11-29', '2028-02-28', '2028-05-29', '2028-08-28', '2028-11-27',
  '2029-02-27', '2029-05-28', '2029-08-27', '2029-11-27', '2030-02-27',
  '2030-05-27', '2030-08-27', '2030-11-27', '2031-02-27', '2031-05-27',
]
// Autocall dégressif 91%→76% (-1%/trim.) ; non-call n=1-3 ; n=20 = maturité.
const gltAer: (number | undefined)[] = [
  undefined, undefined, undefined, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82,
  81, 80, 79, 78, 77, 76, undefined,
]
const bnpGeLmtRtx: Product = {
  id: 'XS3362988902',
  nom: 'Phoenix Snowball GE + Lockheed Martin + RTX',
  isin: 'XS3362988902',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-05-13',
  dateEmission: '2026-06-04',
  dateConstatationFinale: '2031-05-13',
  dateEcheance: '2031-05-27',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'General Electric Co', bloomberg: 'GE UN', isin: 'US3696043013', marche: 'NYSE' },
    { nom: 'Lockheed Martin Corp', bloomberg: 'LMT UN', isin: 'US5398301094', marche: 'NYSE' },
    { nom: 'RTX Corp', bloomberg: 'RTX UN', isin: 'US75513E1010', marche: 'NYSE' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 8.15,
    barriereCouponPct: 60,
    barriereRappelPct: 91,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(gltObs, gltPay, {
    niveauRappelPct: (n) => gltAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.0375,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Snowball Wof GE + Lockheed Martin + RTX (EUR Quanto, défense US)',
  badges: ['Worst-of', 'Dégressif', 'Snowball', 'Quanto EUR'],
  termsheetFichier: 'TS_XS3362988902.PDF',
}

// ── XS3049573440 — Santander Phoenix Mémoire Hermès + Kering + LVMH (luxe) ───
const luxObs = [
  '2025-08-11', '2025-11-10', '2026-02-10', '2026-05-11', '2026-08-10',
  '2026-11-10', '2027-02-10', '2027-05-10', '2027-08-10', '2027-11-10',
  '2028-02-10', '2028-05-10', '2028-08-10', '2028-11-10', '2029-02-12',
  '2029-05-10', '2029-08-10', '2029-11-12', '2030-02-11', '2030-05-10',
  '2030-08-12', '2030-11-11', '2031-02-10', '2031-05-12',
]
const luxPay = [
  '2025-08-18', '2025-11-17', '2026-02-16', '2026-05-18', '2026-08-17',
  '2026-11-16', '2027-02-16', '2027-05-17', '2027-08-16', '2027-11-16',
  '2028-02-16', '2028-05-16', '2028-08-16', '2028-11-16', '2029-02-16',
  '2029-05-16', '2029-08-16', '2029-11-16', '2030-02-18', '2030-05-16',
  '2030-08-16', '2030-11-18', '2031-02-17', '2031-05-16',
]
// Autocall dégressif 100%→80% (-1,5%/trim. puis plancher 80%) ; non-call n=1-3 ; n=24 = maturité.
const luxAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 98.5, 97, 95.5, 94, 92.5, 91, 89.5,
  88, 86.5, 85, 83.5, 82, 80.5, 80, 80, 80, 80, 80, 80, undefined,
]
const santanderLuxe: Product = {
  id: 'XS3049573440',
  nom: 'Phoenix Mémoire Hermès + Kering + LVMH',
  isin: 'XS3049573440',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-04-28',
  dateEmission: '2025-05-16',
  dateConstatationFinale: '2031-05-12',
  dateEcheance: '2031-05-16',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Hermès International', bloomberg: 'RMS FP', isin: 'FR0000052292', marche: 'Euronext Paris' },
    { nom: 'Kering SA', bloomberg: 'KER FP', isin: 'FR0000121485', marche: 'Euronext Paris' },
    { nom: 'LVMH Moët Hennessy Louis Vuitton SE', bloomberg: 'MC FP', isin: 'FR0000121014', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.4,
    barriereCouponPct: 80,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(luxObs, luxPay, {
    niveauRappelPct: (n) => luxAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.35,
    niveauCouponPct: 80,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '6Y Phoenix Mémoire Wof Hermès + Kering + LVMH (luxe)',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '250516_6Y_Phoenix Memoire Wof Hermes + Kering + LVMH _Trimestriel_XS3049573440_SANTANDER.pdf',
}

// ── XS2759191286 — BNP Phoenix Mémoire Renault + Stellantis ──────────────────
// (ISIN de corps de termsheet : XS2759185551 ; clé conservée = ISIN du feed)
const rsObs = [
  '2024-07-18', '2024-10-18', '2025-01-20', '2025-04-22', '2025-07-18',
  '2025-10-20', '2026-01-19', '2026-04-20', '2026-07-20', '2026-10-19',
  '2027-01-18', '2027-04-19', '2027-07-19', '2027-10-18', '2028-01-18',
  '2028-04-18', '2028-07-18', '2028-10-18', '2029-01-18', '2029-04-18',
  '2029-07-18', '2029-10-18', '2030-01-18', '2030-04-18',
]
const rsPay = [
  '2024-08-01', '2024-11-01', '2025-02-03', '2025-05-07', '2025-08-01',
  '2025-11-03', '2026-02-02', '2026-05-05', '2026-08-03', '2026-11-02',
  '2027-02-01', '2027-05-03', '2027-08-02', '2027-11-01', '2028-02-01',
  '2028-05-03', '2028-08-01', '2028-11-01', '2029-02-01', '2029-05-03',
  '2029-08-01', '2029-11-01', '2030-02-01', '2030-05-07',
]
// Autocall constant 100% ; actif dès n=1 ; n=24 = maturité.
const rsAer: (number | undefined)[] = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  100, 100, 100, 100, 100, 100, 100, 100, 100, undefined,
]
const bnpRenaultStellantis: Product = {
  id: 'XS2759191286',
  nom: 'Phoenix Mémoire Renault + Stellantis',
  isin: 'XS2759191286',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 800_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-04-18',
  dateEmission: '2024-05-02',
  dateConstatationFinale: '2030-04-18',
  dateEcheance: '2030-05-07',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Renault SA', bloomberg: 'RNO FP', isin: 'FR0000131906', marche: 'Euronext Paris' },
    { nom: 'Stellantis NV', bloomberg: 'STLAM IM', isin: 'NL00150001Q9', marche: 'Borsa Italiana' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 11.2,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(rsObs, rsPay, {
    niveauRappelPct: (n) => rsAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.8,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '6Y Phoenix Mémoire Wof Renault + Stellantis',
  badges: ['Worst-of', 'Effet mémoire'],
  termsheetFichier:
    '240502_6Y_Phoenix Memory  Wof Stellantis + Renault_Trimestriel_XS2759191286_BNP.pdf',
}

// ── XS2886439467 — BNP Phoenix Mémoire TotalEnergies + Eni + Schlumberger ────
const eneObs = [
  '2025-05-06', '2025-11-06', '2026-05-06', '2026-11-06', '2027-05-06',
  '2027-11-08', '2028-05-08', '2028-11-06',
]
const enePay = [
  '2025-05-20', '2025-11-20', '2026-05-20', '2026-11-20', '2027-05-20',
  '2027-11-22', '2028-05-22', '2028-11-20',
]
// Autocall constant 100% ; non-call n=1 ; n=8 = maturité.
const eneAer: (number | undefined)[] = [
  undefined, 100, 100, 100, 100, 100, 100, undefined,
]
const bnpEnergie: Product = {
  id: 'XS2886439467',
  nom: 'Phoenix Mémoire TotalEnergies + Eni + Schlumberger',
  isin: 'XS2886439467',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-11-06',
  dateEmission: '2024-11-20',
  dateConstatationFinale: '2028-11-06',
  dateEcheance: '2028-11-20',
  frequence: 'semestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', isin: 'FR0000120271', marche: 'Euronext Paris' },
    { nom: 'Eni SpA', bloomberg: 'ENI IM', isin: 'IT0003132476', marche: 'Borsa Italiana' },
    { nom: 'Schlumberger Ltd (SLB)', bloomberg: 'SLB UN', isin: 'AN8068571086', marche: 'NYSE' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 10.0,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 70,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(eneObs, enePay, {
    niveauRappelPct: (n) => eneAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 5,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 2,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '4Y Phoenix Mémoire Wof TotalEnergies + Eni + Schlumberger (énergie)',
  badges: ['Worst-of', 'Effet mémoire'],
  termsheetFichier:
    '241120_4Y_Phoenix Memory  Wof TotalEnergies + Eni + Schlumberger_Semestriel_XS2886439467_BNP.pdf',
}

// ── XS3283137407 — BNP Phoenix Mémoire Alphabet + Amazon + CrowdStrike ───────
const techObs = [
  '2026-06-02', '2026-09-02', '2026-12-02', '2027-03-02', '2027-06-02',
  '2027-09-02', '2027-12-02', '2028-03-02', '2028-06-02', '2028-09-05',
  '2028-12-04', '2029-03-02', '2029-06-04', '2029-09-04', '2029-12-03',
  '2030-03-04', '2030-06-03', '2030-09-03', '2030-12-02', '2031-03-03',
]
const techPay = [
  '2026-06-16', '2026-09-16', '2026-12-16', '2027-03-16', '2027-06-16',
  '2027-09-16', '2027-12-16', '2028-03-16', '2028-06-16', '2028-09-19',
  '2028-12-18', '2029-03-16', '2029-06-18', '2029-09-18', '2029-12-17',
  '2030-03-18', '2030-06-17', '2030-09-17', '2030-12-16', '2031-03-17',
]
// Autocall dégressif 91%→76% (-1%/trim.) ; non-call n=1-3 ; n=20 = maturité.
const techAer: (number | undefined)[] = [
  undefined, undefined, undefined, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82,
  81, 80, 79, 78, 77, 76, undefined,
]
const bnpTechUs: Product = {
  id: 'XS3283137407',
  nom: 'Phoenix Mémoire Alphabet + Amazon + CrowdStrike',
  isin: 'XS3283137407',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-02',
  dateEmission: '2026-03-16',
  dateConstatationFinale: '2031-03-03',
  dateEcheance: '2031-03-17',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Alphabet Inc', bloomberg: 'GOOGL UW', isin: 'US02079K3059', marche: 'NASDAQ' },
    { nom: 'Amazon.com Inc', bloomberg: 'AMZN UW', isin: 'US0231351067', marche: 'NASDAQ' },
    { nom: 'CrowdStrike Holdings Inc', bloomberg: 'CRWD UW', isin: 'US22788C1053', marche: 'NASDAQ' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.7,
    barriereCouponPct: 50,
    barriereRappelPct: 91,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(techObs, techPay, {
    niveauRappelPct: (n) => techAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.675,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Alphabet + Amazon + CrowdStrike (EUR Quanto)',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire', 'Quanto EUR'],
  termsheetFichier:
    '260316_5Y_Phoenix Mémoire Wof  Alphabet   Amazon   CrowdStrike_Trimestriel_XS3283137407_BNP.pdf',
}

// ── XS3317172743 — BBVA Phoenix Mémoire Saint-Gobain + EssilorLuxottica + Pernod
const sgepObs = [
  '2026-06-29', '2026-09-28', '2026-12-28', '2027-03-30', '2027-06-28',
  '2027-09-27', '2027-12-27', '2028-03-27', '2028-06-27', '2028-09-27',
  '2028-12-27', '2029-03-27', '2029-06-27', '2029-09-27', '2029-12-27',
  '2030-03-27', '2030-06-27', '2030-09-27', '2030-12-27', '2031-03-27',
]
const sgepPay = [
  '2026-07-06', '2026-10-05', '2027-01-05', '2027-04-06', '2027-07-05',
  '2027-10-04', '2028-01-03', '2028-04-03', '2028-07-04', '2028-10-04',
  '2029-01-04', '2029-04-05', '2029-07-04', '2029-10-04', '2030-01-04',
  '2030-04-03', '2030-07-04', '2030-10-04', '2031-01-06', '2031-04-03',
]
// Autocall dégressif 99%→76,5% (-1,5%/trim.) ; non-call n=1-3 ; n=20 = maturité.
const sgepAer: (number | undefined)[] = [
  undefined, undefined, undefined, 99, 97.5, 96, 94.5, 93, 91.5, 90, 88.5,
  87, 85.5, 84, 82.5, 81, 79.5, 78, 76.5, undefined,
]
const bbvaSgoElRi: Product = {
  id: 'XS3317172743',
  nom: 'Phoenix Mémoire Saint-Gobain + EssilorLuxottica + Pernod Ricard',
  isin: 'XS3317172743',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria, S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-27',
  dateEmission: '2026-04-14',
  dateConstatationFinale: '2031-03-27',
  dateEcheance: '2031-04-03',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Compagnie de Saint-Gobain SA', bloomberg: 'SGO FP', isin: 'FR0000125007', marche: 'Euronext Paris' },
    { nom: 'EssilorLuxottica SA', bloomberg: 'EL FP', isin: 'FR0000121667', marche: 'Euronext Paris' },
    { nom: 'Pernod Ricard SA', bloomberg: 'RI FP', isin: 'FR0000120693', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.0,
    barriereCouponPct: 50,
    barriereRappelPct: 99,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(sgepObs, sgepPay, {
    niveauRappelPct: (n) => sgepAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.5,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof Saint-Gobain + EssilorLuxottica + Pernod Ricard',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '260414_5Y_Phoenix Mémoire Worst of Essilorluxottica + Saint gobain + Pernod Ricard_Trimestriel_XS3317172743_BBVA.pdf',
}

// ── FRIP00001IZ9 — Morgan Stanley Athena snowball sur indice MerQube TTEF ─────
// « TotalEnergies Septembre 2025 » mais sous-jacent = indice décrément MerQube
// TTEF 2,96 pts (PAS l'action). Pas de coupon périodique : prime de rappel
// croissante 110%→217,5% (+2,5%/trim.), barrière dégressive 100%→70%, KI 50%
// européen, bonus 220% à maturité si l'indice ≥ 70%.
const ttefObs = [
  '2026-09-21', '2026-12-21', '2027-03-19', '2027-06-21', '2027-09-20',
  '2027-12-20', '2028-03-20', '2028-06-19', '2028-09-19', '2028-12-19',
  '2029-03-19', '2029-06-19', '2029-09-19', '2029-12-19', '2030-03-19',
  '2030-06-19', '2030-09-19', '2030-12-19', '2031-03-19', '2031-06-19',
  '2031-09-19', '2031-12-19', '2032-03-19', '2032-06-21', '2032-09-20',
  '2032-12-20', '2033-03-21', '2033-06-20', '2033-09-19', '2033-12-19',
  '2034-03-20', '2034-06-19', '2034-09-19', '2034-12-19', '2035-03-19',
  '2035-06-19', '2035-09-19', '2035-12-19', '2036-03-19', '2036-06-19',
  '2036-09-19', '2036-12-19', '2037-03-19', '2037-06-19', '2037-09-21',
]
const ttefPay = [
  '2026-09-28', '2026-12-29', '2027-03-30', '2027-06-28', '2027-09-27',
  '2027-12-27', '2028-03-27', '2028-06-26', '2028-09-26', '2028-12-28',
  '2029-03-26', '2029-06-26', '2029-09-26', '2029-12-28', '2030-03-26',
  '2030-06-26', '2030-09-26', '2030-12-30', '2031-03-26', '2031-06-26',
  '2031-09-26', '2031-12-30', '2032-03-30', '2032-06-28', '2032-09-27',
  '2032-12-27', '2033-03-28', '2033-06-27', '2033-09-26', '2033-12-27',
  '2034-03-27', '2034-06-26', '2034-09-26', '2034-12-28', '2035-03-28',
  '2035-06-26', '2035-09-26', '2035-12-28', '2036-03-26', '2036-06-26',
  '2036-09-26', '2036-12-30', '2037-03-26', '2037-06-26', '2037-09-28',
]
// Barrière de rappel dégressive 100%→70% (-0,9%/trim. puis plancher 70%) ; n=45 = maturité.
const ttefAer: (number | undefined)[] = [
  100.0, 99.1, 98.2, 97.3, 96.4, 95.5, 94.6, 93.7, 92.8, 91.9, 91.0, 90.1,
  89.2, 88.3, 87.4, 86.5, 85.6, 84.7, 83.8, 82.9, 82.0, 81.1, 80.2, 79.3,
  78.4, 77.5, 76.6, 75.7, 74.8, 73.9, 73.0, 72.1, 71.2, 70.3, 70.0, 70.0,
  70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0, 70.0, undefined,
]
// Prime de rappel croissante 110%→217,5% ; bonus 220% à maturité (n=45).
const ttefErv = [
  110, 112.5, 115, 117.5, 120, 122.5, 125, 127.5, 130, 132.5, 135, 137.5,
  140, 142.5, 145, 147.5, 150, 152.5, 155, 157.5, 160, 162.5, 165, 167.5,
  170, 172.5, 175, 177.5, 180, 182.5, 185, 187.5, 190, 192.5, 195, 197.5,
  200, 202.5, 205, 207.5, 210, 212.5, 215, 217.5, 220,
]
const msMerqubeTtef: Product = {
  id: 'FRIP00001IZ9',
  nom: 'Athena Snowball indice MerQube TTEF (« TotalEnergies »)',
  isin: 'FRIP00001IZ9',
  emetteur: 'Morgan Stanley & Co. International plc',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-09-19',
  dateEmission: '2025-09-19',
  dateConstatationFinale: '2037-09-21',
  dateEcheance: '2037-09-28',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'MerQube TTEF 2.96 Index Points Decrement (EUR) Index', bloomberg: 'MQDTT296', marche: 'Indice' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: true,
    couponPa: 10.0,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    decrement: '2,96 points',
    bonusFinalPct: 120,
  },
  observations: buildObservations(ttefObs, ttefPay, {
    niveauRappelPct: (n) => ttefAer[n - 1],
    montantRemboursementPct: (n) => ttefErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description: '12Y Athena Snowball sur indice MerQube TotalEnergies décrément (prime croissante 110→217,5 %)',
  badges: ['Indice décrément', 'Snowball', 'Dégressif', 'Bonus'],
  termsheetFichier:
    '250528_12Y_Athena TotalEnergies Septembre 2025_0_FRIP00001IZ9_MSCO.pdf',
}

// ── FR001400OZR1 — SG Phoenix Bearish sur taux EUR CMS 10Y (capital garanti) ─
// Produit de TAUX : coupon conditionnel 3,75%/sem. (mémoire) si EUR CMS 10Y ≤
// 3,20% ; rappel anticipé si ≤ 2,30% (dès le sem. 4) ; coupon garanti 7,50%
// one-off ; capital 100% garanti à maturité ; coupons payés in fine.
const cmsObs = [
  '2025-12-22', '2026-06-22', '2026-12-21', '2027-06-21', '2027-12-21',
  '2028-06-21', '2028-12-21', '2029-06-21', '2029-12-21', '2030-06-21',
  '2030-12-23', '2031-06-23', '2031-12-22', '2032-06-21', '2032-12-21',
  '2033-06-21', '2033-12-21', '2034-06-21', '2034-12-21', '2035-06-21',
  '2035-12-21', '2036-06-23',
]
const cmsPay = [
  '2025-12-29', '2026-06-29', '2026-12-29', '2027-06-28', '2027-12-28',
  '2028-06-28', '2029-01-02', '2029-06-28', '2030-01-02', '2030-06-28',
  '2031-01-02', '2031-06-30', '2031-12-31', '2032-06-28', '2032-12-28',
  '2033-06-28', '2033-12-29', '2034-06-28', '2035-01-02', '2035-06-28',
  '2036-01-02', '2036-06-30',
]
// Barrière de rappel en TAUX : 2,30% sur la fenêtre d'autocall (sem. 4→23) ;
// non-call sur le sem. 3 (n=1) et le sem. 24 (n=22, maturité).
const cmsRappel: (number | undefined)[] = [
  undefined, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3,
  2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3, undefined,
]
const sgPhoenixCms10: Product = {
  id: 'FR001400OZR1',
  nom: 'Phoenix Bearish EUR CMS 10Y (capital garanti)',
  isin: 'FR001400OZR1',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  assetClass: 'rates',
  family: 'rates_structured',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-04-04',
  dateEmission: '2024-04-04',
  dateConstatationFinale: '2036-06-23',
  dateEcheance: '2036-06-30',
  frequence: 'semestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'EUR CMS 10Y', bloomberg: 'EUAMDB10 Index', marche: 'Taux' },
  ],
  terms: {
    kind: 'rates',
    type: 'phoenix_taux',
    sens: 'bearish',
    tauxReference: 'EUR CMS 10Y',
    effetMemoire: true,
    couponConditionnelPct: 3.75,
    couponConditionnelPa: 7.5,
    couponGarantiPct: 7.5,
    barriereCouponTauxPct: 3.2,
    barriereRappelTauxPct: 2.3,
    capitalGaranti: true,
    inFine: true,
  },
  observations: buildObservations(cmsObs, cmsPay, {
    niveauRappelPct: (n) => cmsRappel[n - 1],
    montantRemboursementPct: 100,
    couponPct: 3.75,
    niveauCouponPct: 3.2,
    rappelActifAPartirDe: 2,
  }),
  rr: 'LS',
  productType: 'Phoenix Taux',
  description: '12Y Phoenix Bearish EUR CMS 10Y — coupon 3,75%/sem. si ≤ 3,20%, autocall si ≤ 2,30%, capital garanti',
  badges: ['Taux', 'Bearish CMS10', 'Capital garanti', 'Effet mémoire'],
  termsheetFichier:
    '240404_12Y_Phoenix Bearish CMS10 7.5%_Semestriel_FR001400OZR1_SOCGEN.pdf',
}

// ── Helper : produit Phoenix Bearish sur taux (capital garanti) ──────────────
function phoenixBearish(p: {
  isin: string
  nom: string
  emetteur: string
  garant?: string
  notationEmetteur?: string
  nominal: number
  freq: Product['frequence']
  initial: string
  emission: string
  finale: string
  echeance: string
  tauxRef: string
  couponPct: number
  couponPa?: number // coupon annualisé (si ≠ couponPct, ex. semestriel/trimestriel)
  barriereCoupon: number
  barriereRappel: number
  rappelActif?: number // 1re observation où l'autocall est actif (fin du non-call)
  memoire?: boolean
  couponGaranti?: number
  inFine?: boolean
  obs: string[]
  pay: string[]
  description: string
  termsheetFichier: string
}): Product {
  const ra = p.rappelActif ?? 1
  const couponPa = p.couponPa ?? p.couponPct
  // Barrière de rappel (en taux) sur la fenêtre d'autocall : undefined pendant le
  // non-call de départ (n < ra) et sur la dernière observation (maturité).
  const rappel = p.obs.map((_, i) =>
    i + 1 >= ra && i < p.obs.length - 1 ? p.barriereRappel : undefined,
  )
  const badges = ['Taux', 'Bearish CMS10', 'Capital garanti']
  if (p.memoire) badges.push('Effet mémoire')
  if (p.inFine) badges.push('In fine')
  return {
    id: p.isin,
    nom: p.nom,
    isin: p.isin,
    emetteur: p.emetteur,
    garant: p.garant,
    notationEmetteur: p.notationEmetteur,
    assetClass: 'rates',
    family: 'rates_structured',
    devise: 'EUR',
    nominal: p.nominal,
    valeurNominale: 1000,
    prixEmission: 100,
    dateConstatationInitiale: p.initial,
    dateEmission: p.emission,
    dateConstatationFinale: p.finale,
    dateEcheance: p.echeance,
    frequence: p.freq,
    basket: 'single',
    sousJacents: [{ nom: p.tauxRef, marche: 'Taux' }],
    terms: {
      kind: 'rates',
      type: 'phoenix_taux',
      sens: 'bearish',
      tauxReference: p.tauxRef,
      effetMemoire: p.memoire ?? false,
      couponConditionnelPct: p.couponPct,
      couponConditionnelPa: couponPa,
      couponGarantiPct: p.couponGaranti,
      barriereCouponTauxPct: p.barriereCoupon,
      barriereRappelTauxPct: p.barriereRappel,
      capitalGaranti: true,
      inFine: p.inFine ?? false,
    },
    observations: buildObservations(p.obs, p.pay, {
      niveauRappelPct: (n) => rappel[n - 1],
      montantRemboursementPct: 100,
      couponPct: p.couponPct,
      niveauCouponPct: p.barriereCoupon,
      rappelActifAPartirDe: ra,
    }),
    rr: 'LS',
    productType: 'Phoenix Taux',
    description: p.description,
    badges,
    termsheetFichier: p.termsheetFichier,
  }
}

const sgBearish320 = phoenixBearish({
  isin: 'FRSG00014VA7',
  nom: 'Phoenix Bearish EUR CMS 10Y (3,20 % / 2,40 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 600_000,
  freq: 'annuel',
  initial: '2024-05-02',
  emission: '2024-05-09',
  finale: '2036-05-02',
  echeance: '2036-05-09',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 7.5,
  barriereCoupon: 3.2,
  barriereRappel: 2.4,
  obs: [
    '2025-05-02', '2026-05-04', '2027-05-03', '2028-05-02', '2029-05-02',
    '2030-05-02', '2031-05-02', '2032-05-03', '2033-05-02', '2034-05-02',
    '2035-05-02', '2036-05-02',
  ],
  pay: [
    '2025-05-09', '2026-05-11', '2027-05-10', '2028-05-09', '2029-05-09',
    '2030-05-09', '2031-05-09', '2032-05-10', '2033-05-09', '2034-05-09',
    '2035-05-09', '2036-05-09',
  ],
  description: '12Y Phoenix Bearish EUR CMS 10Y — coupon 7,5 % si ≤ 3,20 %, autocall si ≤ 2,40 %, capital garanti',
  termsheetFichier:
    '240509_12Y_Phoenix Bearish CMS10  Barrières 3.20%-2.40%_Annuel_FRSG00014VA7_SOCGEN.pdf',
})

const dbBearish350 = phoenixBearish({
  isin: 'XS0461619396',
  nom: 'Phoenix Bearish EUR CMS 10Y (3,50 % / 2,50 %)',
  emetteur: 'Deutsche Bank AG',
  notationEmetteur: 'S&P A / Moody’s A1 / Fitch A',
  nominal: 5_000_000,
  freq: 'annuel',
  initial: '2024-04-09',
  emission: '2024-04-25',
  finale: '2031-04-09',
  echeance: '2031-04-25',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 5.4,
  barriereCoupon: 3.5,
  barriereRappel: 2.5,
  inFine: true,
  obs: [
    '2025-04-09', '2026-04-13', '2027-04-12', '2028-04-07', '2029-04-11',
    '2030-04-09', '2031-04-09',
  ],
  pay: [
    '2025-04-25', '2026-04-27', '2027-04-26', '2028-04-25', '2029-04-25',
    '2030-04-25', '2031-04-25',
  ],
  description: '7Y Phoenix Bearish EUR CMS 10Y — coupon 5,4 % si ≤ 3,50 %, autocall si ≤ 2,50 %, capital garanti in fine',
  termsheetFichier:
    '240425_7Y_Phoenix Bearish CMS10  - Barrière 3.50%-2.50%_Annuel_XS0461619396_DB.pdf',
})

const bnpBearish325 = phoenixBearish({
  isin: 'XS2815466193',
  nom: 'Phoenix Bearish EUR CMS 10Y (3,25 % / 2,50 %)',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch A+',
  nominal: 1_000_000,
  freq: 'annuel',
  initial: '2024-07-29',
  emission: '2024-07-31',
  finale: '2034-07-27',
  echeance: '2034-07-31',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 6.5,
  barriereCoupon: 3.25,
  barriereRappel: 2.5,
  obs: [
    '2025-07-29', '2026-07-29', '2027-07-29', '2028-07-27', '2029-07-27',
    '2030-07-29', '2031-07-29', '2032-07-29', '2033-07-28', '2034-07-27',
  ],
  pay: [
    '2025-07-31', '2026-07-31', '2027-08-02', '2028-07-31', '2029-07-31',
    '2030-07-31', '2031-07-31', '2032-08-02', '2033-08-01', '2034-07-31',
  ],
  description: '10Y Phoenix Bearish EUR CMS 10Y — coupon 6,5 % si ≤ 3,25 %, autocall si ≤ 2,50 %, capital garanti',
  termsheetFichier:
    '240731_10Y_Phoenix Bearish CMS10 - Barrière 3.25%-2.50%_Annuel_XS2815466193_BNP.pdf',
})

const sgBearish635 = phoenixBearish({
  isin: 'FRSG00015Y19',
  nom: 'Phoenix Bearish EUR CMS 10Y (6,35 % / 2,10 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 2_000_000,
  freq: 'annuel',
  initial: '2026-03-31',
  emission: '2025-04-09',
  finale: '2037-03-31',
  echeance: '2037-04-09',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 6.35,
  barriereCoupon: 3.25,
  barriereRappel: 2.1,
  inFine: true,
  obs: [
    '2026-03-31', '2027-04-02', '2028-04-03', '2029-03-29', '2030-04-02',
    '2031-04-02', '2032-04-02', '2033-04-04', '2034-03-31', '2035-04-02',
    '2036-04-02', '2037-03-31',
  ],
  pay: [
    '2026-04-09', '2027-04-09', '2028-04-10', '2029-04-09', '2030-04-09',
    '2031-04-09', '2032-04-09', '2033-04-11', '2034-04-11', '2035-04-09',
    '2036-04-09', '2037-04-09',
  ],
  description: '12Y Phoenix Bearish EUR CMS 10Y — coupon 6,35 % si ≤ 3,25 %, autocall si ≤ 2,10 %, capital garanti in fine',
  termsheetFichier:
    '250409_12Y_Phoenix Bearish CMS10 - 6.35% _Annuel_FRSG00015Y19_SOCGEN.pdf',
})

const sgBearishInFine350 = phoenixBearish({
  isin: 'FR001400PCU1',
  nom: 'Phoenix Bearish In Fine EUR CMS 10Y (3,50 % / 2,50 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 1_000_000,
  freq: 'annuel',
  initial: '2025-04-09',
  emission: '2024-04-16',
  finale: '2036-04-07',
  echeance: '2036-04-16',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 6.95,
  barriereCoupon: 3.5,
  barriereRappel: 2.5,
  rappelActif: 3,
  inFine: true,
  obs: [
    '2025-04-09', '2026-04-09', '2027-04-09', '2028-04-07', '2029-04-09',
    '2030-04-09', '2031-04-07', '2032-04-09', '2033-04-08', '2034-04-06',
    '2035-04-09', '2036-04-07',
  ],
  pay: [
    '2025-04-16', '2026-04-16', '2027-04-16', '2028-04-18', '2029-04-16',
    '2030-04-16', '2031-04-16', '2032-04-16', '2033-04-19', '2034-04-17',
    '2035-04-16', '2036-04-16',
  ],
  description: '12Y Phoenix Bearish In Fine EUR CMS 10Y — coupon 6,95 % si ≤ 3,50 %, autocall si ≤ 2,50 % (dès an 3), capital garanti',
  termsheetFichier:
    '240416_12Y_Phoenix Bearish In Fine CMS10  - Barrière 3.50%-2.50%_Annuel_FR001400PCU1_SOCGEN.pdf',
})

const sgGeneraliBearish = phoenixBearish({
  isin: 'FR001400U1I0',
  nom: 'Generali Phoenix Bearish In Fine EUR CMS 10Y (2,80 % / 2,20 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1 / Fitch A',
  nominal: 30_000_000,
  freq: 'semestriel',
  initial: '2025-08-20',
  emission: '2024-11-27',
  finale: '2037-02-20',
  echeance: '2037-02-27',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 3.5,
  couponPa: 7.0,
  barriereCoupon: 2.8,
  barriereRappel: 2.2,
  rappelActif: 2,
  memoire: true,
  inFine: true,
  obs: [
    '2025-08-20', '2026-02-20', '2026-08-20', '2027-02-22', '2027-08-20',
    '2028-02-21', '2028-08-21', '2029-02-20', '2029-08-20', '2030-02-20',
    '2030-08-20', '2031-02-20', '2031-08-20', '2032-02-20', '2032-08-20',
    '2033-02-21', '2033-08-22', '2034-02-20', '2034-08-21', '2035-02-20',
    '2035-08-20', '2036-02-20', '2036-08-20', '2037-02-20',
  ],
  pay: [
    '2026-02-27', '2026-02-27', '2026-08-27', '2027-03-01', '2027-08-27',
    '2028-02-28', '2028-08-28', '2029-02-27', '2029-08-27', '2030-02-27',
    '2030-08-27', '2031-02-27', '2031-08-27', '2032-02-27', '2032-08-27',
    '2033-02-28', '2033-08-29', '2034-02-27', '2034-08-28', '2035-02-27',
    '2035-08-27', '2036-02-27', '2036-08-27', '2037-02-27',
  ],
  description: '12Y Generali Phoenix Bearish In Fine EUR CMS 10Y — coupon 3,5 %/sem. mémoire si ≤ 2,80 %, autocall si ≤ 2,20 %, capital garanti',
  termsheetFichier:
    '241127_12Y_Generali Phoenix Bearish CMS10 (Phoenix In Fine)_Semestriel_FR001400U1I0_SOCGEN.pdf',
})

const bnpOddoBearish = phoenixBearish({
  isin: 'FR001400XNG1',
  nom: 'ODDO Phoenix Bearish In Fine EUR CMS 10Y (2,80 % / 2,00 %)',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  nominal: 1_000_000,
  freq: 'semestriel',
  initial: '2025-11-27',
  emission: '2025-03-07',
  finale: '2037-05-28',
  echeance: '2037-05-30',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 1.5,
  couponPa: 3.0,
  barriereCoupon: 2.8,
  barriereRappel: 2.0,
  rappelActif: 2,
  inFine: true,
  obs: [
    '2025-11-27', '2026-05-28', '2026-11-26', '2027-05-27', '2027-11-26',
    '2028-05-26', '2028-11-28', '2029-05-28', '2029-11-28', '2030-05-28',
    '2030-11-28', '2031-05-28', '2031-11-27', '2032-05-27', '2032-11-26',
    '2033-05-26', '2033-11-28', '2034-05-26', '2034-11-28', '2035-05-28',
    '2035-11-28', '2036-05-28', '2036-11-27', '2037-05-28',
  ],
  pay: [
    '2026-05-28', '2026-05-28', '2026-11-26', '2027-05-27', '2027-11-26',
    '2028-05-26', '2028-11-28', '2029-05-28', '2029-11-28', '2030-05-28',
    '2030-11-28', '2031-05-28', '2031-11-27', '2032-05-27', '2032-11-26',
    '2033-05-26', '2033-11-28', '2034-05-26', '2034-11-28', '2035-05-28',
    '2035-11-28', '2036-05-28', '2036-11-27', '2037-05-30',
  ],
  description: '12Y ODDO Phoenix Bearish In Fine EUR CMS 10Y — coupon 3 % p.a. si ≤ 2,80 %, autocall si ≤ 2,00 %, capital garanti',
  termsheetFichier:
    '250307_12Y_ODDO CMS 10Y Phoenix In Fine_Semestriel_FR001400XNG1_BNP.pdf',
})

const bnpBearishTrim = phoenixBearish({
  isin: 'XS3073984430',
  nom: 'Phoenix Bearish EUR CMS 10Y trimestriel (2,90 % / 2,50 %, 8 %)',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  nominal: 1_000_000,
  freq: 'trimestriel',
  initial: '2026-01-29',
  emission: '2025-08-07',
  finale: '2037-10-29',
  echeance: '2037-11-02',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 2.0,
  couponPa: 8.0,
  barriereCoupon: 2.9,
  barriereRappel: 2.5,
  rappelActif: 4,
  inFine: true,
  obs: [
    '2026-01-29', '2026-04-28', '2026-07-29', '2026-10-29', '2027-01-28',
    '2027-04-28', '2027-07-29', '2027-10-28', '2028-01-27', '2028-04-27',
    '2028-07-27', '2028-10-27', '2029-01-29', '2029-04-26', '2029-07-27',
    '2029-10-29', '2030-01-29', '2030-04-26', '2030-07-29', '2030-10-29',
    '2031-01-29', '2031-04-28', '2031-07-29', '2031-10-29', '2032-01-29',
    '2032-04-28', '2032-07-29', '2032-10-28', '2033-01-27', '2033-04-28',
    '2033-07-28', '2033-10-27', '2034-01-27', '2034-04-27', '2034-07-27',
    '2034-10-27', '2035-01-29', '2035-04-26', '2035-07-27', '2035-10-29',
    '2036-01-29', '2036-04-28', '2036-07-29', '2036-10-29', '2037-01-29',
    '2037-04-28', '2037-07-29', '2037-10-29',
  ],
  pay: [
    '2026-02-02', '2026-04-30', '2026-07-31', '2026-11-02', '2027-02-01',
    '2027-04-30', '2027-08-02', '2027-11-01', '2028-01-31', '2028-05-02',
    '2028-07-31', '2028-10-31', '2029-01-31', '2029-04-30', '2029-07-31',
    '2029-10-31', '2030-01-31', '2030-04-30', '2030-07-31', '2030-10-31',
    '2031-01-31', '2031-04-30', '2031-07-31', '2031-10-31', '2032-02-02',
    '2032-04-30', '2032-08-02', '2032-11-01', '2033-01-31', '2033-05-02',
    '2033-08-01', '2033-10-31', '2034-01-31', '2034-05-02', '2034-07-31',
    '2034-10-31', '2035-01-31', '2035-04-30', '2035-07-31', '2035-10-31',
    '2036-01-31', '2036-04-30', '2036-07-31', '2036-10-31', '2037-02-02',
    '2037-04-30', '2037-07-31', '2037-11-02',
  ],
  description: '12Y Phoenix Bearish EUR CMS 10Y trimestriel — coupon 2 %/trim. (8 % p.a.) si ≤ 2,90 %, autocall si ≤ 2,50 % (dès an 1), capital garanti',
  termsheetFichier:
    '250807_12Y_Phoenix Bearish  CMS10 Trimestriel 2.52.9 - 8%_Trimestriel_XS3073984430_BNP.PDF',
})

// ── XS3148555405 — BBVA Phoenix Mémoire BNP + Crédit Agricole + Intesa ───────
const baiObs = [
  '2026-02-06', '2026-05-06', '2026-08-06', '2026-11-06', '2027-02-08',
  '2027-05-06', '2027-08-06', '2027-11-08', '2028-02-07', '2028-05-08',
  '2028-08-07', '2028-11-06', '2029-02-06', '2029-05-07', '2029-08-06',
  '2029-11-06', '2030-02-06', '2030-05-06', '2030-08-06', '2030-11-06',
]
const baiPay = [
  '2026-02-13', '2026-05-13', '2026-08-13', '2026-11-13', '2027-02-15',
  '2027-05-13', '2027-08-13', '2027-11-15', '2028-02-14', '2028-05-15',
  '2028-08-14', '2028-11-13', '2029-02-13', '2029-05-14', '2029-08-13',
  '2029-11-13', '2030-02-13', '2030-05-13', '2030-08-13', '2030-11-13',
]
// Autocall dégressif 100%→70% (-2,5%/trim. puis plancher 70%) ; non-call n=1-2 ; n=20 = maturité.
const baiAer: (number | undefined)[] = [
  undefined, undefined, 100, 97.5, 95, 92.5, 90, 87.5, 85, 82.5, 80, 77.5,
  75, 72.5, 70, 70, 70, 70, 70, undefined,
]
const bbvaBnpAcaIntesa: Product = {
  id: 'XS3148555405',
  nom: 'Phoenix Mémoire BNP + Crédit Agricole + Intesa Sanpaolo',
  isin: 'XS3148555405',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria, S.A.',
  notationEmetteur: 'S&P A+ / Moody’s A2',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 430_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-10-06',
  dateEmission: '2025-11-06',
  dateConstatationFinale: '2030-11-06',
  dateEcheance: '2030-11-13',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'BNP Paribas SA', bloomberg: 'BNP FP', isin: 'FR0000131104', marche: 'Euronext Paris' },
    { nom: 'Crédit Agricole SA', bloomberg: 'ACA FP', isin: 'FR0000045072', marche: 'Euronext Paris' },
    { nom: 'Intesa Sanpaolo S.p.A.', bloomberg: 'ISP IM', isin: 'IT0000072618', marche: 'Borsa Italiana' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.0,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 55,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(baiObs, baiPay, {
    niveauRappelPct: (n) => baiAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.25,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 3,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof BNP + Crédit Agricole + Intesa Sanpaolo',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '251106_5Y_Phoenix Memory Wof BNP + Credit Agricole + Intesa_Trimestriel_XS3148555405_BBVA.pdf',
}

// ── Helper : CLN tranche d'indice iTraxx (capital à risque sur défauts) ───────
function creditCLN(p: {
  isin: string
  nom: string
  emetteur: string
  garant?: string
  notationEmetteur?: string
  nominal: number
  freq: Product['frequence']
  emission: string
  echeance: string
  index: string
  nbEntites: number
  attach: number
  detach: number
  couponPct: number
  zeroRecovery?: boolean
  couponGaranti?: boolean
  prixEmissionPct?: number
  inFine?: boolean
  nbDefautsBuffer?: number
  nbDefautsWipe?: number
  couponDates: string[]
  description: string
  termsheetFichier: string
}): Product {
  const levier = Math.round((1 / ((p.detach - p.attach) / 100)) * 100) / 100
  return {
    id: p.isin,
    nom: p.nom,
    isin: p.isin,
    emetteur: p.emetteur,
    garant: p.garant,
    notationEmetteur: p.notationEmetteur,
    assetClass: 'credit',
    family: 'credit_linked',
    devise: 'EUR',
    nominal: p.nominal,
    valeurNominale: 1000,
    prixEmission: p.prixEmissionPct ?? 100,
    dateConstatationInitiale: p.emission,
    dateEmission: p.emission,
    dateConstatationFinale: p.echeance,
    dateEcheance: p.echeance,
    frequence: p.freq,
    basket: 'single',
    sousJacents: [{ nom: p.index, marche: 'Crédit' }],
    terms: {
      kind: 'credit',
      type: 'tranche',
      indexReference: p.index,
      nbEntites: p.nbEntites,
      attachementPct: p.attach,
      detachementPct: p.detach,
      zeroRecovery: p.zeroRecovery ?? false,
      recouvrementPct: p.zeroRecovery ? 0 : undefined,
      levier,
      nbDefautsBuffer: p.nbDefautsBuffer,
      nbDefautsWipe: p.nbDefautsWipe,
      couponPct: p.couponPct,
      couponPa: p.couponPct,
      couponGaranti: p.couponGaranti,
      prixEmissionPct: p.prixEmissionPct,
      inFine: p.inFine,
      protectionCapital: false,
    },
    observations: buildObservations(p.couponDates, p.couponDates, {
      montantRemboursementPct: 100,
      couponPct: p.couponPct,
    }),
    rr: 'LS',
    productType: 'CLN tranche',
    description: p.description,
    badges: ['Crédit', `Tranche ${p.attach}-${p.detach}%`, p.zeroRecovery ? 'Zero recovery' : 'Recouvrement'],
    termsheetFichier: p.termsheetFichier,
  }
}

const bnpClnCrossover = creditCLN({
  isin: 'XS2975786000',
  nom: 'ZC CLN Tranche Crossover (iTraxx XO S42)',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  nominal: 910_000,
  freq: 'annuel',
  emission: '2025-03-17',
  echeance: '2028-01-06',
  index: 'iTraxx Europe Crossover Série 42',
  nbEntites: 75,
  attach: 1.333,
  detach: 13.333,
  couponPct: 0.3,
  zeroRecovery: true,
  couponGaranti: true,
  prixEmissionPct: 53.6,
  inFine: true,
  nbDefautsBuffer: 1,
  nbDefautsWipe: 10,
  couponDates: ['2026-01-06', '2027-01-06', '2028-01-06'],
  description: '3Y CLN tranche Crossover (iTraxx XO S42, 1,333 %–13,333 %), zero recovery, ZC à 53,6 %, capital à risque',
  termsheetFichier: '250317_3Y_ZC CLN Tranche Crossover_in fine_XS2975786000_BNP.pdf',
})

const sgClnMain = creditCLN({
  isin: 'XS2059726096',
  nom: 'CLN Main Tranche 2,4–6,4 % (iTraxx Main)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 500_000,
  freq: 'annuel',
  emission: '2020-01-13',
  echeance: '2027-01-11',
  index: 'iTraxx Europe Main',
  nbEntites: 125,
  attach: 2.4,
  detach: 6.4,
  couponPct: 4.1,
  zeroRecovery: true,
  couponDates: [
    '2021-01-11', '2022-01-10', '2023-01-10', '2024-01-10', '2025-01-10',
    '2026-01-12', '2027-01-11',
  ],
  nbDefautsBuffer: 3,
  nbDefautsWipe: 8,
  description: '7Y CLN tranche iTraxx Main (2,4 %–6,4 %, levier ×25), coupon 4,10 %, zero recovery, capital à risque',
  termsheetFichier: '200113_7Y_CLN Main Tranche 4-8 - 4.10% p.a _Annuel_XS2059726096_SOCGEN.pdf',
})

const bbvaClnZeroRecovery = creditCLN({
  isin: 'XS2641318121',
  nom: 'Tranched CLN Zero Recovery (iTraxx S40)',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria, S.A.',
  notationEmetteur: 'S&P A / Moody’s A3',
  nominal: 1_000_000,
  freq: 'annuel',
  emission: '2024-02-12',
  echeance: '2031-01-09',
  index: 'iTraxx Europe Série 40',
  nbEntites: 125,
  attach: 2.4,
  detach: 5.6,
  couponPct: 6.85,
  zeroRecovery: true,
  nbDefautsBuffer: 3,
  nbDefautsWipe: 7,
  couponDates: [
    '2025-01-09', '2026-01-09', '2027-01-09', '2028-01-09', '2029-01-09',
    '2030-01-09', '2031-01-09',
  ],
  description: '7Y CLN tranche iTraxx S40 (2,4 %–5,6 %, levier ×31,25), coupon 6,85 %, zero recovery, capital à risque',
  termsheetFichier:
    '240212_7Y_Tranched CLN Zero Recovery Credit Linked Notes due 2031_Annuel_ XS2641318121_BBVA.pdf',
})

// ── XS2442403130 — BNP TARN CMS 30Y − CMS 2Y (steepener, capital garanti) ────
const tarnDates = [
  '2023-02-27', '2023-05-25', '2023-08-25', '2023-11-27', '2024-02-26',
  '2024-05-27', '2024-08-26', '2024-11-25', '2025-02-25', '2025-05-26',
  '2025-08-25', '2025-11-25', '2026-02-25', '2026-05-25', '2026-08-25',
  '2026-11-25', '2027-02-25', '2027-05-25', '2027-08-25', '2027-11-25',
  '2028-02-25', '2028-05-25', '2028-08-25', '2028-11-27', '2029-02-26',
  '2029-05-25', '2029-08-27', '2029-11-26', '2030-02-25', '2030-05-27',
  '2030-08-26', '2030-11-25', '2031-02-25', '2031-05-26', '2031-08-25',
  '2031-11-25', '2032-02-25', '2032-05-25', '2032-08-25', '2032-11-25',
  '2033-02-25', '2033-05-25', '2033-08-25', '2033-11-25', '2034-02-27',
  '2034-05-25', '2034-08-25', '2034-11-27',
]
const bnpTarn: Product = {
  id: 'XS2442403130',
  nom: 'TARN CMS 30Y − CMS 2Y',
  isin: 'XS2442403130',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'rates',
  family: 'rates_structured',
  devise: 'EUR',
  nominal: 600_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2022-11-25',
  dateEmission: '2022-11-25',
  dateConstatationFinale: '2034-11-23',
  dateEcheance: '2034-11-25',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [{ nom: 'EUR CMS 30Y − EUR CMS 2Y', marche: 'Taux' }],
  terms: {
    kind: 'rates',
    type: 'tarn',
    tauxReference: 'EUR CMS 30Y',
    tauxReference2: 'EUR CMS 2Y',
    multiplicateur: 2,
    floorPct: 0,
    couponGarantiPct: 7.25,
    cibleTarnPct: 15.5,
    capitalGaranti: true,
  },
  observations: buildObservations(tarnDates, tarnDates, { montantRemboursementPct: 100 }),
  rr: 'LS',
  productType: 'TARN',
  description: '12Y TARN steepener — 8 coupons fixes 7,25 % puis 200 % × (CMS 30Y − CMS 2Y) planché à 0 %, cible 15,5 %, capital garanti',
  badges: ['Taux', 'Steepener', 'TARN', 'Capital garanti'],
  termsheetFichier: 'TERMSHEET-CE5643YFR (XS2442403130).pdf',
}

// ── FR001400T357 — SG Bear Athena USD SOFR CMS 10Y (capital garanti) ─────────
const sofrObs = [
  '2025-10-06', '2026-10-06', '2027-10-06', '2028-10-06', '2029-10-05',
  '2030-10-07', '2031-10-06',
]
const sofrPay = [
  '2025-10-14', '2026-10-14', '2027-10-14', '2028-10-16', '2029-10-15',
  '2030-10-15', '2031-10-14',
]
// Athena bearish : rappel si SOFR CMS 10Y ≤ 2,80% (années 1-6) ; n=7 = maturité.
const sofrRappel: (number | undefined)[] = [2.8, 2.8, 2.8, 2.8, 2.8, 2.8, undefined]
const sofrErv = [109, 118, 127, 136, 145, 154, 163]
const sgBearAthenaSofr: Product = {
  id: 'FR001400T357',
  nom: 'Bear Athena USD SOFR CMS 10Y',
  isin: 'FR001400T357',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  assetClass: 'rates',
  family: 'rates_structured',
  devise: 'USD',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-09-30',
  dateEmission: '2024-10-14',
  dateConstatationFinale: '2031-10-06',
  dateEcheance: '2031-10-14',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [{ nom: 'USD SOFR CMS 10Y', bloomberg: 'USISS010 Index', marche: 'Taux' }],
  terms: {
    kind: 'rates',
    type: 'phoenix_taux',
    sens: 'bearish',
    tauxReference: 'USD SOFR CMS 10Y',
    couponConditionnelPa: 9,
    barriereRappelTauxPct: 2.8,
    capitalGaranti: true,
    inFine: true,
  },
  observations: buildObservations(sofrObs, sofrPay, {
    niveauRappelPct: (n) => sofrRappel[n - 1],
    montantRemboursementPct: (n) => sofrErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena Taux',
  description: '7Y Bear Athena USD SOFR CMS 10Y — rappel si ≤ 2,80 % (prime 109→154 %), 163 % à maturité si ≤ 2,80 %, capital garanti',
  badges: ['Taux', 'Bearish SOFR', 'Capital garanti', 'Athena'],
  termsheetFichier: '241014_7Y_Bear Athena SOFR CMS10_Annuel_FR001400T357_SOCGEN.pdf',
}

// ── XS2769351359 — GS Phoenix Mémoire Kering (single, 10Y annuel) ────────────
const kerSObs = [
  '2025-07-15', '2026-07-15', '2027-07-15', '2028-07-17', '2029-07-16',
  '2030-07-15', '2031-07-15', '2032-07-15', '2033-07-15', '2034-07-17',
]
const kerSPay = [
  '2025-07-22', '2026-07-22', '2027-07-22', '2028-07-24', '2029-07-23',
  '2030-07-22', '2031-07-22', '2032-07-22', '2033-07-24', '2034-07-24',
]
const kerSAer: (number | undefined)[] = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, undefined,
]
const gsKering: Product = {
  id: 'XS2769351359',
  nom: 'Phoenix Mémoire Kering',
  isin: 'XS2769351359',
  emetteur: 'Goldman Sachs International',
  garant: 'The Goldman Sachs Group, Inc.',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-07-15',
  dateEmission: '2024-07-15',
  dateConstatationFinale: '2034-07-17',
  dateEcheance: '2034-07-17',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [
    { nom: 'Kering SA', bloomberg: 'KER FP', isin: 'FR0000121485', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 7.0,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(kerSObs, kerSPay, {
    niveauRappelPct: (n) => kerSAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 7,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '10Y Phoenix Mémoire Kering — coupon 7 %/an si ≥ 70 %, autocall 100 %, KI 50 % européen',
  badges: ['Single', 'Effet mémoire'],
  termsheetFichier: '240715_10Y_Phoenix Memory Kering 7% _Annuel_XS2769351359_GS.pdf',
}

// ── FR0013446333 — SG ODDO Snowball Unibail-Rodamco-Westfield (10Y annuel) ───
const urwObs = [
  '2020-12-28', '2021-12-27', '2022-12-27', '2023-12-27', '2024-12-27',
  '2025-12-29', '2026-12-28', '2027-12-27', '2028-12-27', '2029-12-27',
]
const urwPay = [
  '2021-01-05', '2022-01-03', '2023-01-03', '2024-01-04', '2025-01-06',
  '2026-01-06', '2027-01-05', '2028-01-03', '2029-01-04', '2030-01-04',
]
// Autocall dégressif 90%→66% (-3%/an) ; n=10 = maturité.
const urwAer: (number | undefined)[] = [90, 87, 84, 81, 78, 75, 72, 69, 66, undefined]
// Prime de rappel snowball 110%→200% (+10%/an).
const urwErv = [110, 120, 130, 140, 150, 160, 170, 180, 190, 200]
const sgUnibailSnowball: Product = {
  id: 'FR0013446333',
  nom: 'Snowball Unibail-Rodamco-Westfield',
  isin: 'FR0013446333',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2019-12-27',
  dateEmission: '2019-12-27',
  dateConstatationFinale: '2029-12-27',
  dateEcheance: '2030-01-04',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [
    { nom: 'Unibail-Rodamco-Westfield', bloomberg: 'URW NA', isin: 'FR0013326246', marche: 'Euronext Amsterdam' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.0,
    barriereRappelPct: 90,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    bonusFinalPct: 100,
  },
  observations: buildObservations(urwObs, urwPay, {
    niveauRappelPct: (n) => urwAer[n - 1],
    montantRemboursementPct: (n) => urwErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Snowball',
  description: '10Y Snowball Unibail — prime croissante 110→200 %, autocall dégressif 90→66 %, KI 50 % européen',
  badges: ['Single', 'Snowball', 'Dégressif', 'Bonus'],
  termsheetFichier: '190926_10Y_ODDO Unibail Rodamco_Annuel_FR0013446333_SOCGEN.pdf',
}

// ════════════════════════════════════════════════════════════════════════
//  Fournée 2026-06 — produits LIVE encore vides.
//  • 3 décodés finement (termsheet exécutée trouvée sur OneDrive).
//  • 8 « identité seule » : métadonnées fiables du reporting mensuel, sans la
//    mécanique (barrières/coupon/calendrier) faute de termsheet en base.
//    Badge « TS à fournir » ⇒ à compléter dès réception de la termsheet.
// ════════════════════════════════════════════════════════════════════════

// ── XS3292036624 — Santander Phoenix Mémoire Engie + Veolia + Schneider ──────
const engObs = [
  '2026-09-10', '2026-12-10', '2027-03-10', '2027-06-10', '2027-09-10',
  '2027-12-10', '2028-03-10', '2028-06-12', '2028-09-11', '2028-12-11',
  '2029-03-12', '2029-06-11', '2029-09-10', '2029-12-10', '2030-03-11',
  '2030-06-10', '2030-09-10', '2030-12-10', '2031-03-10', '2031-06-10',
]
const engPay = [
  '2026-09-24', '2026-12-24', '2027-03-24', '2027-06-24', '2027-09-24',
  '2027-12-24', '2028-03-24', '2028-06-26', '2028-09-25', '2028-12-27',
  '2029-03-26', '2029-06-25', '2029-09-24', '2029-12-24', '2030-03-25',
  '2030-06-24', '2030-09-24', '2030-12-24', '2031-03-24', '2031-06-24',
]
// Non-call obs 1-2 (coupon seul) ; autocall dégressif 100→70 % de obs 3 à 19 ;
// obs 20 = maturité (pas d'AER).
const engAer: (number | undefined)[] = [
  undefined, undefined, 100, 98, 96, 94, 92, 90, 88, 86, 84, 82, 80, 78, 76,
  74, 72, 70, 70, undefined,
]
const santanderEngieVeoliaSchneider: Product = {
  id: 'XS3292036624',
  nom: 'Phoenix Mémoire Engie + Veolia + Schneider',
  isin: 'XS3292036624',
  emetteur: 'Santander International Products plc',
  garant: 'Banco Santander S.A.',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-04-29', // strike = plus bas clôture sur la période 29/04→10/06
  dateEmission: '2026-06-10',
  dateConstatationFinale: '2031-06-10',
  dateEcheance: '2031-06-24',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Engie SA', bloomberg: 'ENGI FP', isin: 'FR0010208488', marche: 'Euronext Paris' },
    { nom: 'Veolia Environnement', bloomberg: 'VIE FP', isin: 'FR0000124141', marche: 'Euronext Paris' },
    { nom: 'Schneider Electric SE', bloomberg: 'SU FP', isin: 'FR0000121972', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    lookback: true,
    couponPa: 9.4,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(engObs, engPay, {
    niveauRappelPct: (n) => engAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.35,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 3,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description:
    '5Y Phoenix Mémoire Wof — Engie + Veolia + Schneider, autocall dégressif 100→70 %, coupon 9,40 % p.a. (barrière 70 %), KI 50 % européen',
  badges: ['Worst-of', 'Effet mémoire', 'Dégressif'],
}

// ── XS3191958233 — BNP Athena Booster Wof SX5E + NKY + SPX (snowball 6,85 %) ──
const athbObs = ['2026-11-20', '2027-11-22', '2028-11-20', '2029-11-20', '2030-11-20']
const athbPay = ['2026-12-04', '2027-12-06', '2028-12-04', '2029-12-04', '2030-12-04']
const bnpAthenaBoosterIndices: Product = {
  id: 'XS3191958233',
  nom: 'Athena Booster Wof EuroStoxx 50 + Nikkei 225 + S&P 500',
  isin: 'XS3191958233',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-11-19',
  dateEmission: '2025-12-03',
  dateConstatationFinale: '2030-11-20',
  dateEcheance: '2030-12-04',
  frequence: 'annuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'EURO STOXX 50', bloomberg: 'SX5E Index', niveauInitial: 5542.05 },
    { nom: 'Nikkei 225', bloomberg: 'NKY Index', niveauInitial: 49823.94 },
    { nom: 'S&P 500', bloomberg: 'SPX Index', niveauInitial: 6642.16 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 6.85,
    barriereRappelPct: 100,
    protectionPct: 55,
    protectionStyle: 'europeenne',
    bonusFinalPct: 134.25, // maturité : 100 % + booster mini 34,25 % si Wof ≥ initial
  },
  observations: buildObservations(athbObs, athbPay, {
    niveauRappelPct: (n) => (n <= 4 ? 100 : undefined),
    montantRemboursementPct: (n) => (n <= 4 ? Math.round((100 + 6.85 * n) * 100) / 100 : undefined),
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description:
    '5Y Athena Booster Wof — EuroStoxx 50 + Nikkei 225 + S&P 500, snowball 6,85 %×n, autocall 100 %, KI 55 % européen',
  badges: ['Worst-of', 'Snowball', 'Booster'],
}

// ── XS3214893623 — BNP Callable Booster CSI Smallcap 500 (call émetteur, 90 %) ─
const csiObs = [
  '2026-06-11', '2026-09-11', '2026-12-11', '2027-03-11', '2027-06-11',
  '2027-09-13', '2027-12-13', '2028-03-13', '2028-06-12', '2028-09-11',
]
const csiPay = [
  '2026-06-25', '2026-09-25', '2026-12-28', '2027-03-25', '2027-06-25',
  '2027-09-27', '2027-12-27', '2028-03-27', '2028-06-26', '2028-09-25',
]
// Call à la main de l'émetteur : remboursement boosté 108→144 % (pas de coupon).
const csiBooster = [108, 112, 116, 120, 124, 128, 132, 136, 140, 144]
const bnpCallableCsi500: Product = {
  id: 'XS3214893623',
  nom: 'Callable Booster CSI Smallcap 500 (protection 90 %)',
  isin: 'XS3214893623',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  assetClass: 'equity',
  family: 'participation',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-12-11',
  dateEmission: '2025-12-29',
  dateConstatationFinale: '2028-12-11',
  dateEcheance: '2028-12-27',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'CSI Smallcap 500 Index', bloomberg: 'SH000905 Index', marche: 'Shanghai', niveauInitial: 7082.8932 },
  ],
  pdiPct: 90,
  pdiText: '90 % (européenne)',
  observations: buildObservations(csiObs, csiPay, {
    montantRemboursementPct: (n) => csiBooster[n - 1],
  }),
  rr: 'LS',
  productType: 'Callable Booster',
  description:
    '3Y Callable émetteur — CSI Smallcap 500, booster 108→144 % sur call, protection 90 % européenne, participation 100 % à maturité',
  badges: ['Single', 'Callable', '90 % protégé', 'Booster'],
  termsheetFichier: 'TS Call 90_ KG China - XS3214893623.PDF',
}

// ── FRIP00001NZ9 — Morgan Stanley Autocall croissant décrément MXEADT50 ───────
// Autocall dégressif sans coupon : le montant de remboursement croît de +2,60 %
// par observation (110,40 %→201,40 %) ; barrière dégressive 100→73,75 % ; non-call
// la 1re année (obs marchés 1-3) ; autocall possible à partir de l'obs n°4.
const frinObs = [
  '2026-07-24', '2026-10-26', '2027-01-25', '2027-04-26', '2027-07-26', '2027-10-25',
  '2028-01-24', '2028-04-24', '2028-07-24', '2028-10-24', '2029-01-24', '2029-04-24',
  '2029-07-24', '2029-10-24', '2030-01-24', '2030-04-24', '2030-07-24', '2030-10-24',
  '2031-01-24', '2031-04-24', '2031-07-24', '2031-10-24', '2032-01-26', '2032-04-26',
  '2032-07-26', '2032-10-25', '2033-01-24', '2033-04-25', '2033-07-25', '2033-10-24',
  '2034-01-24', '2034-04-24', '2034-07-24', '2034-10-24', '2035-01-24', '2035-04-24',
]
const frinPay = [
  '2026-07-31', '2026-11-02', '2027-02-01', '2027-05-03', '2027-08-02', '2027-11-01',
  '2028-01-31', '2028-05-02', '2028-07-31', '2028-10-31', '2029-01-31', '2029-05-02',
  '2029-07-31', '2029-10-31', '2030-01-31', '2030-05-02', '2030-07-31', '2030-10-31',
  '2031-01-31', '2031-05-02', '2031-07-31', '2031-10-31', '2032-02-02', '2032-05-03',
  '2032-08-02', '2032-11-01', '2033-01-31', '2033-05-02', '2033-08-01', '2033-10-31',
  '2034-01-31', '2034-05-02', '2034-07-31', '2034-10-31', '2035-01-31', '2035-05-02',
]
const frinAer = Array.from({ length: 36 }, (_, i) => Math.round((100 - 0.75 * i) * 100) / 100)
const frinErv = Array.from({ length: 36 }, (_, i) => Math.round((110.4 + 2.6 * i) * 100) / 100)
const msMxeadt50: Product = {
  id: 'FRIP00001NZ9',
  nom: 'Autocall croissant — MSCI Europe Aerospace & Defense décrément',
  isin: 'FRIP00001NZ9',
  emetteur: 'Morgan Stanley & Co. International plc',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-07-24',
  dateEmission: '2025-08-14',
  dateConstatationFinale: '2035-07-24',
  dateEcheance: '2035-07-31',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    {
      nom: 'MSCI Europe Aerospace & Defense Top 10 Select 50 Points Decrement EUR',
      bloomberg: 'MXEADT50 Index',
    },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: true,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    decrement: '50 pts/an',
    bonusFinalPct: 204,
  },
  observations: buildObservations(frinObs, frinPay, {
    niveauRappelPct: (n) => frinAer[n - 1],
    montantRemboursementPct: (n) => frinErv[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall croissant',
  description:
    '10Y Autocall croissant sur indice décrément Défense Europe — sans coupon, remboursement 110,4→201,4 %, barrière dégressive 100→73,75 %, KI 50 % européen, prime finale 204 % si ≥ 73 %',
  badges: ['Single', 'Décrément', 'Dégressif', 'Sans coupon'],
}

// ── XS2482711673 — Goldman Sachs CLN single-name SG Subordonnée 4,60 % ────────
const gsClnSgSub: Product = {
  id: 'XS2482711673',
  nom: 'CLN Société Générale subordonnée 4,60 %',
  isin: 'XS2482711673',
  emetteur: 'Goldman Sachs Finance Corp International',
  garant: 'The Goldman Sachs Group, Inc.',
  assetClass: 'credit',
  family: 'credit_linked',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2023-06-16',
  dateEmission: '2023-06-16',
  dateConstatationFinale: '2026-06-20',
  dateEcheance: '2026-06-20',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [{ nom: 'Société Générale SA — dette subordonnée (entité de référence)' }],
  terms: {
    kind: 'credit',
    type: 'single_name',
    entitesReference: ['Société Générale SA (subordonnée)'],
    nbEntites: 1,
    couponPct: 4.6,
    couponPa: 4.6,
    couponGaranti: false,
    zeroRecovery: false,
    nbDefautsWipe: 1,
    prixEmissionPct: 100,
    inFine: true,
    protectionCapital: false,
  },
  rr: 'LS',
  productType: 'CLN',
  description:
    '3Y CLN single-name sur SG subordonnée — coupon 4,60 % p.a. annuel, capital au pair sauf événement de crédit (recouvrement par enchère)',
  badges: ['Crédit', 'Single name', 'Coupon fixe'],
}

// ── CH0593640243 — EFG Participation Airbag worst-of fonds Chine ──────────────
const efgChinaParticipation: Product = {
  id: 'CH0593640243',
  nom: 'Participation Airbag fonds Chine (BNPP + BlackRock + Invesco)',
  isin: 'CH0593640243',
  emetteur: 'EFG International Finance (Guernsey) Ltd.',
  garant: 'EFG International AG',
  assetClass: 'equity',
  family: 'participation',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2021-02-16',
  dateEmission: '2021-02-22',
  dateConstatationFinale: '2027-05-17',
  dateEcheance: '2027-05-24',
  frequence: 'in_fine',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'BNP Paribas China Equity Fund', bloomberg: 'FORECEC LX', niveauInitial: 230.05 },
    { nom: 'BlackRock GF China Fund', bloomberg: 'BGCHA2E LX', niveauInitial: 29.01 },
    { nom: 'Invesco Greater China Equity Fund', bloomberg: 'IGCAIAD LX', niveauInitial: 23.64 },
  ],
  pdiPct: 80,
  pdiText: '80 % (airbag ×1,25)',
  rr: 'LS',
  productType: 'Participation (Airbag)',
  description:
    '6Y Participation worst-of fonds Chine — airbag 80 %, participation 70 % à la hausse, in fine (filename « Autocall » trompeur : pas d’autocall ni coupon)',
  badges: ['Worst-of', 'Airbag 80 %', 'Participation 70 %'],
}

// ── CH0587314615 — EFG Call Warrant sur indice Leonteq European Senior Loans ──
const efgWarrantSeniorLoans: Product = {
  id: 'CH0587314615',
  nom: 'Call Warrant — Leonteq European Senior Loans 3%RC',
  isin: 'CH0587314615',
  emetteur: 'EFG International Finance (Guernsey) Ltd.',
  garant: 'EFG International AG',
  assetClass: 'equity',
  family: 'other',
  devise: 'EUR',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 5.64,
  dateConstatationInitiale: '2024-03-11',
  dateEmission: '2024-03-18',
  dateConstatationFinale: '2027-03-11',
  dateEcheance: '2027-03-18',
  frequence: 'in_fine',
  basket: 'single',
  sousJacents: [
    { nom: 'Leonteq European Senior Loans Fund 3%RC Index', bloomberg: 'LEONIES3 Index' },
  ],
  rr: 'LS',
  productType: 'Warrant Call',
  description:
    '3Y Call Warrant ATM (strike 100 %) sur indice Leonteq European Senior Loans 3%RC — participation 100 % au-dessus du strike, SANS protection (perte totale possible)',
  badges: ['Warrant', 'Sans protection'],
}

// ── XS2803802532 — CIBC Participation capital protégé S&P 500 (CERTI+ Low 75) ─
const cibcParticipationSpx: Product = {
  id: 'XS2803802532',
  nom: 'Participation capital protégé S&P 500 (CERTI+ Low Strike 75)',
  isin: 'XS2803802532',
  emetteur: 'Canadian Imperial Bank of Commerce',
  notationEmetteur: 'Aa2 / A+ / AA',
  assetClass: 'equity',
  family: 'participation',
  devise: 'USD',
  nominal: 0,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-04-09',
  dateEmission: '2024-04-23',
  dateConstatationFinale: '2026-04-09',
  dateEcheance: '2026-04-23',
  frequence: 'in_fine',
  basket: 'single',
  sousJacents: [
    {
      nom: 'S&P 500 Futures Excess Return Index',
      bloomberg: 'SPXFP Index',
      niveauInitial: 455.43,
      devise: 'USD',
    },
  ],
  pdiPct: 75,
  pdiText: '75 % (capital protégé, airbag ×1,33)',
  rr: 'LS',
  productType: 'Participation (capital protégé)',
  description:
    '2Y Participation capital protégé S&P 500 Futures ER — 100 % rendu jusqu’à −25 %, participation 132,5 % à la hausse, airbag sous 75 %, in fine',
  badges: ['Single', 'Capital protégé', 'Participation 132,5 %'],
}

// ── Produits « identité seule » (reporting mensuel, termsheet à fournir) ──────
function addAnnees(d: string, y: number): string {
  const dt = new Date(d)
  dt.setFullYear(dt.getFullYear() + y)
  return dt.toISOString().slice(0, 10)
}
function metaProduct(p: {
  isin: string
  nom: string
  emetteur: string
  productType: string
  dateEmission: string
  dureeAnnees: number
  assetClass?: AssetClass
  family?: ProductFamily
  devise?: string
  frequence?: Frequency
  basket?: BasketType
  sousJacents?: Underlying[]
  terms?: Product['terms']
  pdiPct?: number
  pdiText?: string
  couponPaPct?: number
  barriereAutocall?: string
  barriereCoupon?: string
  description?: string
  badges?: string[]
}): Product {
  return {
    id: p.isin,
    nom: p.nom,
    isin: p.isin,
    emetteur: p.emetteur,
    assetClass: p.assetClass ?? 'equity',
    family: p.family ?? 'autocall',
    devise: p.devise ?? 'EUR',
    nominal: 0,
    dateConstatationInitiale: p.dateEmission, // approx (strike ≈ émission) — à préciser
    dateEmission: p.dateEmission,
    dateConstatationFinale: addAnnees(p.dateEmission, p.dureeAnnees),
    dateEcheance: addAnnees(p.dateEmission, p.dureeAnnees),
    frequence: p.frequence ?? 'autre',
    basket: p.basket ?? 'single',
    sousJacents: p.sousJacents ?? [],
    terms: p.terms,
    pdiPct: p.pdiPct,
    pdiText: p.pdiText,
    couponPaPct: p.couponPaPct,
    barriereAutocall: p.barriereAutocall,
    barriereCoupon: p.barriereCoupon,
    rr: 'LS',
    productType: p.productType,
    description: p.description ?? p.nom,
    badges: p.badges ?? ['TS à fournir'],
  }
}

const metaProducts: Product[] = [
  metaProduct({
    isin: 'XS3251223155',
    nom: 'Callable 90 % sur CSI Smallcap 500',
    emetteur: 'BNP Paribas',
    productType: 'Callable (capital protégé 90 %)',
    family: 'participation',
    dateEmission: '2026-02-06',
    dureeAnnees: 3,
    frequence: 'trimestriel',
    basket: 'single',
    pdiPct: 90,
    pdiText: '90 % (européenne)',
    sousJacents: [{ nom: 'CSI Smallcap 500 Index', bloomberg: 'SH000905 Index', marche: 'Shanghai' }],
    description: '3Y Callable émetteur — CSI Smallcap 500, protection 90 % (indicatif, TS à fournir)',
    badges: ['Single', 'Callable', '90 % protégé', 'TS à fournir'],
  }),
  metaProduct({
    isin: 'XS3256693576',
    nom: 'Athena Airbag Sanofi (décrément 3,76)',
    emetteur: 'Barclays Bank PLC',
    productType: 'Athena Airbag',
    dateEmission: '2026-03-16',
    dureeAnnees: 10,
    basket: 'single',
    sousJacents: [{ nom: 'Sanofi (décrément 3,76)', marche: 'Euronext Paris' }],
    description: '10Y Athena Airbag — Sanofi à décrément 3,76',
    badges: ['Single', 'Airbag', 'Décrément', 'TS à fournir'],
  }),
]

// Identité depuis le reporting mensuel — fournée 2026-06 (suite). Pour les taux
// le coupon p.a. et la référence (CMS/TEC) viennent du libellé ; les barrières de
// taux exactes et le calendrier restent « à fournir » via la termsheet.
const metaProducts2: Product[] = [
  // — Taux : Phoenix Bearish CMS/TEC (capital garanti) —
  metaProduct({
    isin: 'XS2804857568', nom: 'Phoenix Bearish CMS 10Y', emetteur: 'BNP Paribas',
    productType: 'Phoenix taux', assetClass: 'rates', family: 'rates_structured',
    dateEmission: '2024-07-09', dureeAnnees: 12, basket: 'single',
    sousJacents: [{ nom: 'EUR CMS 10Y' }],
    terms: { kind: 'rates', type: 'phoenix_taux', sens: 'bearish', tauxReference: 'EUR CMS 10Y', capitalGaranti: true },
    description: '12Y Phoenix Bearish CMS 10Y — capital garanti (barrières/coupon à fournir)',
    badges: ['Taux', 'Bearish', 'TS à fournir'],
  }),
  // — Taux : TARN steepener CMS30-CMS2 —
  metaProduct({
    isin: 'XS2465015720', nom: 'TARN steepener CMS 30Y-2Y — 5,75 % ×2', emetteur: 'BNP Paribas',
    productType: 'TARN', assetClass: 'rates', family: 'rates_structured',
    dateEmission: '2023-02-14', dureeAnnees: 12, basket: 'single',
    sousJacents: [{ nom: 'EUR CMS 30Y − CMS 2Y' }],
    terms: { kind: 'rates', type: 'tarn', tauxReference: 'EUR CMS 30Y', tauxReference2: 'EUR CMS 2Y', couponConditionnelPa: 5.75, multiplicateur: 2, capitalGaranti: true },
    description: '12Y TARN steepener (CMS 30Y−2Y) — coupon 5,75 % ×2 (cible/calendrier à fournir)',
    badges: ['Taux', 'TARN', 'Steepener', 'TS à fournir'],
  }),
  metaProduct({
    isin: 'XS2444096874', nom: 'TARN steepener CMS 30Y-2Y — 4,20 % ×2', emetteur: 'BNP Paribas',
    productType: 'TARN', assetClass: 'rates', family: 'rates_structured',
    dateEmission: '2022-12-06', dureeAnnees: 6, basket: 'single',
    sousJacents: [{ nom: 'EUR CMS 30Y − CMS 2Y' }],
    terms: { kind: 'rates', type: 'tarn', tauxReference: 'EUR CMS 30Y', tauxReference2: 'EUR CMS 2Y', couponConditionnelPa: 4.2, multiplicateur: 2, capitalGaranti: true },
    description: '6Y TARN steepener (CMS 30Y−2Y) — coupon 4,20 % ×2 (cible/calendrier à fournir)',
    badges: ['Taux', 'TARN', 'Steepener', 'TS à fournir'],
  }),
  // — Taux : Callable / FRN / ZC —
  metaProduct({
    isin: 'XS2569852416', nom: 'Callable FRN 3,61 %', emetteur: 'CIBC',
    productType: 'Callable FRN', assetClass: 'rates', family: 'rates_structured',
    dateEmission: '2023-01-12', dureeAnnees: 5, basket: 'single',
    sousJacents: [{ nom: 'Taux fixe rappelable' }],
    terms: { kind: 'rates', type: 'callable', couponConditionnelPa: 3.61, capitalGaranti: true, callable: true },
    description: '5Y Callable Fixed Rate Note CIBC — coupon 3,61 % p.a., rappelable émetteur',
    badges: ['Taux', 'Callable', 'TS à fournir'],
  }),
  metaProduct({
    isin: 'XS2110106908', nom: 'GBP Zero-Coupon Callable 12YNC4', emetteur: 'Citigroup',
    productType: 'Callable ZC', assetClass: 'rates', family: 'rates_structured', devise: 'GBP',
    dateEmission: '2024-02-14', dureeAnnees: 12, frequence: 'in_fine', basket: 'single',
    sousJacents: [{ nom: 'Note zéro-coupon GBP rappelable' }],
    terms: { kind: 'rates', type: 'callable', capitalGaranti: true, callable: true, inFine: true },
    description: '12Y GBP Zero-Coupon Note rappelable (non-call 4 ans) — Citi',
    badges: ['Taux', 'Callable', 'GBP', 'TS à fournir'],
  }),
  // — Crédit : CLN tranches iTraxx zero-recovery —
  metaProduct({
    isin: 'XS2642227883', nom: 'CLN tranche iTraxx 4-7 % zero-recovery', emetteur: 'BNP Paribas',
    productType: 'CLN tranche', assetClass: 'credit', family: 'credit_linked',
    dateEmission: '2024-12-13', dureeAnnees: 5, basket: 'single',
    sousJacents: [{ nom: 'Tranche iTraxx 4-7 % (zero-recovery)' }],
    terms: { kind: 'credit', type: 'tranche', indexReference: 'iTraxx (à préciser)', attachementPct: 4, detachementPct: 7, zeroRecovery: true, levier: Math.round((1 / 0.03) * 10) / 10, inFine: true, protectionCapital: false },
    description: '5Y CLN tranche iTraxx 4-7 % zero-recovery — levier ≈ 33× (coupon à fournir)',
    badges: ['Crédit', 'Tranche', 'Zero-recovery', 'TS à fournir'],
  }),
  metaProduct({
    isin: 'XS2863767542', nom: 'CLN tranche iTraxx 3-6 % zero-recovery', emetteur: 'BNP Paribas',
    productType: 'CLN tranche', assetClass: 'credit', family: 'credit_linked',
    dateEmission: '2024-10-14', dureeAnnees: 5, basket: 'single',
    sousJacents: [{ nom: 'Tranche iTraxx 3-6 % (zero-recovery)' }],
    terms: { kind: 'credit', type: 'tranche', indexReference: 'iTraxx (à préciser)', attachementPct: 3, detachementPct: 6, zeroRecovery: true, levier: Math.round((1 / 0.03) * 10) / 10, inFine: true, protectionCapital: false },
    description: '5Y CLN tranche iTraxx 3-6 % zero-recovery — levier ≈ 33× (coupon à fournir)',
    badges: ['Crédit', 'Tranche', 'Zero-recovery', 'TS à fournir'],
  }),
  // — Actions : Athena / Phoenix (identité) —
  metaProduct({
    isin: 'XS3287495306', nom: 'Athena Airbag BBVA', emetteur: 'BNP Paribas',
    productType: 'Athena Airbag', dateEmission: '2026-04-13', dureeAnnees: 6, basket: 'single',
    sousJacents: [{ nom: 'Banco Bilbao Vizcaya Argentaria', bloomberg: 'BBVA SM', marche: 'BME' }],
    description: '6Y Athena Airbag — BBVA', badges: ['Airbag', 'TS à fournir'],
  }),
  // Lu sur termsheet : produit de TAUX à capital garanti (pas un autocall actions).
  // Coupon 8 %/an années 1-3, puis 5 × (pente CMS 30Y−5Y) plancher 0 % ; call
  // émetteur semestriel à 100 % (du 30/09/2026 au 30/09/2036) ; capital 100 % garanti.
  metaProduct({
    isin: 'FR001400T985', nom: 'SPHINX 15', emetteur: 'BNP Paribas',
    productType: 'CMS Steepener (capital garanti)', assetClass: 'rates', family: 'rates_structured',
    dateEmission: '2024-12-02', dureeAnnees: 12, frequence: 'semestriel', basket: 'single',
    sousJacents: [
      { nom: 'EUR CMS 30Y' },
      { nom: 'EUR CMS 5Y' },
    ],
    couponPaPct: 8,
    barriereAutocall: 'Call émetteur 100 %',
    pdiText: '100 % (capital garanti)',
    description: 'SPHINX 15 — pente CMS 30Y−5Y · coupon 8 % (an 1-3) puis 5× pente · capital garanti',
    badges: ['Taux', 'Capital garanti', 'Call émetteur'],
  }),
  // CH1322027827 décodé en définition complète plus bas (bilModernaPfizerSanofi).
  metaProduct({
    isin: 'FR001400GV92', nom: 'Phoenix Mémoire Wof Porsche + Volkswagen', emetteur: 'Morgan Stanley',
    productType: 'Phoenix', dateEmission: '2023-04-04', dureeAnnees: 5, basket: 'worst_of',
    sousJacents: [
      { nom: 'Porsche AG', bloomberg: 'P911 GY', marche: 'XETRA' },
      { nom: 'Volkswagen AG', bloomberg: 'VOW3 GY', marche: 'XETRA' },
    ],
    description: '5Y Phoenix Mémoire Wof — Porsche + Volkswagen', badges: ['Worst-of', 'Effet mémoire', 'TS à fournir'],
  }),
  // — Actions : autocall sur indice à décrément (« Quartz ») —
  metaProduct({
    isin: 'FRIP00001UV3', nom: 'Quartz 51 — BNP décrément 4,2', emetteur: 'Morgan Stanley',
    productType: 'Autocall décrément', family: 'participation',
    dateEmission: '2025-11-11', dureeAnnees: 12, basket: 'single',
    sousJacents: [{ nom: 'BNP Paribas (décrément 4,2)', bloomberg: 'BNP FP', marche: 'Euronext Paris' }],
    description: '12Y Autocall « Quartz 51 » — BNP Paribas à décrément 4,2', badges: ['Single', 'Décrément', 'TS à fournir'],
  }),
]

// ─────────────────────────────────────────────────────────────────────────
//  Décodages termsheet (juin 2026) — 2 nouveaux produits + correction CMS 2Y
// ─────────────────────────────────────────────────────────────────────────

// ── XS3064231932 — BNP Phoenix Bearish EUR CMS 2Y (TS 02/07/2025) ───────────
// Capital garanti. Coupon 6 % p.a. si EUR CMS 2Y ≤ 2,45 % ; autocall si ≤ 1,95 %.
// (La TS corrige la référence : CMS 2Y, et non CMS 10Y comme supposé au départ.)
const bnpBearishCms2y: Product = {
  ...phoenixBearish({
    isin: 'XS3064231932',
    nom: 'Phoenix Bearish EUR CMS 2Y (capital garanti)',
    emetteur: 'BNP Paribas Issuance B.V.',
    garant: 'BNP Paribas',
    notationEmetteur: 'S&P A+ / Moody’s A1',
    nominal: 30_000_000,
    freq: 'annuel',
    initial: '2025-07-02',
    emission: '2025-07-11',
    finale: '2037-07-09',
    echeance: '2037-07-13',
    tauxRef: 'EUR CMS 2Y',
    couponPct: 6,
    barriereCoupon: 2.45,
    barriereRappel: 1.95,
    rappelActif: 1,
    obs: [
      '2026-07-09', '2027-07-08', '2028-07-07', '2029-07-09', '2030-07-09',
      '2031-07-09', '2032-07-08', '2033-07-07', '2034-07-07', '2035-07-09',
      '2036-07-09', '2037-07-09',
    ],
    pay: [
      '2026-07-13', '2027-07-12', '2028-07-11', '2029-07-11', '2030-07-11',
      '2031-07-11', '2032-07-12', '2033-07-11', '2034-07-11', '2035-07-11',
      '2036-07-11', '2037-07-13',
    ],
    description:
      '12Y Phoenix Bearish EUR CMS 2Y — coupon 6 % p.a. si ≤ 2,45 %, autocall si ≤ 1,95 %, capital garanti',
    termsheetFichier: 'XS3064231932.pdf',
  }),
  badges: ['Taux', 'Bearish CMS 2Y', 'Capital garanti'],
}

// ── FRSG00016HO2 — SG Phoenix Bearish EUR CMS 10Y (TS 18/06/2025) ───────────
// Capital garanti. Coupon 5,50 % p.a. si EUR CMS 10Y ≤ 3,25 % ; autocall si ≤ 2,25 %.
const sgBearishCms10_325 = phoenixBearish({
  isin: 'FRSG00016HO2',
  nom: 'Phoenix Bearish EUR CMS 10Y (2,25 % / 3,25 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 1_000_000,
  freq: 'annuel',
  initial: '2025-06-19',
  emission: '2025-06-19',
  finale: '2037-06-12',
  echeance: '2037-06-19',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 5.5,
  barriereCoupon: 3.25,
  barriereRappel: 2.25,
  rappelActif: 1,
  obs: [
    '2026-06-12', '2027-06-14', '2028-06-12', '2029-06-12', '2030-06-12',
    '2031-06-12', '2032-06-14', '2033-06-13', '2034-06-12', '2035-06-12',
    '2036-06-12', '2037-06-12',
  ],
  pay: [
    '2026-06-19', '2027-06-21', '2028-06-19', '2029-06-19', '2030-06-19',
    '2031-06-19', '2032-06-21', '2033-06-20', '2034-06-19', '2035-06-19',
    '2036-06-19', '2037-06-19',
  ],
  description:
    '12Y Phoenix Bearish EUR CMS 10Y — coupon 5,50 % p.a. si ≤ 3,25 %, autocall si ≤ 2,25 %, capital garanti',
  termsheetFichier: 'TermSheet_fre_Phoenix Bearish_CMS.EUR.10Y_FRSG00016HO2.pdf',
})

// ── Vague décodage TS (lot juin 2026) — produits de taux Phoenix Bearish ─────
// FRSG00015XO1 — SG Phoenix Bearish EUR CMS 10Y (10Y) : 5 % si ≤ 2,70 %, autocall ≤ 2,15 %.
const sgBearishCms10_270 = phoenixBearish({
  isin: 'FRSG00015XO1',
  nom: 'Phoenix Bearish EUR CMS 10Y (2,15 % / 2,70 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 30_000_000,
  freq: 'annuel',
  initial: '2025-04-16',
  emission: '2025-04-16',
  finale: '2035-04-09',
  echeance: '2035-04-16',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 5,
  barriereCoupon: 2.7,
  barriereRappel: 2.15,
  rappelActif: 1,
  obs: [
    '2026-04-09', '2027-04-09', '2028-04-07', '2029-04-09', '2030-04-09',
    '2031-04-07', '2032-04-09', '2033-04-08', '2034-04-06', '2035-04-09',
  ],
  pay: [
    '2026-04-16', '2027-04-16', '2028-04-18', '2029-04-16', '2030-04-16',
    '2031-04-16', '2032-04-16', '2033-04-19', '2034-04-17', '2035-04-16',
  ],
  description:
    '10Y Phoenix Bearish EUR CMS 10Y — coupon 5 % p.a. si ≤ 2,70 %, autocall si ≤ 2,15 %, capital garanti',
  termsheetFichier: '0577401 - FRSG00015XO1 - Autocall Euro 10 Ans.pdf',
})

// FR001400WR56 — BNP Phoenix Bearish EUR CMS 10Y (12Y, trimestriel) : 1,50 %/trim.
// (6 % p.a.) si ≤ 2,80 %, autocall ≤ 2,30 % à partir d'1 an de non-call.
const bnpBearishCms10_280 = phoenixBearish({
  isin: 'FR001400WR56',
  nom: 'Phoenix Bearish EUR CMS 10Y (2,30 % / 2,80 %)',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1',
  nominal: 30_000_000,
  freq: 'trimestriel',
  initial: '2025-01-31',
  emission: '2025-01-31',
  finale: '2037-03-20',
  echeance: '2037-03-24',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 1.5,
  couponPa: 6,
  barriereCoupon: 2.8,
  barriereRappel: 2.3,
  rappelActif: 4, // 1 an de non-call (autocall à partir de la 4e observation)
  obs: [
    '2025-06-20', '2025-09-22', '2025-12-22', '2026-03-20', '2026-06-22',
    '2026-09-22', '2026-12-22', '2027-03-22', '2027-06-22', '2027-09-22',
    '2027-12-22', '2028-03-22', '2028-06-22', '2028-09-21', '2028-12-21',
    '2029-03-22', '2029-06-21', '2029-09-20', '2029-12-20', '2030-03-21',
    '2030-06-20', '2030-09-20', '2030-12-20', '2031-03-20', '2031-06-20',
    '2031-09-22', '2031-12-22', '2032-03-22', '2032-06-22', '2032-09-22',
    '2032-12-22', '2033-03-22', '2033-06-22', '2033-09-22', '2033-12-22',
    '2034-03-22', '2034-06-22', '2034-09-21', '2034-12-21', '2035-03-21',
    '2035-06-21', '2035-09-20', '2035-12-20', '2036-03-20', '2036-06-20',
    '2036-09-22', '2036-12-22', '2037-03-20',
  ],
  pay: [
    '2025-06-24', '2025-09-24', '2025-12-24', '2026-03-24', '2026-06-24',
    '2026-09-24', '2026-12-24', '2027-03-24', '2027-06-24', '2027-09-24',
    '2027-12-24', '2028-03-24', '2028-06-26', '2028-09-25', '2028-12-27',
    '2029-03-26', '2029-06-25', '2029-09-24', '2029-12-24', '2030-03-25',
    '2030-06-24', '2030-09-24', '2030-12-24', '2031-03-24', '2031-06-24',
    '2031-09-24', '2031-12-24', '2032-03-24', '2032-06-24', '2032-09-24',
    '2032-12-24', '2033-03-24', '2033-06-24', '2033-09-26', '2033-12-27',
    '2034-03-24', '2034-06-26', '2034-09-25', '2034-12-27', '2035-03-27',
    '2035-06-25', '2035-09-24', '2035-12-24', '2036-03-24', '2036-06-24',
    '2036-09-24', '2036-12-24', '2037-03-24',
  ],
  description:
    '12Y Phoenix Bearish EUR CMS 10Y — coupon 1,50 %/trim. (6 % p.a.) si ≤ 2,80 %, autocall si ≤ 2,30 % (après 1 an), capital garanti',
  termsheetFichier: 'FR001400WR56.pdf',
})

// FR001400P397 — SG Phoenix Bearish In Fine EUR CMS 10Y (12Y) : 8,70 % p.a. si ≤ 3 %
// payé IN FINE (somme à l'échéance/au rappel), autocall ≤ 2,50 %, capital garanti.
const sgBearishInFineCms10_300 = phoenixBearish({
  isin: 'FR001400P397',
  nom: 'Phoenix Bearish In Fine EUR CMS 10Y (2,50 % / 3,00 %)',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 2_000_000,
  freq: 'annuel',
  initial: '2024-04-10',
  emission: '2024-04-10',
  finale: '2036-04-03',
  echeance: '2036-04-10',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 8.7,
  barriereCoupon: 3.0,
  barriereRappel: 2.5,
  rappelActif: 1,
  memoire: true,
  inFine: true,
  obs: [
    '2025-04-03', '2026-04-01', '2027-04-05', '2028-04-03', '2029-04-03',
    '2030-04-03', '2031-04-03', '2032-04-05', '2033-04-04', '2034-03-31',
    '2035-04-03', '2036-04-03',
  ],
  pay: [
    '2025-04-10', '2026-04-10', '2027-04-12', '2028-04-10', '2029-04-10',
    '2030-04-10', '2031-04-10', '2032-04-12', '2033-04-11', '2034-04-11',
    '2035-04-10', '2036-04-10',
  ],
  description:
    '12Y Phoenix Bearish In Fine EUR CMS 10Y — coupon 8,70 % p.a. si ≤ 3,00 % (payé in fine), autocall si ≤ 2,50 %, capital garanti',
  termsheetFichier:
    '20240320_FR001400P397_Phoenix Bearish In Fine CMS 10Y  - Barrière 3.00%-2.50% - 12Y_SOCGEN_CARMF.pdf',
})

// XS0461632811 — Deutsche Bank Phoenix Bearish EUR CMS 10Y (5Y) : 4,25 % si ≤ 3,15 %,
// autocall ≤ 2,50 %, capital garanti.
const dbBearishCms10_315 = phoenixBearish({
  isin: 'XS0461632811',
  nom: 'Phoenix Bearish EUR CMS 10Y (2,50 % / 3,15 %)',
  emetteur: 'Deutsche Bank AG',
  notationEmetteur: 'S&P A / Moody’s A1',
  nominal: 1_250_000,
  freq: 'annuel',
  initial: '2024-05-28',
  emission: '2024-05-28',
  finale: '2029-05-15',
  echeance: '2029-05-28',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 4.25,
  barriereCoupon: 3.15,
  barriereRappel: 2.5,
  rappelActif: 1,
  obs: ['2025-05-14', '2026-05-15', '2027-05-14', '2028-05-16', '2029-05-15'],
  pay: ['2025-05-28', '2026-05-28', '2027-05-28', '2028-05-30', '2029-05-29'],
  description:
    '5Y Phoenix Bearish EUR CMS 10Y — coupon 4,25 % p.a. si ≤ 3,15 %, autocall si ≤ 2,50 %, capital garanti',
  termsheetFichier: 'XS0461632811_Phoenix Bearish CMS10- (2.50-3.15) - 5Y_0800101.pdf',
})

// XS2772970781 — BNP Phoenix Bearish EUR CMS 10Y (5Y) : 4,25 % si ≤ 3,15 %, autocall ≤ 2,50 %.
const bnpBearishCms10_315 = phoenixBearish({
  isin: 'XS2772970781',
  nom: 'Phoenix Bearish EUR CMS 10Y (2,50 % / 3,15 %)',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  nominal: 1_250_000,
  freq: 'annuel',
  initial: '2024-05-27',
  emission: '2024-05-27',
  finale: '2029-05-24',
  echeance: '2029-05-27',
  tauxRef: 'EUR CMS 10Y',
  couponPct: 4.25,
  barriereCoupon: 3.15,
  barriereRappel: 2.5,
  rappelActif: 1,
  obs: ['2025-05-23', '2026-05-25', '2027-05-25', '2028-05-25', '2029-05-24'],
  pay: ['2025-05-27', '2026-05-27', '2027-05-27', '2028-05-29', '2029-05-28'],
  description:
    '5Y Phoenix Bearish EUR CMS 10Y — coupon 4,25 % p.a. si ≤ 3,15 %, autocall si ≤ 2,50 %, capital garanti',
  termsheetFichier: 'XS2772970781 - 5Y Phoenix on CMS in EUR - 0800101.pdf',
})

// FR001400SDV1 — CIC Phoenix Bearish TEC 10 (12Y) : 6,30 % si TEC < 3,15 %, autocall < 2,35 %.
// ⚠ Capital NON garanti : si TEC ≥ 3,15 % à l'échéance, remboursement amorti (perte). Senior CIC.
const cicBearishTec10: Product = {
  id: 'FR001400SDV1',
  nom: 'Phoenix Bearish TEC 10 (2,35 % / 3,15 %)',
  isin: 'FR001400SDV1',
  emetteur: 'CIC',
  notationEmetteur: 'Senior non garanti',
  assetClass: 'rates',
  family: 'rates_structured',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-10-28',
  dateEmission: '2024-10-28',
  dateConstatationFinale: '2036-10-21',
  dateEcheance: '2036-10-28',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [{ nom: 'TEC 10 (OAT 10 ans)', bloomberg: 'BFRTEC10 Index', marche: 'Taux' }],
  terms: {
    kind: 'rates',
    type: 'phoenix_taux',
    sens: 'bearish',
    tauxReference: 'TEC 10',
    effetMemoire: false,
    couponConditionnelPct: 6.3,
    couponConditionnelPa: 6.3,
    barriereCouponTauxPct: 3.15,
    barriereRappelTauxPct: 2.35,
    capitalGaranti: true,
  },
  observations: buildObservations(
    [
      '2025-10-21', '2026-10-21', '2027-10-21', '2028-10-23', '2029-10-22',
      '2030-10-21', '2031-10-21', '2032-10-21', '2033-10-21', '2034-10-23',
      '2035-10-22', '2036-10-21',
    ],
    [
      '2025-10-28', '2026-10-28', '2027-10-28', '2028-10-30', '2029-10-29',
      '2030-10-28', '2031-10-28', '2032-10-28', '2033-10-28', '2034-10-30',
      '2035-10-29', '2036-10-28',
    ],
    {
      niveauRappelPct: (n) => (n <= 11 ? 2.35 : undefined),
      montantRemboursementPct: 100,
      couponPct: 6.3,
      niveauCouponPct: 3.15,
      rappelActifAPartirDe: 1,
    },
  ),
  rr: 'LS',
  productType: 'Phoenix Taux',
  description:
    '12Y Phoenix Bearish TEC 10 (CIC) — coupon 6,30 % p.a. si TEC < 3,15 %, autocall si < 2,35 % ; capital garanti à 100 % à l’échéance',
  badges: ['Taux', 'Bearish TEC10', 'Capital garanti'],
  termsheetFichier: 'TS_2024-10-02_CIC_PhoenixTEC_FR001400SDV1.pdf',
}

// ── FR0014018KY5 — BNP Athéna Novo Nordisk (TS 11/05/2026) ──────────────────
// Single. Trimestriel après 1 an de non-call. Rappel si Novo ≥ 100 % ; prime au
// rappel = 110,35 % + n×3,45 % (n = 1..16). À maturité : Novo ≥ 100 % ⇒ 169 %
// (+69 %) ; ≥ 50 % ⇒ capital ; < 50 % (barrière européenne) ⇒ perte 1:1.
const athenaNovoNordisk: Product = {
  id: 'FR0014018KY5',
  nom: 'Athéna Novo Nordisk',
  isin: 'FR0014018KY5',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-05-11',
  dateEmission: '2026-05-20',
  dateConstatationFinale: '2031-05-12',
  dateEcheance: '2031-05-26',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'Novo Nordisk A/S', bloomberg: 'NOVOB DC', marche: 'Nasdaq Copenhagen' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false, // Athéna à prime : pas de coupon mémoire (la prime s'accumule)
    degressif: false,
    couponPa: 13.8, // prime indicative (+3,45 %/trim.) ; aucun coupon distribué
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    bonusFinalPct: 69,
  },
  observations: buildObservations(
    [
      '2027-05-11', '2027-08-11', '2027-11-11', '2028-02-11', '2028-05-11',
      '2028-08-11', '2028-11-13', '2029-02-12', '2029-05-14', '2029-08-13',
      '2029-11-12', '2030-02-11', '2030-05-13', '2030-08-12', '2030-11-11',
      '2031-02-11',
    ],
    [
      '2027-05-25', '2027-08-25', '2027-11-25', '2028-02-25', '2028-05-25',
      '2028-08-25', '2028-11-27', '2029-02-26', '2029-05-28', '2029-08-27',
      '2029-11-26', '2030-02-25', '2030-05-27', '2030-08-26', '2030-11-25',
      '2031-02-25',
    ],
    {
      niveauRappelPct: 100,
      montantRemboursementPct: (n) => Math.round((110.35 + n * 3.45) * 100) / 100,
      rappelActifAPartirDe: 1,
    },
  ),
  rr: 'LS',
  productType: 'Athéna',
  description:
    '5Y Athéna Novo Nordisk — prime au rappel 110,35 %+n×3,45 % (trim., 1 an non-call), KI 50 % européen, +69 % à maturité',
  badges: ['Single', 'Athéna', 'Bonus +69%'],
  termsheetFichier: 'FR0014018KY5.pdf',
}

// ── FRSG000188R4 — SG Autocall Équipondéré Bouygues + Vinci + Eiffage ────────
// Panier équipondéré (performance MOYENNE), strike moyen (15/05 & 05/06/2026).
// Semestriel après 1 an de non-call. Rappel si perf moy. ≥ 0 % ; prime = i×3,5 %
// (i = 2..11). À maturité (i=12) : moy. ≥ 0 % ⇒ 142 % (+42 %) ; ≥ −40 % ⇒ capital ;
// < −40 % (barrière européenne sur panier) ⇒ perte 1:1. Capital non protégé.
const sgBouyguesVinciEiffage: Product = {
  id: 'FRSG000188R4',
  nom: 'Autocall Équipondéré Bouygues + Vinci + Eiffage',
  isin: 'FRSG000188R4',
  emetteur: 'SG Issuer',
  garant: 'Société Générale',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-05-15',
  dateEmission: '2026-06-05',
  dateConstatationFinale: '2032-06-07',
  dateEcheance: '2032-06-14',
  frequence: 'semestriel',
  basket: 'equipondere',
  sousJacents: [
    { nom: 'Vinci SA', bloomberg: 'DG FP', isin: 'FR0000125486', marche: 'Euronext Paris' },
    { nom: 'Bouygues SA', bloomberg: 'EN FP', isin: 'FR0000120503', marche: 'Euronext Paris' },
    { nom: 'Eiffage SA', bloomberg: 'FGR FP', isin: 'FR0000130452', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false, // prime au rappel (pas de coupon mémoire)
    degressif: false,
    couponPa: 7, // prime indicative (+3,5 %/sem.) ; aucun coupon distribué
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
    strikeMoyen: true,
    bonusFinalPct: 42,
  },
  observations: buildObservations(
    [
      '2027-06-07', '2027-12-06', '2028-06-05', '2028-12-05', '2029-06-05',
      '2029-12-05', '2030-06-05', '2030-12-05', '2031-06-05', '2031-12-05',
    ],
    [
      '2027-06-14', '2027-12-13', '2028-06-12', '2028-12-12', '2029-06-12',
      '2029-12-12', '2030-06-12', '2030-12-12', '2031-06-12', '2031-12-12',
    ],
    {
      niveauRappelPct: 100,
      montantRemboursementPct: (n) => 100 + (n + 1) * 3.5,
      rappelActifAPartirDe: 1,
    },
  ),
  rr: 'LS',
  productType: 'Autocall',
  description:
    '6Y Autocall équipondéré Bouygues + Vinci + Eiffage — prime 100 %+i×3,5 % (sem., 1 an non-call), KI 60 % européen sur panier moyen, +42 % à maturité',
  badges: ['Équipondéré', 'Autocall', 'Bonus +42%'],
  termsheetFichier: 'FRSG000188R4.pdf',
}

// ── XS2759139525 — BNP Athéna Airbag Kering (TS 26/04/2024) ─────────────────
const kgObs = [
  '2025-04-28', '2025-07-28', '2025-10-27', '2026-01-26', '2026-04-27', '2026-07-27',
  '2026-10-26', '2027-01-26', '2027-04-26', '2027-07-26', '2027-10-26', '2028-01-26',
  '2028-04-26', '2028-07-26', '2028-10-26', '2029-01-26',
]
const kgPay = [
  '2025-05-12', '2025-08-11', '2025-11-10', '2026-02-09', '2026-05-11', '2026-08-10',
  '2026-11-09', '2027-02-09', '2027-05-10', '2027-08-09', '2027-11-09', '2028-02-09',
  '2028-05-10', '2028-08-09', '2028-11-09', '2029-02-09',
]
const athenaKering: Product = {
  id: 'XS2759139525', nom: 'Athéna Airbag Kering', isin: 'XS2759139525',
  emetteur: 'BNP Paribas Issuance B.V.', garant: 'BNP Paribas', notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity', family: 'autocall', devise: 'EUR', nominal: 750_000, valeurNominale: 1000, prixEmission: 100,
  dateConstatationInitiale: '2024-04-26', dateEmission: '2024-05-10', dateConstatationFinale: '2029-04-26', dateEcheance: '2029-05-10',
  frequence: 'trimestriel', basket: 'single',
  sousJacents: [{ nom: 'Kering SA', bloomberg: 'KER FP', isin: 'FR0000121485', marche: 'Euronext Paris', niveauInitial: 337.95 }],
  terms: { kind: 'autocall', sens: 'standard', effetMemoire: false, degressif: false, couponPa: 11.75, barriereRappelPct: 100, protectionPct: 70, protectionStyle: 'europeenne', airbag: true, bonusFinalPct: 55.81 },
  observations: buildObservations(kgObs, kgPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => Math.round((108.8125 + n * 2.9375) * 10000) / 10000,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS', productType: 'Athéna Airbag',
  description: '5Y Athéna Airbag Kering — prime au rappel 108,8125 %+n×2,9375 % (trim., 1 an non-call), KI 70 % européen + airbag, +55,8 % à maturité',
  badges: ['Single', 'Athéna', 'Airbag'],
  termsheetFichier: 'EI9052EAG - 5Y Athena Airbag on Kering in EUR - Finalized TS[1].pdf',
}

// ── XS2941097813 — BBVA Athéna Airbag Wof BNP + Sanofi + TotalEnergies ──────
// (le reporting disait « Santander » : la TS confirme SANOFI, corrigé.) Mensuel,
// barrière de rappel dégressive 100 %→60 % (−1 %/mois, plancher 60 %), low strike.
const sbtObs = [
  '2026-03-09', '2026-04-07', '2026-05-07', '2026-06-08', '2026-07-07', '2026-08-07',
  '2026-09-07', '2026-10-07', '2026-11-09', '2026-12-07', '2027-01-07', '2027-02-08',
  '2027-03-08', '2027-04-07', '2027-05-07', '2027-06-07', '2027-07-07', '2027-08-09',
  '2027-09-07', '2027-10-07', '2027-11-08', '2027-12-07', '2028-01-07', '2028-02-07',
  '2028-03-07', '2028-04-07', '2028-05-08', '2028-06-07', '2028-07-07', '2028-08-07',
  '2028-09-07', '2028-10-09', '2028-11-07', '2028-12-07', '2029-01-08', '2029-02-07',
  '2029-03-07', '2029-04-09', '2029-05-07', '2029-06-07', '2029-07-09', '2029-08-07',
  '2029-09-07', '2029-10-08', '2029-11-07', '2029-12-07', '2030-01-07', '2030-02-07',
]
const sbtPay = [
  '2026-03-16', '2026-04-14', '2026-05-14', '2026-06-15', '2026-07-14', '2026-08-14',
  '2026-09-14', '2026-10-14', '2026-11-16', '2026-12-14', '2027-01-14', '2027-02-15',
  '2027-03-15', '2027-04-14', '2027-05-14', '2027-06-14', '2027-07-14', '2027-08-16',
  '2027-09-14', '2027-10-14', '2027-11-15', '2027-12-14', '2028-01-14', '2028-02-14',
  '2028-03-14', '2028-04-18', '2028-05-15', '2028-06-14', '2028-07-14', '2028-08-14',
  '2028-09-14', '2028-10-16', '2028-11-14', '2028-12-14', '2029-01-15', '2029-02-14',
  '2029-03-14', '2029-04-16', '2029-05-14', '2029-06-14', '2029-07-16', '2029-08-14',
  '2029-09-14', '2029-10-15', '2029-11-14', '2029-12-14', '2030-01-14', '2030-02-14',
]
const bbvaSanofiBnpTte: Product = {
  id: 'XS2941097813', nom: 'Athéna Airbag Wof BNP + Sanofi + TotalEnergies', isin: 'XS2941097813',
  emetteur: 'BBVA Global Markets B.V.', garant: 'BBVA', notationEmetteur: 'S&P A',
  assetClass: 'equity', family: 'autocall', devise: 'EUR', nominal: 300_000, valeurNominale: 1000, prixEmission: 100,
  dateConstatationInitiale: '2025-02-07', dateEmission: '2025-02-14', dateConstatationFinale: '2030-03-07', dateEcheance: '2030-03-14',
  frequence: 'mensuel', basket: 'worst_of',
  sousJacents: [
    { nom: 'BNP Paribas', bloomberg: 'BNP FP', isin: 'FR0000131104', marche: 'Euronext Paris' },
    { nom: 'Sanofi', bloomberg: 'SAN FP', isin: 'FR0000120578', marche: 'Euronext Paris' },
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', isin: 'FR0000120271', marche: 'Euronext Paris' },
  ],
  terms: { kind: 'autocall', sens: 'standard', effetMemoire: false, degressif: true, couponPa: 10.05, barriereRappelPct: 100, protectionPct: 60, protectionStyle: 'europeenne', airbag: true, strikeMoyen: true, bonusFinalPct: 50.25 },
  observations: buildObservations(sbtObs, sbtPay, {
    niveauRappelPct: (n) => Math.max(60, 101 - n),
    montantRemboursementPct: (n) => Math.round((110.05 + (n - 1) * 0.8375) * 10000) / 10000,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS', productType: 'Athéna Airbag',
  description: '5Y Athéna Airbag Wof BNP + Sanofi + TotalEnergies — prime 110,05 %+(n−1)×0,8375 % (mensuel), rappel dégressif 100→60 %, low strike, KI 60 % européen, +50,25 % à maturité',
  badges: ['Worst-of', 'Athéna', 'Airbag', 'Dégressif'],
  termsheetFichier: 'XS2941097813.pdf',
}

// ── XS2938576522 — Merrill Lynch (BofA) Athéna dégressif équipondéré TTE + Shell + Eni ─
const tseObs = ['2026-03-19', '2027-03-19', '2028-03-20', '2029-03-19']
const tsePay = ['2026-03-26', '2027-03-30', '2028-03-27', '2029-03-26']
const bofaTteShellEni: Product = {
  id: 'XS2938576522', nom: 'Athéna Dégressif Équipondéré TotalEnergies + Shell + Eni', isin: 'XS2938576522',
  emetteur: 'Merrill Lynch B.V.', garant: 'Bank of America Corporation', notationEmetteur: 'S&P A- / Moody’s A1',
  assetClass: 'equity', family: 'autocall', devise: 'EUR', nominal: 800_000, valeurNominale: 1000, prixEmission: 100,
  dateConstatationInitiale: '2025-03-19', dateEmission: '2025-03-26', dateConstatationFinale: '2030-03-19', dateEcheance: '2030-03-26',
  frequence: 'annuel', basket: 'equipondere',
  sousJacents: [
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', isin: 'FR0000120271', marche: 'Euronext Paris' },
    { nom: 'Shell PLC', bloomberg: 'SHELL NA', isin: 'GB00BP6MXD84', marche: 'Euronext Amsterdam' },
    { nom: 'Eni SpA', bloomberg: 'ENI IM', isin: 'IT0003132476', marche: 'Borsa Italiana' },
  ],
  terms: { kind: 'autocall', sens: 'standard', effetMemoire: false, degressif: true, couponPa: 7.5, barriereRappelPct: 100, protectionPct: 60, protectionStyle: 'europeenne', bonusFinalPct: 37.5 },
  observations: buildObservations(tseObs, tsePay, {
    niveauRappelPct: (n) => [100, 97.5, 95, 92.5][n - 1],
    montantRemboursementPct: (n) => 100 + n * 7.5,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS', productType: 'Athéna',
  description: '5Y Athéna dégressif équipondéré TTE + Shell + Eni — prime 100 %+n×7,5 % (annuel), rappel dégressif 100/97,5/95/92,5 %, +37,5 % à maturité si panier ≥ 90 %, KI 60 % européen',
  badges: ['Équipondéré', 'Athéna', 'Dégressif'],
  termsheetFichier: 'XS2938576522_Athena Dégressif sur panier EW TotalEnergies + Eni + Shell_0800101.pdf',
}

// ── FR1459AB6586 — GS Phoenix Mémoire Orange (indice décrément 0,74) ────────
// Phoenix : coupon 2,025 %/trim. si Orange ≥ 50 % (pas de mémoire), autocall 100 %
// à partir de mars 2026 (4 trimestres coupon-only au départ). Sous-jacent décrément.
const oraObs = [
  '2025-06-16', '2025-09-15', '2025-12-15', '2026-03-16', '2026-06-15', '2026-09-14',
  '2026-12-14', '2027-03-15', '2027-06-14', '2027-09-14', '2027-12-14', '2028-03-14',
  '2028-06-14', '2028-09-14', '2028-12-14', '2029-03-14', '2029-06-14', '2029-09-14',
  '2029-12-14', '2030-03-14', '2030-06-14', '2030-09-16', '2030-12-16', '2031-03-14',
  '2031-06-16', '2031-09-15', '2031-12-15', '2032-03-15', '2032-06-14', '2032-09-14',
  '2032-12-14', '2033-03-14', '2033-06-14', '2033-09-14', '2033-12-14', '2034-03-14',
  '2034-06-14', '2034-09-14', '2034-12-14', '2035-03-14', '2035-06-14', '2035-09-14',
  '2035-12-14', '2036-03-14', '2036-06-16', '2036-09-15', '2036-12-15', '2037-03-16',
]
const oraPay = [
  '2025-06-30', '2025-09-29', '2025-12-31', '2026-03-30', '2026-06-29', '2026-09-28',
  '2026-12-29', '2027-03-31', '2027-06-28', '2027-09-28', '2027-12-28', '2028-03-28',
  '2028-06-28', '2028-09-28', '2029-01-02', '2029-03-28', '2029-06-28', '2029-09-28',
  '2030-01-02', '2030-03-28', '2030-06-28', '2030-09-30', '2031-01-02', '2031-03-28',
  '2031-06-30', '2031-09-29', '2031-12-31', '2032-03-31', '2032-06-28', '2032-09-28',
  '2032-12-28', '2033-03-28', '2033-06-28', '2033-09-28', '2033-12-29', '2034-03-28',
  '2034-06-28', '2034-09-28', '2035-01-02', '2035-03-30', '2035-06-28', '2035-09-28',
  '2036-01-02', '2036-03-28', '2036-06-30', '2036-09-29', '2036-12-31', '2037-03-30',
]
const gsOrangeDecrement: Product = {
  id: 'FR1459AB6586', nom: 'Phoenix Mémoire Orange (décrément 0,74)', isin: 'FR1459AB6586',
  emetteur: 'Goldman Sachs Finance Corp International', garant: 'The Goldman Sachs Group, Inc.', notationEmetteur: 'Moody’s A2 / S&P BBB+ / Fitch A',
  assetClass: 'equity', family: 'autocall', devise: 'EUR', nominal: 30_000_000, valeurNominale: 1000, prixEmission: 100,
  dateConstatationInitiale: '2025-01-22', dateEmission: '2025-02-05', dateConstatationFinale: '2037-03-16', dateEcheance: '2037-03-30',
  frequence: 'trimestriel', basket: 'single',
  sousJacents: [{ nom: 'Orange SA (décrément 0,74)', bloomberg: 'SGOD074 Index', marche: 'Euronext Paris' }],
  terms: { kind: 'autocall', sens: 'standard', effetMemoire: false, couponPa: 8.1, barriereCouponPct: 50, barriereRappelPct: 100, protectionPct: 50, protectionStyle: 'europeenne', decrement: '0,74 pt/an' },
  observations: buildObservations(oraObs, oraPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: 100,
    couponPct: 2.025,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS', productType: 'Phoenix',
  description: '12Y Phoenix Orange (décrément 0,74) — coupon 2,025 %/trim. si Orange ≥ 50 %, autocall 100 % dès mars 2026, KI 50 % européen',
  badges: ['Single', 'Phoenix', 'Décrément'],
  termsheetFichier: 'FR1459AB6586_Phoenix Memory Orange Fix Div 0.74 - 12Y_0800101.pdf',
}

// ── Citi (CGMFL) — Quartz 54 : Phoenix Mémoire sur MerQube Sanofi 3,92 décrément ─
// Obs. trimestrielles ; autocall dégressif 100 %→60 % (−5 %/an, plancher 2035) ;
// coupon mémoire cumulatif 10 %→117,5 % (2,5 %/trim. après un 1er coupon de 10 %).
const quartz54Obs = ['2027-05-31','2027-08-30','2027-11-29','2028-02-29','2028-05-29','2028-08-29','2028-11-29','2029-02-28','2029-05-29','2029-08-29','2029-11-29','2030-02-28','2030-05-29','2030-08-29','2030-11-29','2031-02-28','2031-05-29','2031-08-29','2031-12-01','2032-03-01','2032-05-31','2032-08-30','2032-11-29','2033-02-28','2033-05-30','2033-08-29','2033-11-29','2034-02-28','2034-05-29','2034-08-29','2034-11-29','2035-02-28','2035-05-29','2035-08-29','2035-11-29','2036-02-29','2036-05-29','2036-08-29','2036-12-01','2037-03-02','2037-05-29','2037-08-31','2037-11-30','2038-03-01']
const quartz54Pay = ['2027-06-14','2027-09-14','2027-12-13','2028-03-14','2028-06-12','2028-09-13','2028-12-13','2029-03-14','2029-06-12','2029-09-13','2029-12-13','2030-03-14','2030-06-12','2030-09-13','2030-12-13','2031-03-14','2031-06-12','2031-09-15','2031-12-15','2032-03-15','2032-06-14','2032-09-14','2032-12-13','2033-03-14','2033-06-13','2033-09-13','2033-12-13','2034-03-14','2034-06-12','2034-09-13','2034-12-13','2035-03-14','2035-06-12','2035-09-13','2035-12-13','2036-03-14','2036-06-12','2036-09-15','2036-12-15','2037-03-16','2037-06-12','2037-09-15','2037-12-14','2038-03-15']
const quartz54Barr = [100,100,100,100,95,95,95,95,90,90,90,90,85,85,85,85,80,80,80,80,75,75,75,75,70,70,70,70,65,65,65,65,60,60,60,60,60,60,60,60,60,60,60,60]
const quartz54Sanofi: Product = {
  id: 'FRC764201477', nom: 'Quartz 54 — Phoenix Mémoire Sanofi (décrément 3,92)', isin: 'FRC764201477',
  valor: '153161533',
  emetteur: 'Citigroup Global Markets Funding Luxembourg S.C.A.', garant: 'Citigroup Global Markets Limited',
  notationEmetteur: 'S&P A+/A-1 · Moody’s A1/P-1 · Fitch A+/F1',
  assetClass: 'equity', family: 'autocall', devise: 'EUR', nominal: 0, valeurNominale: 1000, prixEmission: 100,
  dateConstatationInitiale: '2026-03-05', dateEmission: '2026-03-26', dateConstatationFinale: '2038-05-31', dateEcheance: '2038-06-14',
  frequence: 'trimestriel', basket: 'single',
  sousJacents: [{ nom: 'MerQube Sanofi SA 3.92 Point Decrement (EUR) Index', bloomberg: 'MQDSA39P Index', marche: 'Euronext Paris', niveauInitial: 74.76 }],
  terms: { kind: 'autocall', sens: 'standard', effetMemoire: true, couponPa: 10, barriereCouponPct: 40, degressif: true, barriereRappelPct: 100, protectionPct: 60, protectionStyle: 'europeenne', decrement: '3,92 pts/an' },
  observations: buildObservations(quartz54Obs, quartz54Pay, {
    niveauRappelPct: (n) => quartz54Barr[n - 1],
    montantRemboursementPct: 100,
    couponPct: (n) => (n === 1 ? 10 : 2.5),
    niveauCouponPct: 40,
    rappelActifAPartirDe: 1,
  }),
  statut: 'vivant', rr: 'LS', productType: 'Phoenix',
  description: '12Y Phoenix Mémoire Sanofi (décrément 3,92) — coupon mémoire 2,5 %/trim. (10 % p.a.) si l’indice ≥ 40 %, autocall dégressif 100 %→60 % (−5 %/an), protection 60 % européenne',
  clients: ['CAPITALL'],
  badges: ['Single', 'Phoenix', 'Décrément', 'Effet mémoire', 'Dégressif'],
  termsheetFichier: 'TS_Quartz_54_Sanofi_Decrement_3.92_Pts.pdf',
}

// Produits décodés finement depuis leur termsheet (calendriers + mécanique complète).
// ── Barclays — Phoenix Mémoire worst-of EssilorLuxottica + ArcelorMittal ──────
//    (TS XS3395348454, décodée depuis la termsheet/KID Barclays du 12/06/2026)
const essMtObs = [
  '2026-09-14', '2026-12-14', '2027-03-12', '2027-06-14', '2027-09-13',
  '2027-12-13', '2028-03-13', '2028-06-12', '2028-09-12', '2028-12-12',
  '2029-03-12', '2029-06-12', '2029-09-12', '2029-12-12', '2030-03-12',
  '2030-06-12', '2030-09-12', '2030-12-12', '2031-03-12', '2031-06-12',
]
const essMtPay = [
  '2026-09-28', '2026-12-29', '2027-03-30', '2027-06-28', '2027-09-27',
  '2027-12-27', '2028-03-27', '2028-06-26', '2028-09-26', '2028-12-28',
  '2029-03-26', '2029-06-26', '2029-09-26', '2029-12-28', '2030-03-26',
  '2030-06-26', '2030-09-26', '2030-12-30', '2031-03-26', '2031-06-26',
]
// Barème d'autocall dégressif (obs 4 → 19 ; non-call sur 1-3, maturité en 20).
const essMtAer: (number | undefined)[] = [
  undefined, undefined, undefined, 96, 95, 94, 93, 92, 91, 90,
  89, 88, 87, 86, 85, 84, 83, 82, 81, undefined,
]
const barclaysEssMt: Product = {
  id: 'XS3395348454',
  nom: 'Phoenix Mémoire worst-of EssilorLuxottica + ArcelorMittal',
  isin: 'XS3395348454',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-06-12',
  dateEmission: '2026-06-26',
  dateConstatationFinale: '2031-06-12',
  dateEcheance: '2031-06-26',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'EssilorLuxottica', bloomberg: 'EL FP Equity', marche: 'Euronext Paris', devise: 'EUR', niveauInitial: 182.7 },
    { nom: 'ArcelorMittal', bloomberg: 'MT NA Equity', marche: 'Euronext Amsterdam', devise: 'EUR', niveauInitial: 60.6 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    couponPa: 10.65, // 26,63 € / trimestre sur 1 000 € = 2,663 %/T ≈ 10,65 % p.a.
    barriereCouponPct: 50,
    barriereRappelPct: 96, // niveau de rappel initial, dégressif jusqu'à 81 %
    degressif: true,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(essMtObs, essMtPay, {
    niveauRappelPct: (n) => essMtAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.6625,
    niveauCouponPct: 50,
    rappelActifAPartirDe: 4,
  }),
  statut: 'vivant',
  rr: 'LS',
  productType: 'Phoenix Mémoire',
  description:
    '5Y Phoenix Mémoire worst-of EssilorLuxottica + ArcelorMittal — autocall dégressif 96→80 %, coupon 10,65 % p.a. (barrière 50 %), trimestriel, protection 50 %',
  clients: ['ALVES - 06001'],
  badges: ['Mémoire', 'Worst-of', 'Dégressif'],
  termsheetFichier: '260626_5Y_Phoenix Mémoire worst-of EssilorLuxottica + ArcelorMittal_Trimestriel_XS3395348454_BARCLAYS.pdf',
}

// ═══════════════════════════════════════════════════════════════════════════
//  Termsheets décodées (16/06) — produits auparavant en placeholder.
//  Données extraites des PDF OneDrive (réelles ; champs non certains = absents).
// ═══════════════════════════════════════════════════════════════════════════

// ── XS3391940502 — Barclays Phoenix Mémoire Dégressif Wof Engie + Nexans + Schneider
const ensObs = ['2026-09-09','2026-12-09','2027-03-09','2027-06-09','2027-09-09','2027-12-09','2028-03-09','2028-06-09','2028-09-11','2028-12-11','2029-03-09','2029-06-11','2029-09-10','2029-12-10','2030-03-11','2030-06-10','2030-09-09','2030-12-09','2031-03-10','2031-06-09']
const ensPay = ['2026-09-23','2026-12-23','2027-03-23','2027-06-23','2027-09-23','2027-12-23','2028-03-23','2028-06-23','2028-09-25','2028-12-27','2029-03-23','2029-06-25','2029-09-24','2029-12-24','2030-03-25','2030-06-24','2030-09-23','2030-12-23','2031-03-24','2031-06-23']
const ensAer: (number | undefined)[] = [undefined,undefined,undefined,100,97,94,91,88,85,82,79,76,73,70,67,65,65,65,65,undefined]
const barclaysEngieNexansSchneider: Product = {
  id: 'XS3391940502',
  nom: 'Phoenix Mémoire Dégressif Engie + Nexans + Schneider',
  isin: 'XS3391940502',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'Moody’s A1 / S&P A+ / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260',
  devise: 'EUR',
  nominal: 1_400_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-06-09',
  dateEmission: '2026-06-23',
  dateConstatationFinale: '2031-06-09',
  dateEcheance: '2031-06-23',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Engie SA', bloomberg: 'ENGI FP', isin: 'FR0010208488', marche: 'Euronext Paris' },
    { nom: 'Nexans SA', bloomberg: 'NEX FP', isin: 'FR0000044448', marche: 'Euronext Paris' },
    { nom: 'Schneider Electric SE', bloomberg: 'SU FP', isin: 'FR0000121972', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.45,
    barriereCouponPct: 65,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(ensObs, ensPay, {
    niveauRappelPct: (n) => ensAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.6125,
    niveauCouponPct: 65,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Dégressif Wof Engie + Nexans + Schneider',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '260623_5Y_Phoenix Mémoire worst-of Engie + Nexans + Schneider Electric_Trimestriel_XS3391940502_BARCLAYS.pdf',
}

// ── XS3379794913 — BBVA Phoenix Mémoire Dégressif Wof ArcelorMittal + EssilorLuxottica
const mtPay = ['2026-09-16','2026-12-16','2027-03-16','2027-06-16','2027-09-16','2027-12-16','2028-03-16','2028-06-16','2028-09-18','2028-12-18','2029-03-16','2029-06-18','2029-09-17','2029-12-17','2030-03-18','2030-06-17','2030-09-16','2030-12-16','2031-03-17','2031-06-16']
const bbvaMittalEssilor: Product = {
  id: 'XS3379794913',
  nom: 'Phoenix Mémoire Dégressif ArcelorMittal + EssilorLuxottica',
  isin: 'XS3379794913',
  emetteur: 'BBVA Global Markets B.V.',
  garant: 'Banco Bilbao Vizcaya Argentaria',
  notationEmetteur: 'Moody’s A2 / S&P A+',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260',
  devise: 'EUR',
  nominal: 400_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-06-09',
  dateEmission: '2026-06-23',
  dateConstatationFinale: '2031-06-09',
  dateEcheance: '2031-06-16',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'ArcelorMittal', bloomberg: 'MT NA', isin: 'LU1598757687', marche: 'Euronext Amsterdam' },
    { nom: 'EssilorLuxottica', bloomberg: 'EL FP', isin: 'FR0000121667', marche: 'Euronext Paris' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 10.9,
    barriereCouponPct: 65,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(ensObs, mtPay, {
    niveauRappelPct: (n) => ensAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.725,
    niveauCouponPct: 65,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Dégressif Wof ArcelorMittal + EssilorLuxottica',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier:
    '260623_5Y_Phoenix Autocall Mémoire worst-of MITTAL + ESSILOR_Trimestriel_XS3379794913_BBVA.pdf',
}

// ── XS2979390502 — BNP Phoenix Bearish TEC 10Y (taux, capital garanti) ───────
const tec10Obs = ['2026-03-23','2027-03-23','2028-03-23','2029-03-22','2030-03-21','2031-03-21','2032-03-23','2033-03-23','2034-03-23','2035-03-21']
const tec10Pay = ['2026-03-25','2027-03-25','2028-03-27','2029-03-26','2030-03-25','2031-03-25','2032-03-25','2033-03-25','2034-03-27','2035-03-27']
const bnpTec10Phoenix: Product = {
  id: 'XS2979390502',
  nom: 'Phoenix Bearish TEC 10Y 10,30%',
  isin: 'XS2979390502',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'rates',
  family: 'rates_structured',
  devise: 'EUR',
  nominal: 1_950_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-03-11',
  dateEmission: '2025-03-25',
  dateConstatationFinale: '2035-03-21',
  dateEcheance: '2035-03-25',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [{ nom: 'TEC 10Y (EUR-TEC10-CNO)', marche: 'Reuters BDFCNOTEC' }],
  terms: {
    kind: 'rates',
    type: 'phoenix_taux',
    sens: 'bearish',
    tauxReference: 'TEC 10Y',
    couponConditionnelPct: 10.30,
    couponConditionnelPa: 10.30,
    barriereCouponTauxPct: 3.80,
    barriereRappelTauxPct: 3.00,
    capitalGaranti: true,
    effetMemoire: false,
  },
  observations: buildObservations(tec10Obs, tec10Pay, {
    niveauRappelPct: 3.0,
    niveauCouponPct: 3.8,
    couponPct: 10.30,
  }),
  rr: 'LS',
  productType: 'Phoenix Bearish',
  description: '10Y Phoenix Bearish TEC10 — coupon 10,30 % si TEC10 ≤ 3,80 %, rappel si ≤ 3,00 %, capital garanti',
  badges: ['Taux', 'Bearish', 'Capital garanti'],
  termsheetFichier: '250325_10Y_Phoenix Bearish TEC10 3-3.80 - 10.30%_Annuel_XS2979390502_BNP.pdf',
}

// ── XS3256693576 — Barclays Athena Snowball FTSE Sanofi Décrément 3,76 ────────
//    Indice propriétaire (SSDSAN04) non mappable Yahoo : on décode les termes,
//    sans le calendrier mensuel (109 obs.) qui ne pourrait pas être constaté.
const barclaysSanofiDecrement: Product = {
  id: 'XS3256693576',
  nom: 'Athena Snowball FTSE Sanofi Décrément 3,76',
  isin: 'XS3256693576',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'Moody’s A1 / S&P A+ / Fitch A+',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260',
  devise: 'EUR',
  nominal: 2_300_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-03-16',
  dateEmission: '2026-03-16',
  dateConstatationFinale: '2036-03-17',
  dateEcheance: '2036-03-31',
  frequence: 'mensuel',
  basket: 'single',
  sousJacents: [
    { nom: 'FTSE Sanofi 3.76 (indice à décrément)', bloomberg: 'SSDSAN04 Index', marche: 'Euronext Paris', niveauInitial: 72.77 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.70,
    barriereCouponPct: 100,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    decrement: '3,76 pts/an',
  },
  rr: 'LS',
  productType: 'Athena',
  description: '10Y Athena Snowball Sanofi (indice décrément 3,76 pts) — coupon mémoire 0,8084 %/mois (~9,70 % p.a.), KI 50 % européen, autocall dégressif mensuel (non-call 12 mois)',
  badges: ['Décrément', 'Snowball', 'Effet mémoire'],
  termsheetFichier: '260316_10Y_Athena Airbag Sanofi D 3.76_Mensuel_XS3256693576_BARCLAYS.pdf',
}

// ── XS2919373816 — BNP CLN Tranche iTraxx Europe Main S42 3,2–6,4% Zero Recovery
const bnpClnItraxx42: Product = {
  id: 'XS2919373816',
  nom: 'CLN Tranche iTraxx Main 3,2–6,4 % Zero Recovery',
  isin: 'XS2919373816',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'credit',
  family: 'credit_linked',
  devise: 'EUR',
  nominal: 990_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-12-18',
  dateEmission: '2025-01-02',
  dateConstatationFinale: '2029-12-20',
  dateEcheance: '2030-01-08',
  frequence: 'in_fine',
  basket: 'single',
  sousJacents: [],
  terms: {
    kind: 'credit',
    type: 'tranche',
    indexReference: 'iTraxx Europe Main Série 42 V1',
    nbEntites: 125,
    attachementPct: 3.2,
    detachementPct: 6.4,
    zeroRecovery: true,
    recouvrementPct: 0,
    couponPct: 31.25,
    couponPa: 6.25,
    inFine: true,
    protectionCapital: false,
  },
  rr: 'LS',
  productType: 'CLN',
  description: '5Y CLN Tranche 3,2–6,4 % iTraxx Europe Main S42 — Zero Recovery, coupon 31,25 % in fine (≈6,25 % p.a.)',
  badges: ['Crédit', 'Tranche', 'Zero Recovery'],
  termsheetFichier: '250102_5Y_CLN Tranche iTraxx Zero Recov 4-7_In Fine_XS2919373816_BNP.pdf',
}

// ── XS2863761933 — BNP Bond + Call Spread sur l'Or (USD), capital garanti ─────
const bnpGoldCallSpread: Product = {
  id: 'XS2863761933',
  nom: 'Bond + Call Spread sur l’Or (USD)',
  isin: 'XS2863761933',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+',
  assetClass: 'commodity',
  family: 'capital_protected',
  devise: 'USD',
  nominal: 1_500_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-12-10',
  dateEmission: '2024-12-24',
  dateConstatationFinale: '2027-12-10',
  dateEcheance: '2027-12-24',
  frequence: 'in_fine',
  basket: 'single',
  sousJacents: [{ nom: 'Or (LBMA Gold PM, USD/once)', bloomberg: 'GOLDLNPM Cmdty' }],
  rr: 'LS',
  productType: 'Bond + Call Spread',
  description: '3Y Bond + Call Spread sur l’Or (USD) — capital garanti 100 %, participation 100 % de 100 % à 117,5 % (cap)',
  badges: ['Capital garanti', 'Call spread', 'Or'],
  termsheetFichier: '241224_3Y_Bond + Call Spread on Gold in USD_In Fine_XS2863761933_BNP.pdf',
}

// ── XS2621505341 — BNP Note Callable libellée TRY, règlement EUR (NC3) ────────
const bnpTryCallable: Product = {
  id: 'XS2621505341',
  nom: 'Note Callable TRY 10NC3 (règlement EUR)',
  isin: 'XS2621505341',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s Aa3',
  assetClass: 'fx',
  family: 'rates_structured',
  devise: 'EUR',
  nominal: 500_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-05-07',
  dateEmission: '2025-05-14',
  dateConstatationFinale: '2035-05-13',
  dateEcheance: '2035-05-14',
  frequence: 'annuel',
  basket: 'single',
  sousJacents: [{ nom: 'EUR/TRY (Refinitiv WMRPSPOT35)' }],
  terms: {
    kind: 'rates',
    type: 'callable',
    couponConditionnelPa: 85,
    capitalGaranti: false,
    callable: true,
  },
  rr: 'LS',
  productType: 'Callable Note',
  description: '10Y NC3 — note libellée TRY, règlement EUR ; coupon fixe 85 %/an cumulé, call émetteur dès la 3e année. Capital non garanti en EUR (risque de change EUR/TRY).',
  badges: ['Change', 'TRY', 'Callable'],
  termsheetFichier:
    '250514_10Y_10Y TRY Denominated NC3 Callable In Fine Note with EUR Settlement_Annuel_XS2621505341_BNP.pdf',
}

// ── CH1271361060 — Secured Invest Partners, Dette Privée SIP Chabanais 10,25% ─
const sipChabanais: Product = {
  id: 'CH1271361060',
  nom: 'Dette Privée — SIP Chabanais 10,25 %',
  isin: 'CH1271361060',
  emetteur: 'Secured Invest Partners (SIP Opportunities — Comp. Chabanais)',
  assetClass: 'credit',
  family: 'other',
  devise: 'EUR',
  nominal: 5000,
  valeurNominale: 5000,
  prixEmission: 100,
  dateConstatationInitiale: '2023-06-12',
  dateEmission: '2023-06-12',
  dateConstatationFinale: '2025-06-12',
  dateEcheance: '2025-06-12',
  frequence: 'semestriel',
  basket: 'single',
  sousJacents: [],
  couponPaPct: 10.25,
  rr: 'LS',
  productType: 'Dette Privée',
  description: 'Dette privée senior (prêt Holding du 6 rue Chabanais) — coupon 10,25 %/an semestriel, capital non protégé, échéance 12/06/2025',
  badges: ['Dette privée', 'Coupon fixe'],
  termsheetFichier: '231201_2Y_Dette Privée - SIP Chabanais_Semestriel_CH1271361060_SIP.pdf',
}

// ── FRIP000014P8 — Morgan Stanley Autocall Bonus Luxe (MerQube décrément) ─────
const luxeObs = ['2026-03-31','2026-06-30','2026-09-30','2027-01-04','2027-03-31','2027-06-30','2027-09-30','2028-01-03','2028-03-31','2028-06-30','2028-10-02','2029-01-02','2029-04-03','2029-07-02','2029-10-01','2030-01-02','2030-04-01','2030-07-01','2030-09-30','2031-01-02','2031-03-31','2031-06-30','2031-09-30','2032-01-02','2032-03-31','2032-06-30','2032-09-30','2033-01-03','2033-03-31','2033-06-30','2033-09-30','2034-01-02','2034-03-31','2034-06-30','2034-10-02','2035-01-02','2035-04-02']
const luxePay = ['2026-04-09','2026-07-07','2026-10-07','2027-01-11','2027-04-07','2027-07-07','2027-10-07','2028-01-10','2028-04-07','2028-07-07','2028-10-09','2029-01-09','2029-04-10','2029-07-09','2029-10-08','2030-01-09','2030-04-08','2030-07-08','2030-10-07','2031-01-09','2031-04-07','2031-07-07','2031-10-07','2032-01-09','2032-04-07','2032-07-07','2032-10-07','2033-01-10','2033-04-07','2033-07-07','2033-10-07','2034-01-09','2034-04-11','2034-07-07','2034-10-09','2035-01-09','2035-04-09']
const luxeRemb = [110,112.5,115,117.5,120,122.5,125,127.5,130,132.5,135,137.5,140,142.5,145,147.5,150,152.5,155,157.5,160,162.5,165,167.5,170,172.5,175,177.5,180,182.5,185,187.5,190,192.5,195,197.5]
const msLuxeBonus: Product = {
  id: 'FRIP000014P8',
  nom: 'Autocall Bonus Luxe (MerQube Décrément 50 pts)',
  isin: 'FRIP000014P8',
  emetteur: 'Morgan Stanley & Co International plc',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-12-23',
  dateEmission: '2025-01-13',
  dateConstatationFinale: '2035-04-02',
  dateEcheance: '2035-04-09',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'MerQube Eurozone Consumer Products & Services 10 50 Point Decrement', bloomberg: 'MQDZC50P Index' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: false,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
    bonusFinalPct: 100,
    decrement: '50 pts/an',
    // Bonus/Snowball sans coupon périodique : prime de rappel +2,5 %/trim.
    // (110 %→197,5 %), soit 10 %/an constant.
    couponPa: 10,
  },
  observations: buildObservations(luxeObs, luxePay, {
    niveauRappelPct: (n) => (n <= 36 ? 100 : undefined),
    montantRemboursementPct: (n) => luxeRemb[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall Bonus',
  description: '10Y Autocall Bonus sur indice Luxe MerQube (décrément 50 pts) — rappel à 100 %, prime croissante 110 %→197,5 %, bonus final +100 % si ≥ 100 %, KI 60 % européen',
  badges: ['Décrément', 'Bonus', 'Autocall'],
  termsheetFichier: '250113_10Y_Autocall Bonus Luxe_Annuel_FRIP000014P8_MSCO.pdf',
}

// ── FR001400T985 — BNP Sphinx 15, CMS Steepener callable (capital garanti) ────
const bnpSphinx15: Product = {
  id: 'FR001400T985',
  nom: 'Sphinx 15 — CMS Steepener (capital garanti)',
  isin: 'FR001400T985',
  emetteur: 'BNP Paribas Issuance B.V.',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch A+',
  assetClass: 'rates',
  family: 'capital_protected',
  eusipa: '1140',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-12-02',
  dateEmission: '2024-12-02',
  dateConstatationFinale: '2037-03-31',
  dateEcheance: '2037-03-31',
  frequence: 'semestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'EUR CMS 30Y', marche: 'Reuters ICESWAP2' },
    { nom: 'EUR CMS 5Y', marche: 'Reuters ICESWAP2' },
  ],
  terms: {
    kind: 'rates',
    type: 'cms_steepener',
    tauxReference: 'EUR CMS 30Y',
    tauxReference2: 'EUR CMS 5Y',
    multiplicateur: 5,
    couponGarantiPct: 8,
    capitalGaranti: true,
    floorPct: 0,
    callable: true,
  },
  rr: 'LS',
  productType: 'CMS Steepener',
  description: '12Y Sphinx 15 — coupon 8 %/an les 3 premières années puis 500 % × (CMS30Y − CMS5Y) planché à 0 %, capital garanti à l’échéance, call émetteur semestriel',
  badges: ['Taux', 'Steepener', 'Capital garanti'],
  termsheetFichier: '241202_12Y_SPHINX 15_Semestriel_FR001400T985_BNP.pdf',
}

// ── FRIP00001UV3 — Morgan Stanley Quartz 51 Autocall BNP Décrément 4,2 pts ────
const q51Obs = ['2027-02-19','2027-05-19','2027-08-19','2027-11-19','2028-02-21','2028-05-19','2028-08-21','2028-11-20','2029-02-19','2029-05-21','2029-08-20','2029-11-19','2030-02-19','2030-05-20','2030-08-19','2030-11-19','2031-02-19','2031-05-19','2031-08-19','2031-11-19','2032-02-19','2032-05-19','2032-08-19','2032-11-19','2033-02-21','2033-05-19','2033-08-19','2033-11-21','2034-02-20','2034-05-19','2034-08-21','2034-11-20','2035-02-19','2035-05-21','2035-08-20','2035-11-19','2036-02-19','2036-05-19','2036-08-19','2036-11-19','2037-02-19','2037-05-19','2037-08-19','2037-11-19']
const q51Pay = ['2027-02-26','2027-05-26','2027-08-26','2027-11-26','2028-02-28','2028-05-26','2028-08-28','2028-11-27','2029-02-26','2029-05-28','2029-08-27','2029-11-26','2030-02-26','2030-05-27','2030-08-26','2030-11-26','2031-02-26','2031-05-26','2031-08-26','2031-11-26','2032-02-26','2032-05-26','2032-08-26','2032-11-26','2033-02-28','2033-05-26','2033-08-26','2033-11-28','2034-02-27','2034-05-26','2034-08-28','2034-11-27','2035-02-26','2035-05-28','2035-08-27','2035-11-26','2036-02-26','2036-05-26','2036-08-26','2036-11-26','2037-02-26','2037-05-26','2037-08-26','2037-11-26']
const q51Aer = [100,99.5,99,98.5,98,97.5,97,96.5,96,95.5,95,94.5,94,93.5,93,92.5,92,91.5,91,90.5,90,89.5,89,88.5,88,87.5,87,86.5,86,85.5,85,84.5,84,83.5,83,82.5,82,81.5,81,80.5,80,79.5,79,78.5]
const q51Remb = [113,116.25,119.5,122.75,126,129.25,132.5,135.75,139,142.25,145.5,148.75,152,155.25,158.5,161.75,165,168.25,171.5,174.75,178,181.25,184.5,187.75,191,194.25,197.5,200.75,204,207.25,210.5,213.75,217,220.25,223.5,226.75,230,233.25,236.5,239.75,243,246.25,249.5,252.75]
const msQuartz51: Product = {
  id: 'FRIP00001UV3',
  nom: 'Quartz 51 — Autocall BNP Décrément 4,2 pts',
  isin: 'FRIP00001UV3',
  emetteur: 'Morgan Stanley & Co International plc',
  notationEmetteur: 'S&P A+ / Moody’s Aa3 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-02-19',
  dateEmission: '2025-11-11',
  dateConstatationFinale: '2038-02-19',
  dateEcheance: '2038-02-26',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'MerQube BNP Paribas Class A 4.20 Point Decrement (EUR)', bloomberg: 'MQDBN420 Index' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: true,
    couponPa: 13,
    barriereRappelPct: 100,
    protectionPct: 40,
    protectionStyle: 'europeenne',
    decrement: '4,2 pts',
  },
  observations: buildObservations(q51Obs, q51Pay, {
    niveauRappelPct: (n) => q51Aer[n - 1],
    montantRemboursementPct: (n) => q51Remb[n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description: '12Y Quartz 51 — Autocall sur indice BNP décrément 4,2 pts (MerQube), barrière dégressive 100 %→78,5 %, prime croissante 113 %→252,75 %, bonus 256 % si ≥ 60 %, KI 40 % européen',
  badges: ['Décrément', 'Dégressif', 'Athena'],
  termsheetFichier: '251111_12Y_Quartz 51 BNP Decrement 4.2 pts_Trimestriel_FRIP00001UV3_MSCO.pdf',
}

// ── XS2110091449 — Citigroup Note Callable Zéro Coupon 15Y (≠ « FRN 5,35 % ») ─
//    TS du dossier (LIR006986) : zéro coupon, remboursement 180,25 % à terme,
//    call émetteur annuel dès 2027 (116,05 %→174,90 %). Le 5,35 % = TRI an 1.
const citiZcCallable: Product = {
  id: 'XS2110091449',
  nom: 'Note Callable Zéro Coupon Citigroup 15Y',
  isin: 'XS2110091449',
  emetteur: 'Citigroup Inc.',
  notationEmetteur: 'Moody’s A3 / S&P BBB+ / Fitch A',
  assetClass: 'rates',
  family: 'rates_structured',
  devise: 'EUR',
  nominal: 1_000_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-02-09',
  dateEmission: '2024-02-23',
  dateConstatationFinale: '2039-02-23',
  dateEcheance: '2039-02-23',
  frequence: 'in_fine',
  basket: 'single',
  sousJacents: [],
  terms: {
    kind: 'rates',
    type: 'callable',
    couponConditionnelPa: 0,
    capitalGaranti: false,
    callable: true,
  },
  rr: 'LS',
  productType: 'Callable Zéro Coupon',
  description: '15Y Note Citigroup callable zéro coupon — aucun coupon, remboursement 180,25 % à l’échéance (TRI ~5,35 % an 1), call émetteur annuel dès févr. 2027 (116,05 %→174,90 %)',
  badges: ['Taux', 'Zéro coupon', 'Callable'],
  termsheetFichier: '240223_15Y_Note Callable Zéro Coupon Citigroup_In Fine_XS2110091449_CITI.pdf',
}

// ══════ Termsheets décodés — Batches B & C (2026-06) ══════

// ── CH1322036596 — BIL Phoenix Mémoire Porsche AG (5Y trimestriel) ───────────
const bilPorscheObs = [
  '2024-07-19', '2024-10-21', '2025-01-20', '2025-04-22', '2025-07-21', '2025-10-20',
  '2026-01-19', '2026-04-20', '2026-07-20', '2026-10-19', '2027-01-19', '2027-04-19',
  '2027-07-19', '2027-10-19', '2028-01-19', '2028-04-19', '2028-07-19', '2028-10-19',
  '2029-01-19', '2029-04-19',
]
const bilPorschePay = [
  '2024-07-26', '2024-10-28', '2025-01-27', '2025-04-29', '2025-07-28', '2025-10-27',
  '2026-01-26', '2026-04-27', '2026-07-27', '2026-10-26', '2027-01-26', '2027-04-26',
  '2027-07-26', '2027-10-26', '2028-01-26', '2028-04-26', '2028-07-26', '2028-10-26',
  '2029-01-26', '2029-04-26',
]
const bilPorsche: Product = {
  id: 'CH1322036596',
  nom: 'BIL Phoenix Mémoire Porsche AG (5Y)',
  isin: 'CH1322036596',
  valor: '132203659',
  emetteur: 'Banque Internationale à Luxembourg (BIL)',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 250_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2024-04-19',
  dateEmission: '2024-04-26',
  dateConstatationFinale: '2029-04-19',
  dateEcheance: '2029-04-26',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'Porsche AG', bloomberg: 'P911 GY', marche: 'XETRA', niveauInitial: 89.92 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    couponPa: 10.62,
    barriereCouponPct: 80,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(bilPorscheObs, bilPorschePay, {
    niveauRappelPct: 100,
    montantRemboursementPct: 100,
    couponPct: 2.655,
    niveauCouponPct: 80,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire — Porsche AG · coupon 2,655 %/trim. (10,62 % p.a.) · mémoire · barrière 80 % · KI 60 % européenne',
  clients: ['ALVES - 06001'],
  badges: ['Single', 'Effet mémoire'],
  termsheetFichier: '240426_5Y_Phoenix Memory Porsche_Trimestriel_CH1322036596_BIL.pdf',
}

// ── FR1459ABB977 — GS Quartz 53 CA Décrement 1,10 pt (12Y trimestriel) ───────
const gsQuartz53Obs = [
  '2027-05-17', '2027-08-16', '2027-11-15', '2028-02-15', '2028-05-15', '2028-08-15',
  '2028-11-15', '2029-02-15', '2029-05-15', '2029-08-15', '2029-11-15', '2030-02-15',
  '2030-05-15', '2030-08-15', '2030-11-15', '2031-02-17', '2031-05-15', '2031-08-15',
  '2031-11-17', '2032-02-16', '2032-05-17', '2032-08-16', '2032-11-15', '2033-02-15',
  '2033-05-16', '2033-08-15', '2033-11-15', '2034-02-15', '2034-05-15', '2034-08-15',
  '2034-11-15', '2035-02-15', '2035-05-15', '2035-08-15', '2035-11-15', '2036-02-15',
  '2036-05-15', '2036-08-15', '2036-11-17', '2037-02-16', '2037-05-15', '2037-08-17',
  '2037-11-16', '2038-02-15', '2038-05-17',
]
const gsQuartz53Pay = [
  '2027-05-31', '2027-08-30', '2027-11-29', '2028-02-29', '2028-05-29', '2028-08-29',
  '2028-11-29', '2029-03-01', '2029-05-29', '2029-08-29', '2029-11-29', '2030-03-01',
  '2030-05-29', '2030-08-29', '2030-11-29', '2031-03-03', '2031-05-29', '2031-08-29',
  '2031-12-01', '2032-03-01', '2032-05-31', '2032-08-30', '2032-11-29', '2033-03-01',
  '2033-05-30', '2033-08-29', '2033-11-29', '2034-03-01', '2034-05-29', '2034-08-29',
  '2034-11-29', '2035-03-01', '2035-05-29', '2035-08-29', '2035-11-29', '2036-02-29',
  '2036-05-29', '2036-08-29', '2036-12-01', '2037-03-02', '2037-05-29', '2037-08-31',
  '2037-11-30', '2038-03-01', '2038-05-31',
]
const gsQuartz53: Product = {
  id: 'FR1459ABB977',
  nom: 'GS Quartz 53 — CA Décrement 1,10 pt (12Y)',
  isin: 'FR1459ABB977',
  valor: '149051828',
  emetteur: 'Goldman Sachs Finance Corp International Ltd',
  garant: 'The Goldman Sachs Group, Inc.',
  notationEmetteur: "Moody's A2 / S&P BBB+ / Fitch A",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2026-05-15',
  dateEmission: '2026-01-20',
  dateConstatationFinale: '2038-05-17',
  dateEcheance: '2038-05-31',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'SGACA110 Index (CA décrément 1,10 pt/an)', bloomberg: 'SGACA110 Index' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereRappelPct: 100,
    protectionPct: 40,
    protectionStyle: 'europeenne',
    decrement: 'Décrément 1,10 pt/an',
  },
  observations: buildObservations(gsQuartz53Obs, gsQuartz53Pay, {
    niveauRappelPct: (n) => (n < 45 ? 100 : 60),
    montantRemboursementPct: (n) => 114.5 + (n - 1) * 3.625,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall décrément',
  description: '12Y Autocall Quartz 53 — CA décrément 1,10 pt · montant croissant 114,5%→274% · KI 40% européenne',
  badges: ['Single', 'Décrément'],
  termsheetFichier: '260120_12Y_Quartz 53 CA Decrement 1.1 pts_Trimestriel_FR1459ABB977_GS.pdf',
}

// ── FRIP00001G19 — MSCO Quartz 45 ENI Décrement 0,96 pt (12Y trimestriel) ────
const msQuartz45Obs = [
  '2026-08-14', '2026-11-16', '2027-02-15', '2027-05-14', '2027-08-16', '2027-11-15',
  '2028-02-14', '2028-05-15', '2028-08-14', '2028-11-14', '2029-02-14', '2029-05-14',
  '2029-08-14', '2029-11-14', '2030-02-14', '2030-05-14', '2030-08-14', '2030-11-14',
  '2031-02-14', '2031-05-14', '2031-08-14', '2031-11-14', '2032-02-16', '2032-05-14',
  '2032-08-16', '2032-11-15', '2033-02-14', '2033-05-16', '2033-08-16', '2033-11-14',
  '2034-02-14', '2034-05-15', '2034-08-14', '2034-11-14', '2035-02-14', '2035-05-14',
  '2035-08-14', '2035-11-14', '2036-02-14', '2036-05-14', '2036-08-14', '2036-11-14',
  '2037-02-16', '2037-05-14',
]
const msQuartz45Pay = [
  '2026-08-21', '2026-11-23', '2027-02-22', '2027-05-21', '2027-08-23', '2027-11-22',
  '2028-02-21', '2028-05-22', '2028-08-21', '2028-11-21', '2029-02-21', '2029-05-21',
  '2029-08-21', '2029-11-21', '2030-02-21', '2030-05-21', '2030-08-21', '2030-11-21',
  '2031-02-21', '2031-05-21', '2031-08-21', '2031-11-21', '2032-02-23', '2032-05-21',
  '2032-08-23', '2032-11-22', '2033-02-21', '2033-05-23', '2033-08-23', '2033-11-21',
  '2034-02-21', '2034-05-22', '2034-08-21', '2034-11-21', '2035-02-21', '2035-05-21',
  '2035-08-21', '2035-11-21', '2036-02-21', '2036-05-21', '2036-08-21', '2036-11-21',
  '2037-02-23', '2037-05-21',
]
const msQuartz45: Product = {
  id: 'FRIP00001G19',
  nom: 'MSCO Quartz 45 — ENI Décrement 0,96 pt (12Y)',
  isin: 'FRIP00001G19',
  emetteur: 'Morgan Stanley & Co. International plc',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-08-14',
  dateEmission: '2025-04-25',
  dateConstatationFinale: '2037-08-14',
  dateEcheance: '2037-08-21',
  frequence: 'trimestriel',
  basket: 'single',
  sousJacents: [
    { nom: 'Solactive ENI AR 0.96 Index', bloomberg: 'SOENI096 Index' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereRappelPct: 100,
    protectionPct: 40,
    protectionStyle: 'europeenne',
    decrement: 'Décrément 0,96 pt/an',
  },
  observations: buildObservations(msQuartz45Obs, msQuartz45Pay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => 119 + (n - 1) * 4.75,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall décrément',
  description: '12Y Autocall Quartz 45 ENI — décrément 0,96 pt · montant croissant 119%→323,25% · KI 40% européenne',
  badges: ['Single', 'Décrément'],
  termsheetFichier: '250425_12Y_Quartz 45 ENI Decrement 0.96 pts_Trimestriel_FRIP00001G19_MSCO.pdf',
}

// ── FR1459ABG521 — GS Phoenix Mémoire Basket 50 Points DIV (12Y mensuel) ─────
const gsBasket50DivObs = [
  '2026-10-21', '2026-11-23', '2026-12-21', '2027-01-21', '2027-02-22', '2027-03-22',
  '2027-04-21', '2027-05-21', '2027-06-21', '2027-07-21', '2027-08-23', '2027-09-21',
]
const gsBasket50DivPay = [
  '2026-11-04', '2026-12-07', '2027-01-06', '2027-02-04', '2027-03-08', '2027-04-07',
  '2027-05-05', '2027-06-04', '2027-07-05', '2027-08-04', '2027-09-06', '2027-10-05',
]
const gsBasket50Div: Product = {
  id: 'FR1459ABG521',
  nom: 'GS Phoenix Mémoire MXCPFB50 — Basket 50 Pts DIV (12Y)',
  isin: 'FR1459ABG521',
  valor: '156026129',
  emetteur: 'Goldman Sachs Finance Corp International Ltd',
  garant: 'The Goldman Sachs Group, Inc.',
  notationEmetteur: "Moody's A2 / S&P BBB+ / Fitch A",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2026-06-15',
  dateEmission: '2026-06-11',
  dateConstatationFinale: '2038-09-21',
  dateEcheance: '2038-10-05',
  frequence: 'mensuel',
  basket: 'single',
  sousJacents: [
    { nom: 'MSCI ACWI IMI Copper & Power 20 Fixed Basket 50 Pts DIV EUR', bloomberg: 'MXCPFB50 Index' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 8.0004,
    barriereCouponPct: 70,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    decrement: 'Décrément 50 pts/an',
  },
  observations: buildObservations(gsBasket50DivObs, gsBasket50DivPay, {
    niveauRappelPct: (n) => (n < 12 ? undefined : 100),
    montantRemboursementPct: 100,
    couponPct: 0.6667,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 12,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '12Y Phoenix Mémoire MXCPFB50 — décrément 50 pts · coupon 0,6667 %/mois (8 % p.a.) · mémoire · barrière coupon 70 % · autocall dégressif 100→70 % · KI 50 % européenne',
  clients: ['RENAUD GESTION PRIVEE'],
  badges: ['Single', 'Décrément', 'Dégressif', 'Effet mémoire', 'Mensuel'],
  termsheetFichier: '260611_12Y_Phoenix Mémoire Basket 50 Points DIV EUR_Mensuel_FR1459ABG521_GS.pdf',
}

// ── XS3149199807 — Santander Athena Airbag Dégressif BNP+Intesa+CA (5Y mensuel)
const santanderAirbagObs49 = [
  '2026-10-08', '2026-11-09', '2026-12-08', '2027-01-08', '2027-02-08', '2027-03-08',
  '2027-04-08', '2027-05-10', '2027-06-08', '2027-07-08', '2027-08-09', '2027-09-08',
  '2027-10-08', '2027-11-08', '2027-12-08', '2028-01-10', '2028-02-08', '2028-03-08',
  '2028-04-10', '2028-05-08', '2028-06-08', '2028-07-10', '2028-08-08', '2028-09-08',
  '2028-10-09', '2028-11-08', '2028-12-08', '2029-01-08', '2029-02-08', '2029-03-08',
  '2029-04-09', '2029-05-08', '2029-06-08', '2029-07-09', '2029-08-08', '2029-09-10',
  '2029-10-08', '2029-11-08', '2029-12-10', '2030-01-08', '2030-02-08', '2030-03-08',
  '2030-04-08', '2030-05-08', '2030-06-10', '2030-07-08', '2030-08-08', '2030-09-09',
  '2030-10-08',
]
const santanderAirbagPay49 = [
  '2026-10-21', '2026-11-23', '2026-12-21', '2027-01-21', '2027-02-22', '2027-03-22',
  '2027-04-21', '2027-05-21', '2027-06-21', '2027-07-21', '2027-08-23', '2027-09-21',
  '2027-10-21', '2027-11-22', '2027-12-21', '2028-01-21', '2028-02-21', '2028-03-21',
  '2028-04-21', '2028-05-22', '2028-06-21', '2028-07-21', '2028-08-21', '2028-09-21',
  '2028-10-23', '2028-11-21', '2028-12-21', '2029-01-22', '2029-02-21', '2029-03-21',
  '2029-04-23', '2029-05-21', '2029-06-21', '2029-07-23', '2029-08-21', '2029-09-21',
  '2029-10-22', '2029-11-21', '2029-12-21', '2030-01-21', '2030-02-21', '2030-03-21',
  '2030-04-23', '2030-05-21', '2030-06-21', '2030-07-22', '2030-08-21', '2030-09-23',
  '2030-10-21',
]
const santanderAirbagBnpIntesaCa: Product = {
  id: 'XS3149199807',
  nom: 'Santander Athena Airbag Dégressif BNP+Intesa+CA (5Y)',
  isin: 'XS3149199807',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: "S&P A+ / Moody's A1 / Fitch A",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-10-08',
  dateEmission: '2025-10-22',
  dateConstatationFinale: '2030-10-08',
  dateEcheance: '2030-10-21',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Crédit Agricole SA', bloomberg: 'ACA FP', niveauInitial: 16.48 },
    { nom: 'BNP Paribas SA', bloomberg: 'BNP FP', niveauInitial: 75.2 },
    { nom: 'Intesa Sanpaolo SpA', bloomberg: 'ISP IM', niveauInitial: 5.542 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    airbag: true,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(santanderAirbagObs49, santanderAirbagPay49, {
    niveauRappelPct: (n) => (n < 49 ? Math.max(50, 100.5 - n * 0.5) : 50),
    montantRemboursementPct: (n) => 100 + (n + 11) * 0.875,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena Airbag',
  description: '5Y Athena Airbag Dégressif Wof BNP+Intesa+CA — 49 obs mensuelles · montant cumulatif 0,875%/mois · AER dégressif 100→50% · airbag 50% européen',
  clients: ['ALVES - 06001'],
  badges: ['Worst-of', 'Airbag', 'Dégressif', 'Mensuel'],
  termsheetFichier: '251022_5Y_Athena Airbag Dégressif BNP + Intesa + Crédit Agricole_Mensuel_XS3149199807_SANTANDER.pdf',
}

// ── XS3149213053 — Santander Athena Airbag Dégressif ASML+SGO+TTE (5Y mensuel)
const santanderAirbagAsmlSgoTte: Product = {
  id: 'XS3149213053',
  nom: 'Santander Athena Airbag Dégressif ASML+SGO+TTE (5Y)',
  isin: 'XS3149213053',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  notationEmetteur: "S&P A+ / Moody's A1 / Fitch A",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-10-08',
  dateEmission: '2025-10-22',
  dateConstatationFinale: '2030-10-08',
  dateEcheance: '2030-10-21',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'ASML Holding NV', bloomberg: 'ASML NA', niveauInitial: 851.8 },
    { nom: 'Compagnie de Saint-Gobain', bloomberg: 'SGO FP', niveauInitial: 89.78 },
    { nom: 'TotalEnergies SE', bloomberg: 'TTE FP', niveauInitial: 51.12 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    airbag: true,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(santanderAirbagObs49, santanderAirbagPay49, {
    niveauRappelPct: (n) => (n < 49 ? Math.max(50, 100.5 - n * 0.5) : 50),
    montantRemboursementPct: (n) => 100 + (n + 11) * (10.7004 / 12),
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena Airbag',
  description: '5Y Athena Airbag Dégressif Wof ASML+Saint-Gobain+TTE — montant cumulatif 10,70%/an · AER dégressif 100→50% · airbag 50% européen',
  clients: ['ALVES - 06001'],
  badges: ['Worst-of', 'Airbag', 'Dégressif', 'Mensuel'],
  termsheetFichier: '251022_5Y_Athena Airbag Dégressif ASML + Saint-Gobain + TotalEnergies_Mensuel_XS3149213053_SANTANDER.pdf',
}

// ── XS2922143750 — Santander Athena Bearish NDX100 (3Y mensuel, inverse) ──────
const santanderBearishNdxObs = [
  '2025-05-22', '2025-06-23', '2025-07-22', '2025-08-22', '2025-09-22', '2025-10-22',
  '2025-11-24', '2025-12-22', '2026-01-22', '2026-02-23', '2026-03-23', '2026-04-22',
  '2026-05-22', '2026-06-22', '2026-07-22', '2026-08-24', '2026-09-22', '2026-10-22',
  '2026-11-23', '2026-12-22', '2027-01-22', '2027-02-22', '2027-03-22', '2027-04-22',
  '2027-05-24', '2027-06-22', '2027-07-22', '2027-08-23', '2027-09-22', '2027-10-22',
  '2027-11-22',
]
const santanderBearishNdxPay = [
  '2025-05-29', '2025-06-30', '2025-07-29', '2025-08-29', '2025-09-29', '2025-10-29',
  '2025-11-28', '2025-12-29', '2026-01-29', '2026-02-27', '2026-03-30', '2026-04-29',
  '2026-05-29', '2026-06-29', '2026-07-29', '2026-08-31', '2026-09-29', '2026-10-29',
  '2026-11-30', '2026-12-29', '2027-01-29', '2027-02-26', '2027-03-30', '2027-04-29',
  '2027-05-31', '2027-06-29', '2027-07-29', '2027-08-30', '2027-09-29', '2027-10-29',
  '2027-11-29',
]
const santanderBearishNdx: Product = {
  id: 'XS2922143750',
  nom: 'Santander Athena Bearish NASDAQ-100 (3Y)',
  isin: 'XS2922143750',
  emetteur: 'Santander International Products Plc',
  garant: 'Banco Santander S.A.',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 270_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2024-11-22',
  dateEmission: '2024-11-06',
  dateConstatationFinale: '2027-11-22',
  dateEcheance: '2027-11-29',
  frequence: 'mensuel',
  basket: 'single',
  sousJacents: [
    { nom: 'NASDAQ-100 Index', bloomberg: 'NDX Index', niveauInitial: 20383.65 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'inverse',
    effetMemoire: false,
    couponPa: 27,
    barriereRappelPct: 100,
    protectionPct: 150,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(santanderBearishNdxObs, santanderBearishNdxPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: 100,
    couponPct: (n) => 4.5 + (n - 1) * 0.75,
    niveauCouponPct: 100,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena Bearish',
  description: "3Y Athena Bearish (inverse) — NASDAQ-100 · coupon 4,5%→27% (×0,75%/mois) · autocall si NDX ≤ 100% · capital à risque si NDX > 150%",
  clients: ['WEALTHOF - 06005'],
  badges: ['Single', 'Inverse', 'Bearish'],
  termsheetFichier: '241106_5Y_Athéna Bearish NDX100_Mensuel_XS2922143750_SANTANDER.pdf',
}

// ── XS2925309945 — Marex MSTR Classic Autocall (5Y mensuel, sans coupon) ──────
const marexMstrObs = [
  '2026-06-30', '2026-07-30', '2026-08-31', '2026-09-30', '2026-10-30', '2026-11-30',
  '2026-12-30', '2027-02-01', '2027-03-01', '2027-03-30', '2027-04-30', '2027-06-01',
  '2027-06-30', '2027-07-30', '2027-08-30', '2027-09-30', '2027-11-01', '2027-11-30',
  '2027-12-30', '2028-01-31', '2028-02-29', '2028-03-30', '2028-05-01', '2028-05-30',
  '2028-06-30', '2028-07-31', '2028-08-30', '2028-10-02', '2028-10-30', '2028-11-30',
  '2029-01-02', '2029-01-30', '2029-02-28', '2029-04-02', '2029-04-30', '2029-05-30',
  '2029-07-02', '2029-07-30', '2029-08-30', '2029-10-01', '2029-10-30', '2029-11-30',
  '2029-12-31', '2030-01-30', '2030-02-28', '2030-04-01', '2030-04-30', '2030-05-30',
  '2030-07-01',
]
const marexMstrPay = [
  '2026-07-08', '2026-08-06', '2026-09-08', '2026-10-07', '2026-11-06', '2026-12-07',
  '2027-01-07', '2027-02-08', '2027-03-08', '2027-04-06', '2027-05-07', '2027-06-08',
  '2027-07-08', '2027-08-06', '2027-09-07', '2027-10-07', '2027-11-08', '2027-12-07',
  '2028-01-06', '2028-02-07', '2028-03-07', '2028-04-06', '2028-05-08', '2028-06-06',
  '2028-07-10', '2028-08-07', '2028-09-07', '2028-10-10', '2028-11-06', '2028-12-07',
  '2029-01-09', '2029-02-06', '2029-03-07', '2029-04-09', '2029-05-07', '2029-06-06',
  '2029-07-10', '2029-08-06', '2029-09-07', '2029-10-09', '2029-11-06', '2029-12-07',
  '2030-01-08', '2030-02-06', '2030-03-07', '2030-04-08', '2030-05-07', '2030-06-06',
  '2030-07-09',
]
const marexMstr: Product = {
  id: 'XS2925309945',
  nom: 'Marex Classic Autocall MicroStrategy (5Y)',
  isin: 'XS2925309945',
  notationEmetteur: 'BBB (S&P)',
  emetteur: 'Marex Financial Products plc',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-06-30',
  dateEmission: '2025-07-15',
  dateConstatationFinale: '2030-07-01',
  dateEcheance: '2030-07-09',
  frequence: 'mensuel',
  basket: 'single',
  sousJacents: [
    { nom: 'MicroStrategy Inc.', bloomberg: 'MSTR UW', marche: 'NASDAQ', niveauInitial: 404.23 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
    // Snowball sans coupon périodique : prime de rappel +1,125 %/mois
    // (113,5 %→167,5 %), soit 13,5 %/an constant.
    couponPa: 13.5,
  },
  observations: buildObservations(marexMstrObs, marexMstrPay, {
    niveauRappelPct: (n) => (n < 49 ? 100 : 50),
    montantRemboursementPct: (n) => 113.5 + (n - 1) * 1.125,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall',
  description: "5Y Classic Autocall (Barrier Express) — MicroStrategy · montant croissant 113,5%→167,5% · autocall 100% · KI 50% européenne · sans coupon périodique",
  clients: ['ALVES - 06001'],
  badges: ['Single', 'Snowball'],
  termsheetFichier: '250715_5Y_Autocall Airbag MSTR_Mensuel_XS2925309945_MAREX.pdf',
}

// ── XS2925309275 — Marex Classic Autocall Airbag Wof MONC+MC+VSCO (5Y mensuel)
// Termsheet : "5Y Autocall Airbag Wof MONC + MC + VSCO Mensuel".
// Structure : Snowball (montant de remboursement croissant 113,5 %→167,5 %) +
// Airbag capital à la barrière basse (50 %). Autocall ≥ 80 % sur obs 1–48 ;
// obs 49 (maturité) : remboursement Snowball max si worst ≥ 50 %, sinon airbag.
// Pas de coupon périodique. Non-call première année : premier obs = mois 12.
const marexMoncMcVsco: Product = {
  id: 'XS2925309275',
  nom: "Marex Classic Autocall Wof Moncler+LVMH+Victoria's Secret (5Y)",
  isin: 'XS2925309275',
  notationEmetteur: 'BBB (S&P)',
  emetteur: 'Marex Financial Products plc',
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-06-30',
  dateEmission: '2025-07-15',
  dateConstatationFinale: '2030-07-01',
  dateEcheance: '2030-07-09',
  frequence: 'mensuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Moncler SpA', bloomberg: 'MONC IM', marche: 'Borsa Italiana', niveauInitial: 48.39 },
    { nom: 'LVMH Moët Hennessy Louis Vuitton', bloomberg: 'MC FP', marche: 'Euronext Paris', niveauInitial: 444.60 },
    { nom: "Victoria's Secret & Company", bloomberg: 'VSCO UN', marche: 'NYSE', niveauInitial: 18.52 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereRappelPct: 80,       // barrière autocall principale (obs 1–48)
    protectionPct: 50,           // KI / airbag (obs 49 = maturité)
    protectionStyle: 'europeenne',
    airbag: true,                // protection Airbag : capital × worst / 50 % si KI
    // Snowball sans coupon périodique : la prime de rappel croît de 1,125 %/mois
    // (113,5 %→167,5 %), soit 13,5 %/an constant — c'est le « coupon » indicatif.
    couponPa: 13.5,
  },
  observations: buildObservations(marexMstrObs, marexMstrPay, {
    niveauRappelPct: (n) => (n < 49 ? 80 : 50),  // autocall 80 % ; maturité 50 %
    montantRemboursementPct: (n) => 113.5 + (n - 1) * 1.125,  // 113,5 %→167,5 %
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall',
  description: "5Y Classic Autocall Airbag Wof — Moncler + LVMH + Victoria's Secret · montant croissant 113,5 %→167,5 % · autocall ≥ 80 % · KI Airbag 50 % européenne · sans coupon périodique",
  clients: ['ALVES - 06001'],
  badges: ['Worst-of', 'Snowball', 'Airbag'],
  termsheetFichier: '250715_5Y_Autocall Airbag Wof MONC + MC + VSCO_Mensuel_XS2925309275_MAREX.pdf',
}

// ── XS3266613416 — BNP Phoenix Snowball Wof "Réarmement Europe" (5Y trim.) ────
// Réf. CE8664MDY. Strike/Trade 12/02/2026, Emission 26/02/2026, Constatation
// finale 12/02/2031. Coupon mémoire 2,45 %/trim. (×(1+T)), barrière coupon 65 %.
// Autocall dégressif : 89 % à T+1Y (obs 4) puis −1,5 %/trim. jusqu'à 66,5 %
// (obs 19) ; pas d'autocall sur obs 1-3 ni sur l'observation finale (obs 20).
// KI finale (PDI) 50 % européenne.
const bnpRearmementObs = [
  '2026-05-12', '2026-08-12', '2026-11-12', '2027-02-12', '2027-05-12', '2027-08-12',
  '2027-11-12', '2028-02-14', '2028-05-12', '2028-08-14', '2028-11-13', '2029-02-12',
  '2029-05-14', '2029-08-13', '2029-11-12', '2030-02-12', '2030-05-13', '2030-08-12',
  '2030-11-12', '2031-02-12',
]
const bnpRearmementPay = [
  '2026-05-26', '2026-08-26', '2026-11-26', '2027-02-26', '2027-05-26', '2027-08-26',
  '2027-11-26', '2028-02-28', '2028-05-26', '2028-08-28', '2028-11-27', '2029-02-26',
  '2029-05-28', '2029-08-27', '2029-11-26', '2030-02-26', '2030-05-27', '2030-08-26',
  '2030-11-26', '2031-02-26',
]
const bnpRearmement: Product = {
  id: 'XS3266613416',
  nom: 'BNP Phoenix Mémoire Wof "Réarmement Europe" (5Y)',
  isin: 'XS3266613416',
  valor: '153203534',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: "S&P A+ / Moody's A1 / Fitch AA-",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2026-02-12',
  dateEmission: '2026-02-26',
  dateConstatationFinale: '2031-02-12',
  dateEcheance: '2031-02-26',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Leonardo SpA', bloomberg: 'LDO IM', niveauInitial: 53.26 },
    { nom: 'Rheinmetall AG', bloomberg: 'RHM GY', niveauInitial: 1579.50 },
    { nom: 'Safran SA', bloomberg: 'SAF FP', niveauInitial: 307.30 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    couponPa: 9.8,
    barriereCouponPct: 65,
    barriereRappelPct: 89,
    degressif: true,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(bnpRearmementObs, bnpRearmementPay, {
    niveauRappelPct: (n) => (n >= 4 && n <= 19 ? 89 - (n - 4) * 1.5 : undefined),
    montantRemboursementPct: (n) => (n >= 4 && n <= 19 ? 100 : undefined),
    couponPct: 2.45,
    niveauCouponPct: 65,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof — Réarmement Europe (Leonardo / Rheinmetall / Safran) · coupon 2,45 %/trim. (9,8 % p.a.) · mémoire · barrière coupon 65 % · autocall 89 % dégr. −1,5 %/T (dès T+1Y) · KI 50 % européenne',
  clients: ['SAMY - 01674'],
  badges: ['Worst-of', 'Effet mémoire', 'Dégressif'],
  termsheetFichier: '260226_5Y_Phoenix Rearmement Europe_Trimestriel_XS3266613416_BNP.pdf',
}

// ── XS3266613333 — BNP Phoenix Snowball Wof "Ferroviaires + Infra" (5Y trim.) ─
// Réf. CE8663MDY. Strike/Trade 12/02/2026, Emission 26/02/2026, Constatation
// finale 12/02/2031. Coupon mémoire 2,55 %/trim. (×(1+T)), barrière coupon 70 %.
// Autocall dégressif : 94 % à T+1Y (obs 4) puis −1,5 %/trim. jusqu'à 71,5 %
// (obs 19) ; pas d'autocall sur obs 1-3 ni sur l'observation finale (obs 20).
// KI finale (PDI) 50 % européenne.
const bnpFerroviairesObs = bnpRearmementObs
const bnpFerroviairesPay = bnpRearmementPay
const bnpFerroviaires: Product = {
  id: 'XS3266613333',
  nom: 'BNP Phoenix Mémoire Wof "Ferroviaires + Infrastructures" (5Y)',
  isin: 'XS3266613333',
  valor: '153203533',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: "S&P A+ / Moody's A1 / Fitch AA-",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 300_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2026-02-12',
  dateEmission: '2026-02-26',
  dateConstatationFinale: '2031-02-12',
  dateEcheance: '2031-02-26',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Alstom SA', bloomberg: 'ALO FP', niveauInitial: 29.24 },
    { nom: 'Siemens AG-REG', bloomberg: 'SIE GY', niveauInitial: 257.00 },
    { nom: 'Thales SA', bloomberg: 'HO FP', niveauInitial: 246.70 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    couponPa: 10.2,
    barriereCouponPct: 70,
    barriereRappelPct: 94,
    degressif: true,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(bnpFerroviairesObs, bnpFerroviairesPay, {
    niveauRappelPct: (n) => (n >= 4 && n <= 19 ? 94 - (n - 4) * 1.5 : undefined),
    montantRemboursementPct: (n) => (n >= 4 && n <= 19 ? 100 : undefined),
    couponPct: 2.55,
    niveauCouponPct: 70,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Wof — Ferroviaires + Infra (Alstom / Siemens / Thales) · coupon 2,55 %/trim. (10,2 % p.a.) · mémoire · barrière coupon 70 % · autocall 94 % dégr. −1,5 %/T (dès T+1Y) · KI 50 % européenne',
  clients: ['SAMY - 01674'],
  badges: ['Worst-of', 'Effet mémoire', 'Dégressif'],
  termsheetFichier: '260226_5Y_Phoenix Ferroviaires + Infra_Trimestriel_XS3266613333_BNP.pdf',
}

// ── XS2769472221 — GS "Leaders 7%" Autocall équipondéré Veolia/Eramet/LVMH ────
// (5Y annuel). EUSIPA 1260 (BRC à coupon conditionnel — ici sans coupon, payoff
// snowball : Early Redemption Value croissante 107 %→135 %). Initial Fixing
// 09/07/2025, Emission 13/06/2025, Final Fixing 09/07/2030, Remb. 23/07/2030.
// Trigger dégressif 100 %→94 %, autocall dès T+1Y (5 observations annuelles).
// Barrière finale (PDI) 65 % européenne.
const gsVeoliaErametLvmhObs = [
  '2026-07-09', '2027-07-09', '2028-07-10', '2029-07-09', '2030-07-09',
]
const gsVeoliaErametLvmhPay = [
  '2026-07-23', '2027-07-23', '2028-07-24', '2029-07-23', '2030-07-23',
]
const gsVeoliaErametLvmh: Product = {
  id: 'XS2769472221',
  nom: 'GS "Leaders 7%" Autocall équipondéré Veolia + Eramet + LVMH (5Y)',
  isin: 'XS2769472221',
  valor: '134740114',
  emetteur: 'Goldman Sachs Finance Corp International Ltd',
  garant: 'The Goldman Sachs Group, Inc.',
  notationEmetteur: "Moody's A2 / S&P BBB+ / Fitch A",
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260',
  devise: 'EUR',
  nominal: 30_000_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-07-09',
  dateEmission: '2025-06-13',
  dateConstatationFinale: '2030-07-09',
  dateEcheance: '2030-07-23',
  frequence: 'annuel',
  basket: 'equipondere',
  sousJacents: [
    { nom: 'Eramet SA', bloomberg: 'ERA FP', isin: 'FR0000131757', marche: 'Euronext Paris', niveauInitial: 47.7 },
    { nom: 'LVMH Moët Hennessy Louis Vuitton SE', bloomberg: 'MC FP', isin: 'FR0000121014', marche: 'Euronext Paris', niveauInitial: 487.85 },
    { nom: 'Veolia Environnement S.A.', bloomberg: 'VIE FP', isin: 'FR0000124141', marche: 'Euronext Paris', niveauInitial: 30.61 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereRappelPct: 100,
    degressif: true,
    protectionPct: 65,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(gsVeoliaErametLvmhObs, gsVeoliaErametLvmhPay, {
    niveauRappelPct: (n) => [100, 98.5, 97, 95.5, 94][n - 1],
    montantRemboursementPct: (n) => [107, 114, 121, 128, 135][n - 1],
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall',
  description: '5Y Autocall équipondéré — Veolia + Eramet + LVMH (GS "Leaders 7%") · montant croissant 107 %→135 % · trigger 100 % dégr. → 94 % · KI 65 % européenne · sans coupon périodique',
  clients: ['SPG - 05774'],
  badges: ['Équipondéré', 'Snowball', 'Dégressif'],
  termsheetFichier: '250613_5Y_Autocall Equipondéré Veolia + Eramet + LVMH_Annuel_XS2769472221_GS.pdf',
}

// ── FR0014013N00 — BNP Autocall équipondéré Schneider/Siemens Energy/Bouygues ─
// (6Y semestriel). Réf. EI2565MDY. Négociation 15/10/2025, Emission 27/10/2025,
// Constatation initiale 28/11/2025, Constatation finale 28/11/2031, Remb. final
// 12/12/2031. Autocall semestriel à 100 % (10 obs dès T+1Y), montant croissant
// 107 %→138,5 % (N×[103,5 % + n×3,5 %]). Remb. final : 142 % si panier ≥ 100 %,
// 100 % si entre la barrière 60 % et 100 %, sinon perte (KI 60 % européenne).
// Sans coupon périodique.
const bnpSchneiderEnrBouyObs = [
  '2026-11-30', '2027-05-28', '2027-11-29', '2028-05-29', '2028-11-28',
  '2029-05-28', '2029-11-28', '2030-05-28', '2030-11-28', '2031-05-28',
]
const bnpSchneiderEnrBouyPay = [
  '2026-12-14', '2027-06-11', '2027-12-13', '2028-06-12', '2028-12-12',
  '2029-06-11', '2029-12-12', '2030-06-11', '2030-12-12', '2031-06-11',
]
const bnpSchneiderEnrBouy: Product = {
  id: 'FR0014013N00',
  nom: 'BNP Autocall équipondéré Schneider + Siemens Energy + Bouygues (6Y)',
  isin: 'FR0014013N00',
  valor: '149445133',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: "S&P A+ / Moody's A1 / Fitch AA-",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 650_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-11-28',
  dateEmission: '2025-10-27',
  dateConstatationFinale: '2031-11-28',
  dateEcheance: '2031-12-12',
  frequence: 'semestriel',
  basket: 'equipondere',
  sousJacents: [
    { nom: 'Schneider Electric SE', bloomberg: 'SU FP', niveauInitial: 231.00 },
    { nom: 'Bouygues SA', bloomberg: 'EN FP', niveauInitial: 43.02 },
    { nom: 'Siemens Energy AG', bloomberg: 'ENR GY', niveauInitial: 115.30 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
    bonusFinalPct: 142,
  },
  observations: buildObservations(bnpSchneiderEnrBouyObs, bnpSchneiderEnrBouyPay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => 103.5 + n * 3.5,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Autocall',
  description: '6Y Autocall équipondéré — Schneider + Siemens Energy + Bouygues · autocall 100 % semestriel · montant croissant 107 %→138,5 % · remb. final 142 % si panier ≥ 100 % · KI 60 % européenne · sans coupon périodique',
  clients: ['SPG - 05774'],
  badges: ['Équipondéré', 'Snowball'],
  termsheetFichier: '251027_6Y_Autocall Equipondéré Schneider + Siemens Energy + Bouygues_Semestriel_FR0014013N00_BNP.pdf',
}

// ── XS2953818841 — CIBC Athena Wof Microsoft + Alphabet (3Y trim.) ────────────
// Réf. SN7651DB. Strike/Trade 05/02/2025, Emission 19/02/2025, Valuation
// 07/02/2028, Maturité 21/02/2028. 12 obs trimestrielles. Coupon 3,15 % × t
// (t = numéro de période, obs 4 à 12), barrière coupon 100 %.
// Autocall 100 % à partir de l'obs 4 (T+1Y) ; obs 1-3 sans rappel ni coupon.
// KI finale 70 % européenne. Sous-jacents en USD (note en EUR, FX final).
const cibcMsftGooglObs = [
  '2025-05-05', '2025-08-05', '2025-11-05', '2026-02-05', '2026-05-05', '2026-08-05',
  '2026-11-05', '2027-02-05', '2027-05-05', '2027-08-05', '2027-11-05', '2028-02-07',
]
const cibcMsftGooglPay = [
  '2025-05-19', '2025-08-19', '2025-11-19', '2026-02-19', '2026-05-19', '2026-08-19',
  '2026-11-19', '2027-02-19', '2027-05-19', '2027-08-19', '2027-11-19', '2028-02-21',
]
const cibcMsftGoogl: Product = {
  id: 'XS2953818841',
  nom: 'CIBC Athena Wof Microsoft + Alphabet (3Y)',
  isin: 'XS2953818841',
  valor: '117039154',
  emetteur: 'Canadian Imperial Bank of Commerce',
  notationEmetteur: "Moody's Aa2 / S&P A+ / Fitch AA",
  assetClass: 'equity',
  family: 'autocall',
  devise: 'EUR',
  nominal: 500_000,
  valeurNominale: 1000,
  dateConstatationInitiale: '2025-02-05',
  dateEmission: '2025-02-19',
  dateConstatationFinale: '2028-02-07',
  dateEcheance: '2028-02-21',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Microsoft Corp', bloomberg: 'MSFT UW', devise: 'USD', niveauInitial: 413.2900 },
    { nom: 'Alphabet Inc', bloomberg: 'GOOGL UW', devise: 'USD', niveauInitial: 191.3300 },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    barriereCouponPct: 100,
    barriereRappelPct: 100,
    protectionPct: 70,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(cibcMsftGooglObs, cibcMsftGooglPay, {
    niveauRappelPct: (n) => (n >= 4 && n <= 11 ? 100 : undefined),
    montantRemboursementPct: (n) => (n >= 4 && n <= 11 ? 100 : undefined),
    couponPct: (n) => (n >= 4 ? 3.15 * n : undefined),
    niveauCouponPct: 100,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Athena',
  description: '3Y Athena Wof — Microsoft + Alphabet (CIBC) · coupon 3,15 % × t (dès T+1Y) · barrière coupon/autocall 100 % · autocall dès T+1Y · KI 70 % européenne',
  badges: ['Worst-of', 'Athena'],
  termsheetFichier: '250219_3Y_Athena Wof MSFT + GOOGL_Trimestriel_XS2953818841_CIBC.pdf',
}

// ── Barclays — Phoenix Mémoire Dégressif Bancaires FR (Wof BNP + ACA + GLE) ──
//    Décodé de la termsheet indicative (19/06/2026, Série NX00600160 / Tr.1).
//    20 constatations trimestrielles, non-call 1 an (autocall dès obs 4),
//    autocall dégressif 100 → 62,5 % (−2,5 %/trim.), coupon 2,275 %/trim. à
//    mémoire (9,10 % p.a.), barrière coupon 60 %, protection KI 50 % européenne.
const barclaysBnpAcaGleObs = [
  '2026-09-21', '2026-12-21', '2027-03-19', '2027-06-21', '2027-09-20',
  '2027-12-20', '2028-03-20', '2028-06-19', '2028-09-19', '2028-12-19',
  '2029-03-19', '2029-06-19', '2029-09-19', '2029-12-19', '2030-03-19',
  '2030-06-19', '2030-09-19', '2030-12-19', '2031-03-19', '2031-06-19',
]
const barclaysBnpAcaGlePay = [
  '2026-09-28', '2026-12-29', '2027-03-30', '2027-06-28', '2027-09-27',
  '2027-12-27', '2028-03-27', '2028-06-26', '2028-09-26', '2028-12-28',
  '2029-03-26', '2029-06-26', '2029-09-26', '2029-12-28', '2030-03-26',
  '2030-06-26', '2030-09-26', '2030-12-30', '2031-03-26', '2031-06-26',
]
// Barème d'autocall dégressif (obs 4 → 19 ; non-call sur 1-3, maturité en 20).
const barclaysBnpAcaGleAer: (number | undefined)[] = [
  undefined, undefined, undefined, 100, 97.5, 95, 92.5, 90, 87.5, 85,
  82.5, 80, 77.5, 75, 72.5, 70, 67.5, 65, 62.5, undefined,
]

const barclaysBnpAcaGle: Product = {
  id: 'XS3401965978',
  nom: 'Phoenix Mémoire Dégressif BNP + ACA + GLE',
  isin: 'XS3401965978',
  emetteur: 'Barclays Bank PLC',
  notationEmetteur: 'Moody’s A1 / S&P A+ / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260 — Express Certificate',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2026-06-19',
  dateEmission: '2026-07-03',
  dateConstatationFinale: '2031-06-19',
  dateEcheance: '2031-06-26',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'BNP Paribas', bloomberg: 'BNP FP', isin: 'FR0000131104', marche: 'Euronext Paris', devise: 'EUR' },
    { nom: 'Crédit Agricole SA', bloomberg: 'ACA FP', isin: 'FR0000045072', marche: 'Euronext Paris', devise: 'EUR' },
    { nom: 'Société Générale SA', bloomberg: 'GLE FP', isin: 'FR0000130809', marche: 'Euronext Paris', devise: 'EUR' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: true,
    couponPa: 9.1,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 50,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(barclaysBnpAcaGleObs, barclaysBnpAcaGlePay, {
    niveauRappelPct: (n) => barclaysBnpAcaGleAer[n - 1],
    montantRemboursementPct: 100,
    couponPct: 2.275,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix',
  description: '5Y Phoenix Mémoire Dégressif Wof BNP + ACA + GLE',
  badges: ['Worst-of', 'Dégressif', 'Effet mémoire'],
  termsheetFichier: 'TS FR - Phoenix Mémoire BNP ACA SG - XS3401965978.pdf',
  // TS hors dossier « Termsheets » (rangée dans Deal Done) → lien direct SharePoint.
  termsheetUrl:
    'https://capitalmanagementfrance-my.sharepoint.com/personal/serveur_cmf_finance/Documents/TEAM/Deal Done/Laurent/2026-07-03_XS3401965978_Phoenix Mémoire BNP ACA SG/TS FR - Phoenix Mémoire BNP ACA SG - XS3401965978.pdf',
}

// ── BIL — Phoenix Mémoire Wof Moderna + Pfizer + Sanofi (CH1322027827) ───────
//    Décodé de la TS BIL (indicative 26/01/2024, EUR Quanto). 20 constatations
//    trimestrielles, coupon 2,475 %/T à mémoire (9,90 % p.a.), barrière coupon
//    60 %, autocall 100 % constant (non dégressif) dès la 4e obs (non-call 1 an),
//    protection KI 60 % européenne.
const bilMrnaObs = [
  '2024-04-26', '2024-07-26', '2024-10-28', '2025-01-27', '2025-04-28',
  '2025-07-28', '2025-10-27', '2026-01-26', '2026-04-27', '2026-07-27',
  '2026-10-26', '2027-01-26', '2027-04-26', '2027-07-26', '2027-10-26',
  '2028-01-26', '2028-04-26', '2028-07-26', '2028-10-26', '2029-01-26',
]
const bilMrnaPay = [
  '2024-05-06', '2024-08-02', '2024-11-04', '2025-02-03', '2025-05-06',
  '2025-08-04', '2025-11-03', '2026-02-02', '2026-05-05', '2026-08-03',
  '2026-11-02', '2027-02-02', '2027-05-03', '2027-08-02', '2027-11-02',
  '2028-02-02', '2028-05-04', '2028-08-02', '2028-11-02', '2029-02-02',
]
const bilModernaPfizerSanofi: Product = {
  id: 'CH1322027827',
  nom: 'Phoenix Mémoire Wof Moderna + Pfizer + Sanofi',
  isin: 'CH1322027827',
  emetteur: 'Banque Internationale à Luxembourg',
  notationEmetteur: 'S&P A- / Moody’s A2',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260 — Express Certificate',
  devise: 'EUR',
  nominal: 200_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2024-01-26',
  dateEmission: '2024-02-02',
  dateConstatationFinale: '2029-01-26',
  dateEcheance: '2029-02-02',
  frequence: 'trimestriel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'Moderna Inc', bloomberg: 'MRNA US', marche: 'NASDAQ', devise: 'USD' },
    { nom: 'Pfizer Inc', bloomberg: 'PFE US', marche: 'NYSE', devise: 'USD' },
    { nom: 'Sanofi SA', bloomberg: 'SAN FP', marche: 'Euronext Paris', devise: 'EUR' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: true,
    degressif: false,
    couponPa: 9.9,
    barriereCouponPct: 60,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
  },
  observations: buildObservations(bilMrnaObs, bilMrnaPay, {
    niveauRappelPct: (n) => (n >= 4 ? 100 : undefined),
    montantRemboursementPct: 100,
    couponPct: 2.475,
    niveauCouponPct: 60,
    rappelActifAPartirDe: 4,
  }),
  rr: 'LS',
  productType: 'Phoenix Mémoire',
  description: '5Y Phoenix Mémoire Wof Moderna + Pfizer + Sanofi (EUR Quanto)',
  badges: ['Worst-of', 'Effet mémoire', 'Quanto EUR'],
  termsheetFichier: '240202_5Y_Phoenix Memory MRNA + PFE + Sanofi_Trimestriel_CH1322027827_BIL.pdf',
}

// ── BNP — Athena Wof EuroStoxx 50 + Nikkei 225 + S&P 500 (XS3153607810) ──────
//    Décodé de la TS BNP (5Y Athena Wof, EUR Quanto). Rappel annuel (4 dates),
//    prime de rappel n × 8,15 % (max avec la perf worst-of), pas de coupon
//    courant, protection KI 60 % européenne. Niveaux initiaux fixés au 14/10/2025.
const bnpIndicesObs = ['2026-10-14', '2027-10-14', '2028-10-16', '2029-10-15', '2030-10-15']
const bnpIndicesPay = ['2026-10-28', '2027-10-28', '2028-10-30', '2029-10-29', '2030-10-29']
const bnpAthenaIndices: Product = {
  id: 'XS3153607810',
  nom: 'Athena Wof EuroStoxx 50 + Nikkei 225 + S&P 500',
  isin: 'XS3153607810',
  emetteur: 'BNP Paribas Issuance B.V.',
  garant: 'BNP Paribas',
  notationEmetteur: 'S&P A+ / Moody’s A1 / Fitch AA-',
  assetClass: 'equity',
  family: 'autocall',
  eusipa: '1260 — Express Certificate',
  devise: 'EUR',
  nominal: 510_000,
  valeurNominale: 1000,
  prixEmission: 100,
  dateConstatationInitiale: '2025-10-14',
  dateEmission: '2025-10-28',
  dateConstatationFinale: '2030-10-15',
  dateEcheance: '2030-10-29',
  frequence: 'annuel',
  basket: 'worst_of',
  sousJacents: [
    { nom: 'EURO STOXX 50', bloomberg: 'SX5E Index', marche: 'STOXX', devise: 'EUR' },
    { nom: 'Nikkei 225', bloomberg: 'NKY Index', marche: 'Osaka', devise: 'JPY' },
    { nom: 'S&P 500', bloomberg: 'SPX Index', marche: 'CBOE', devise: 'USD' },
  ],
  terms: {
    kind: 'autocall',
    sens: 'standard',
    effetMemoire: false,
    degressif: false,
    couponPa: 8.15,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
    bonusFinalPct: 40.75,
  },
  observations: buildObservations(bnpIndicesObs, bnpIndicesPay, {
    niveauRappelPct: (n) => (n <= 4 ? 100 : undefined),
    montantRemboursementPct: 100,
    couponPct: (n) => Math.round(8.15 * n * 100) / 100,
    niveauCouponPct: 100,
    rappelActifAPartirDe: 1,
  }),
  rr: 'LS',
  productType: 'Athena',
  description:
    '5Y Athena Wof EuroStoxx 50 + Nikkei 225 + S&P 500 (EUR Quanto) — prime de rappel n×8,15 % (max perf worst-of), annuel, protection 60 % européenne',
  badges: ['Worst-of', 'Athena', 'Quanto EUR'],
  termsheetFichier: 'TS - Athena SX5E NKY SPX - XS3153607810.PDF',
}

const detailed: Product[] = [
  msQuartz51, citiZcCallable,
  bnpRearmement, bnpFerroviaires, gsVeoliaErametLvmh, bnpSchneiderEnrBouy, cibcMsftGoogl,
  barclaysEngieNexansSchneider, bbvaMittalEssilor, bnpTec10Phoenix, barclaysSanofiDecrement,
  bnpClnItraxx42, bnpGoldCallSpread, bnpTryCallable, sipChabanais, msLuxeBonus, bnpSphinx15,
  barclaysEssMt,
  santanderEngieVeoliaSchneider, bnpAthenaBoosterIndices, bnpCallableCsi500,
  msMxeadt50, gsClnSgSub, efgChinaParticipation, efgWarrantSeniorLoans,
  cibcParticipationSpx,
  ...metaProducts, ...metaProducts2,
  bnpSx5e, bnpDefense, socgenEnergy, marexUso, bbvaRaceAcaNovob,
  santanderBancaires, santanderBnpGleAca, barclaysAsmlSgoTte, gsSnowball,
  santanderSchneiderEnrTte, bnpAlbemarleCf, barclaysCopperMiners,
  santanderIntelRhmRno, santanderMsftNvdaMrvl, msKeringUrw,
  efgAmdIntelNvda, msIEdgeAi, msFerroviaires,
  santanderMicronMarvell, bnpSoftware, bnpAccorCarnivalUal,
  bbvaHealthcareBonus, bbvaRearmement, santanderMaterials, marexUsoInverse,
  bnpSilverMiners, barclaysBnpVeoliaEngie, sgLvmh, bbvaLvmhTotalAirbag,
  bnpLeonardoRhmSaf, bnpGeLmtRtx, santanderLuxe, bnpRenaultStellantis,
  bnpEnergie, bnpTechUs, bbvaSgoElRi, msMerqubeTtef,
  sgPhoenixCms10, sgBearish320, dbBearish350, bnpBearish325, sgBearish635,
  sgBearishInFine350, sgGeneraliBearish, bnpOddoBearish, bnpBearishTrim,
  bbvaBnpAcaIntesa, bnpClnCrossover, sgClnMain, bbvaClnZeroRecovery,
  bnpTarn, sgBearAthenaSofr, gsKering, sgUnibailSnowball,
  bnpBearishCms2y, sgBearishCms10_325, athenaNovoNordisk, sgBouyguesVinciEiffage,
  sgBearishCms10_270, bnpBearishCms10_280, sgBearishInFineCms10_300,
  dbBearishCms10_315, bnpBearishCms10_315, cicBearishTec10,
  athenaKering, bbvaSanofiBnpTte, bofaTteShellEni, gsOrangeDecrement,
  quartz54Sanofi,
  bilPorsche, gsQuartz53, msQuartz45, gsBasket50Div,
  santanderAirbagBnpIntesaCa, santanderAirbagAsmlSgoTte, santanderBearishNdx,
  marexMstr, marexMoncMcVsco,
  barclaysBnpAcaGle, bilModernaPfizerSanofi, bnpAthenaIndices,
]

// Définitions disponibles par ISIN (termsheet décodée finement ou import catalogue).
const defByIsin = new Map<string, Product>()
for (const p of [...detailed, ...portfolioImport]) if (!defByIsin.has(p.isin)) defByIsin.set(p.isin, p)

// Code émetteur (nom de fichier) → raison sociale lisible.
const EMETTEUR_NOM: Record<string, string> = {
  BNP: 'BNP Paribas',
  SOCGEN: 'Société Générale',
  SG: 'Société Générale',
  BBVA: 'BBVA',
  GS: 'Goldman Sachs International',
  MSCO: 'Morgan Stanley',
  CITI: 'Citigroup',
  CIBC: 'Canadian Imperial Bank of Commerce',
  EFG: 'EFG International',
  BARCLAYS: 'Barclays',
  SANTANDER: 'Banco Santander',
  MAREX: 'Marex Financial',
  DB: 'Deutsche Bank',
  CIC: 'CIC',
  BOFA: 'Bank of America',
  BIL: 'Banque Internationale à Luxembourg',
  VINGA: 'Vinga',
}
function issuerName(code?: string): string {
  if (!code) return '—'
  return EMETTEUR_NOM[code.toUpperCase()] ?? code
}

// Classe d'actif + famille inférées du nom commercial de la termsheet.
function inferFamilyAsset(nom?: string): { asset: AssetClass; family: ProductFamily } {
  const s = nom ?? ''
  if (/CLN|Credit.?Linked|Tranche/i.test(s)) return { asset: 'credit', family: 'credit_linked' }
  if (/TARN|CMS|Bearish|Callable|FRN|Zero.?Coupon|\bZC\b|Steepener|Range/i.test(s))
    return { asset: 'rates', family: 'rates_structured' }
  if (/Participation|Warrant|Call Spread|Mini.?Future|Booster (?!Wof)/i.test(s))
    return { asset: 'equity', family: 'participation' }
  if (/Phoenix|Athena|Autocall|Snowball|Airbag|Recovery|Bonus|Reverse/i.test(s))
    return { asset: 'equity', family: 'autocall' }
  return { asset: 'equity', family: 'other' }
}
function typeFromName(nom?: string): string | undefined {
  const s = nom ?? ''
  for (const [re, label] of [
    [/Phoenix/i, 'Phoenix'],
    [/Athena/i, 'Athena'],
    [/Snowball/i, 'Snowball'],
    [/TARN/i, 'TARN'],
    [/CLN|Tranche/i, 'CLN'],
    [/Callable|FRN/i, 'Callable'],
    [/Participation/i, 'Participation'],
    [/Warrant/i, 'Warrant'],
    [/Autocall|Recovery|Reverse/i, 'Autocall'],
  ] as [RegExp, string][])
    if (re.test(s)) return label
  return undefined
}

// Produit minimal pour un ISIN présent au feed mais sans définition. Si une
// termsheet existe dans le dossier, on AUTO-RENSEIGNE l'identité depuis son nom
// de fichier (convention) ⇒ tout fichier déposé fait apparaître son produit.
function minimal(isin: string): Product {
  const meta = termsheetMeta(isin)
  const { asset, family } = inferFamilyAsset(meta?.nom)
  const fin =
    meta?.dateEmission && meta?.dureeAnnees
      ? addAnnees(meta.dateEmission, meta.dureeAnnees)
      : ''
  return {
    id: isin,
    nom: meta?.nom ?? isin,
    isin,
    emetteur: issuerName(meta?.emetteur),
    assetClass: meta?.nom ? asset : 'equity',
    family: meta?.nom ? family : 'other',
    devise: deviseByIsin[isin] ?? 'EUR',
    nominal: 0,
    dateConstatationInitiale: meta?.dateEmission ?? '',
    dateEmission: meta?.dateEmission ?? '',
    dateConstatationFinale: fin,
    dateEcheance: fin,
    frequence: meta?.frequence ?? 'autre',
    basket: 'single',
    sousJacents: [],
    productType: typeFromName(meta?.nom),
    description: meta?.nom,
    badges: meta ? [meta.conforme ? 'TS — auto' : 'TS à renommer'] : undefined,
  }
}

// Portefeuille = positions réelles du feed (clé = ISIN), enrichies des
// définitions, du prix/statut/montant et de l'allocation client. Le P&L et la
// situation en découlent ; rien n'est figé en dur.
export const products: Product[] = feedIsins.map((isin) => {
  const base = defByIsin.get(isin) ?? minimal(isin)
  const price = priceByIsin[isin]
  const allocs = allocByIsin[isin]
  // Libellé commercial (colonne « Description » de l'Excel) : fait foi pour la
  // description affichée. Sert aussi de titre aux produits sans vraie définition.
  const desc = descByIsin[isin]
  // Rappel automatique : si un niveau worst-of constaté a franchi la barrière
  // d'autocall à une observation passée, le produit est dérivé « rappelé ».
  // Priorité : statut explicite (feed) > rappel dérivé > statut de la définition.
  const rappelAuto = rappelConstate(base) ? 'rappele' : undefined
  const merged: Product = {
    ...base,
    rr: base.rr ?? 'LS', // par défaut, tout produit sans RR est rattaché à LS
    nom: base.nom && base.nom !== isin ? base.nom : desc ?? base.nom,
    description: desc ?? base.description,
    prixMarche: price ?? base.prixMarche,
    statut: statutByIsin[isin] ?? rappelAuto ?? base.statut ?? 'vivant',
    nominal: amountByIsin[isin] ?? base.nominal,
    // La devise vient de la DÉFINITION (termsheet/catalogue, fiable) ; le feed ne
    // sert de repli que pour les produits sans définition (minimal). Évite qu'une
    // erreur de devise dans l'Excel (ex. XS2863761933 « Gold in USD » saisi EUR)
    // n'écrase la devise réelle du produit.
    devise: base.devise ?? deviseByIsin[isin],
    clients: allocs ? allocs.map((a) => a.client) : base.clients,
    allocations: allocs ?? base.allocations,
    termsheetUrl: base.termsheetUrl ?? termsheetUrl(isin),
    termsheetFichier: base.termsheetFichier ?? termsheetFile(isin),
  }
  // P&L = prix + coupons encaissés − 100 (retombe sur prix − 100 tant que les
  // niveaux d'observation ne sont pas renseignés).
  merged.pnlPct =
    typeof merged.prixMarche === 'number'
      ? pnlAvecCoupons(merged) ?? Math.round((merged.prixMarche - 100) * 100) / 100
      : base.pnlPct
  return merged
})
