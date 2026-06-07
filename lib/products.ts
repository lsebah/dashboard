// ─────────────────────────────────────────────────────────────────────────
//  Données de référence — produits encodés à partir de termsheets réelles.
//  Sert d'amorce (seed) tant que la base de données n'est pas branchée.
//  Les 4 produits couvrent : single / indice décrément / panier équipondéré /
//  worst-of, autocall standard & inverse, Airbag, Oxygène, barrière dégressive.
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'
import { buildObservations } from './lifecycle'
import { portfolioImport } from './portfolio-import'
import { termsheetUrl, termsheetFile } from './termsheets'
import {
  feedIsins,
  priceByIsin,
  statutByIsin,
  deviseByIsin,
  amountByIsin,
  allocByIsin,
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
  productType: 'Reverse Convertible',
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
    effetMemoire: true,
    couponPa: 11.0,
    barriereRappelPct: 100,
    protectionPct: 60,
    protectionStyle: 'europeenne',
    decrement: 'Financing Cost Decrement',
    bonusFinalPct: 88,
  },
  observations: buildObservations(sx5eObs, sx5ePay, {
    niveauRappelPct: 100,
    montantRemboursementPct: (n) => 108.25 + n * 2.75,
    couponPct: 2.75,
    rappelActifAPartirDe: 4, // non-call : rappel actif à partir du T4
  }),
  prixMarche: 100.38,
  pnlPct: 0.38,
  pdiPct: 60,
  statut: 'vivant',
  rr: 'LS',
  productType: 'Athena',
  description: '8Y Athena Airbag SX5E 8x Repo',
  clients: ['ALVES - 06001'],
  badges: ['Non-call (3 obs.)', 'Décrément', 'Effet mémoire'],
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
  assetClass: 'equity',
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
    effetMemoire: true,
    degressif: false,
    couponPa: 10.0,
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
  description: '5Y Athena Autocall LVMH — coupon au rappel 100%+i×5%, KI 70% européen, bonus +50%',
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
    '240630_12Y_Phoenix Memory sur Taux en Juin 2024 -  2.30%3.20% (ADEQUITY)_Semestriel_FR001400OZR1_.pdf',
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
  barriereCoupon: number
  barriereRappel: number
  memoire?: boolean
  couponGaranti?: number
  inFine?: boolean
  obs: string[]
  pay: string[]
  description: string
  termsheetFichier: string
}): Product {
  // Barrière de rappel = constante sur la fenêtre d'autocall, sauf la dernière
  // observation (maturité) qui n'est pas un rappel.
  const rappel = p.obs.map((_, i) => (i < p.obs.length - 1 ? p.barriereRappel : undefined))
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
      couponConditionnelPa: p.couponPct,
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
      rappelActifAPartirDe: 1,
    }),
    rr: 'LS',
    productType: 'Phoenix Taux',
    description: p.description,
    badges: ['Taux', 'Bearish CMS10', 'Capital garanti'],
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

// Produits décodés finement depuis leur termsheet (calendriers + mécanique complète).
const detailed: Product[] = [
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
]

// Définitions disponibles par ISIN (termsheet décodée finement ou import catalogue).
const defByIsin = new Map<string, Product>()
for (const p of [...detailed, ...portfolioImport]) if (!defByIsin.has(p.isin)) defByIsin.set(p.isin, p)

// Produit minimal pour un ISIN présent au feed mais sans définition (à décoder).
function minimal(isin: string): Product {
  return {
    id: isin,
    nom: isin,
    isin,
    emetteur: '—',
    assetClass: 'equity',
    family: 'other',
    devise: deviseByIsin[isin] ?? 'EUR',
    nominal: 0,
    dateConstatationInitiale: '',
    dateEmission: '',
    dateConstatationFinale: '',
    dateEcheance: '',
    frequence: 'autre',
    basket: 'single',
    sousJacents: [],
  }
}

// Portefeuille = positions réelles du feed (clé = ISIN), enrichies des
// définitions, du prix/statut/montant et de l'allocation client. Le P&L et la
// situation en découlent ; rien n'est figé en dur.
export const products: Product[] = feedIsins.map((isin) => {
  const base = defByIsin.get(isin) ?? minimal(isin)
  const price = priceByIsin[isin]
  const allocs = allocByIsin[isin]
  return {
    ...base,
    prixMarche: price ?? base.prixMarche,
    statut: statutByIsin[isin] ?? base.statut ?? 'vivant',
    pnlPct: typeof price === 'number' ? Math.round((price - 100) * 100) / 100 : base.pnlPct,
    nominal: amountByIsin[isin] ?? base.nominal,
    devise: deviseByIsin[isin] ?? base.devise,
    clients: allocs ? allocs.map((a) => a.client) : base.clients,
    allocations: allocs ?? base.allocations,
    termsheetUrl: base.termsheetUrl ?? termsheetUrl(isin),
    termsheetFichier: base.termsheetFichier ?? termsheetFile(isin),
  }
})
