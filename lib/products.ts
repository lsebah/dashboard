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

// ── 2) BNP — Athena Airbag SX5E 8x Repo (indice à décrément, Oxygène) ────────
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
    oxygene: true, // rappel non-actif jusqu'au T4
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
    rappelActifAPartirDe: 4, // Oxygène : actif à partir du T4
  }),
  prixMarche: 100.38,
  pnlPct: 0.38,
  pdiPct: 60,
  statut: 'vivant',
  rr: 'LS',
  productType: 'Athena',
  description: '8Y Athena Airbag SX5E 8x Repo',
  clients: ['ALVES - 06001'],
  badges: ['Oxygène — 60%', 'Décrément', 'Effet mémoire'],
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

// Produits décodés finement depuis leur termsheet (calendriers + mécanique complète).
const detailed: Product[] = [
  bnpSx5e, bnpDefense, socgenEnergy, marexUso, bbvaRaceAcaNovob,
  santanderBancaires, santanderBnpGleAca, barclaysAsmlSgoTte, gsSnowball,
  santanderSchneiderEnrTte, bnpAlbemarleCf, barclaysCopperMiners,
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
