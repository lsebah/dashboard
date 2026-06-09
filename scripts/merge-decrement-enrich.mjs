#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Fusionne l'enrichissement des indices à décrément récupéré par e-mail
//  (campagne 12 mois, boîte l.sebah@cmf.finance) dans lib/decrement-indices.json.
//  - crée les nouvelles entrées (indices jusque-là absents) ;
//  - complète nbComposants quand un nombre ferme existe, sans écraser l'existant.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../lib/decrement-indices.json', import.meta.url)
const idx = JSON.parse(readFileSync(FILE, 'utf8'))

const EM_LONG = {
  GS: 'Goldman Sachs', Citi: 'Citi', UBS: 'UBS', BBVA: 'BBVA',
  MS: 'Morgan Stanley', BNPP: 'BNP Paribas', BofA: 'Bank of America',
}

// nom, sect (FR), nb (entier ferme ou null), em, src
const NEW = {
  // ── Goldman Sachs — table « Indices Optimisés » (08/06/2026) ──
  MXEUSC50: ['MSCI Europe Semiconductors and Semiconductor Equipment Select 10 Fixed Basket 50 Points Decrement Index', 'Semiconducteurs', 10, 'GS'],
  MXTRSM50: ['MSCI Trans Semiconductors, Metal & Mining 10% Cap Select 50 Points Div EUR Index', 'Semiconducteurs', null, 'GS'],
  MXPHA50D: ['MSCI Pharma Fixed Basket Top 16 Select Equal Weighted 50 Points Decrement Index', 'Healthcare / Pharma', 16, 'GS'],
  MXLFB50D: ['MSCI ACWI Luxury Select 10 Fixed Basket 50 Point Decrement EUR Index', 'Luxe / Conso. Disc.', 10, 'GS'],
  MSLS50GE: ['Morningstar Luxury Goods Static Select 10 Decrement 50 point GR EUR', 'Luxe / Conso. Disc.', 10, 'GS'],
  MXEBA50D: ['MSCI EMU Banks Select 10% Issuer Capped 50 Points Decrement EUR Index', 'Banque', null, 'GS'],
  MXEMUB50: ['MSCI EMU Banks 50 Points Decrement EUR Index', 'Banque', null, 'GS'],
  MXTOGF50: ['MSCI Transatlantic Energy Oil and Gas Fixed Basket Select 20 Index', 'Energie / Oil & Gas', 20, 'GS'],
  MXEE50DE: ['MSCI Europe IMI Energy 10% Issuer Capped 50 Points Decrement Index', 'Energie / Oil & Gas', null, 'GS'],
  MXEBR50D: ['MSCI EMU Basic Resources Top 15 Select 50 Points Decrement EUR Index', 'Basic Resources', 15, 'GS'],
  MXCPFB50: ['MSCI ACWI IMI Copper Power Fixed Basket Select 20 Index', 'Basic Resources', 20, 'GS'],
  MXEDFB50: ['MSCI Europe Defense Fixed Basket Select 10 50 Point Decrement Index', 'Defense / Aerospace', 10, 'GS'],
  MAEROD:   ['Morningstar DE Aerospace & Defense Static Select EW Decrement 50 Point GR EUR', 'Defense / Aerospace', null, 'GS'],
  MXUSIT50: ['MSCI USA Infotech Top 100 Select 50 Pts Decrement Gross Return EUR Index', 'AI / Tech / Digital', 100, 'GS'],
  MXTAAI50: ['MSCI Transatlantic AI Effect Top 40 Decrement 50 Points Index Dividend EUR', 'AI / Tech / Digital', 40, 'GS'],
  MXTSDF50: ['MSCI Transatlantic Sector Diversified 20 Select Fixed Basket Index', 'Transatlantique', 20, 'GS'],
  MXEUC50D: ['MSCI Europe Champions Fixed Basket Select 12 Decrement 50 Point Index', 'Transatlantique', 12, 'GS'],
  USML100D: ['Euronext US Market Leaders 100 Decrement 50 Points Index', 'Transatlantique', 100, 'GS'],
  MXEMF50D: ['MSCI EMU Multisector Select 40 Fixed Basket 50 Points Decrement EUR Index', 'Multi-Secteurs', 40, 'GS'],
  MXE2050D: ['MSCI EMU and USA ex Fossil Fuels Top 20 Select Equal Weighted 50 Points Decrement Index', 'Multi-Secteurs', 20, 'GS'],

  // ── Citi (marque Morningstar) — Comparatif Émetteurs CMF (run 03/2026) ──
  MSEMI15:  ['Morningstar Semiconductors 15 Decrement 50 Points (Citi)', 'Semiconducteurs', 15, 'Citi'],
  MSCOND50: ['Morningstar Semiconductors Conditional Decrement 50 Points (Citi)', 'Semiconducteurs', null, 'Citi'],
  MEHEALTH: ['Morningstar Healthcare Decrement 50 Points (Citi)', 'Healthcare / Pharma', null, 'Citi'],
  MQDELUXE: ['Morningstar Luxe Europe Decrement 50 Points (Citi)', 'Luxe / Conso. Disc.', null, 'Citi'],
  MBANKD:   ['Morningstar France Germany Italy Banks Static Select 10 EW Decrement 50P GR EUR', 'Banque', 10, 'Citi'],
  MSDE50GE: ['Morningstar Energie Decrement 50 Points (Citi)', 'Energie / Oil & Gas', null, 'Citi'],
  MOIL50:   ['Morningstar Energie Transatlantique Decrement 50 Points (Citi)', 'Energie / Oil & Gas', null, 'Citi'],
  MTECH20:  ['Morningstar Tech & Communications Transatlantic 20 Decrement 50 Points (Citi)', 'AI / Tech / Digital', 20, 'Citi'],
  MXCORE50: ['Morningstar Core Sector Transatlantic Decrement 50 Points (Citi)', 'Transatlantique', null, 'Citi'],
  MLEAD30:  ['Morningstar Europe 30 Decrement 50 Points (Citi)', 'Transatlantique', 30, 'Citi'],
  TRANSAT:  ['Morningstar Transatlantique Decrement 50 Points (Citi)', 'Transatlantique', null, 'Citi'],

  // ── UBS — Run Athéna & Phoenix Indices Décrément (20/05/2026) ──
  EU30OGPT: ['Bloomberg Europe Top 30 Oil & Gas Decrement 50 Points Index (EUR)', 'Energie / Oil & Gas', 30, 'UBS'],
  EUSO40PT: ['Bloomberg Transatlantic Top 40 Oil & Gas Decrement 50 Points Index (EUR)', 'Energie / Oil & Gas', 40, 'UBS'],
  MSTE50GE: ['Morningstar Transatlantic ESG Select 100 Decrement 50 Points Index', 'Transatlantique', 100, 'UBS'],
  ESSOVD5P: ['Euronext European Strategic Sovereignty Decrement 50 Points Index', 'Souveraineté / PAB', null, 'UBS'],
  FR20FRPT: ['Bloomberg France Top 20 Financials Decrement 50 Points Index (EUR)', 'Multi-Secteurs', 20, 'UBS'],

  // ── BBVA — Run Décréments (21/04/2026) ──
  EUREGPT:  ['Bloomberg Europe Energy Select Multi Factor Decrement 50 Points GR Index', 'Energie / Oil & Gas', null, 'BBVA'],
  EURBGPT:  ['Bloomberg Europe Basic Resources Select Multi Factor Decrement 50 Points GR Index', 'Basic Resources', null, 'BBVA'],

  // ── Morgan Stanley — Offre Indices en Points (02/04/2026) ──
  MQDZQS50R: ['MerQube EuroZone QuadSector 20 50 Point Decrement Index (EUR)', 'Multi-Secteurs', 20, 'MS'],

  // ── BNP Paribas — RUN Indices Efficients en Point (2026) ──
  AIDM50PT: ['Bloomberg DM Artificial Intelligence Decrement 50 Points Index EUR', 'AI / Tech / Digital', null, 'BNPP'],
  WINNER50: ['MerQube Transatlantic Top Sectors Fixed Basket 50 Point Decrement Index', 'Transatlantique', 10, 'BNPP'],
  MSOVERNT: ['Morningstar Eurozone Sovereignty Select 20 Decrement 50 Point GR EUR', 'Souveraineté / PAB', 20, 'BNPP'],
  GLETHAE:  ['Global Equity Thematic Selection Part — Decrement 50 Points', 'Multi-Secteurs', null, 'BNPP'],

  // ── Bank of America — Run Autocall Indices Sectoriels (08/06/2026) ──
  MQDEEM50P: ['MerQube SPYM 50 Point Decrement Index', 'Multi-Secteurs', null, 'BofA'],
}

const SRC = {
  GS: 'Run Goldman Sachs « Indices Optimisés » (08/06/2026)',
  Citi: 'Comparatif Émetteurs CMF — run Citi (03/2026)',
  UBS: 'Run UBS Athéna & Phoenix — Indices Décrément (20/05/2026)',
  BBVA: 'Run BBVA Décréments (21/04/2026)',
  MS: 'Run Morgan Stanley — Offre Indices en Points (02/04/2026)',
  BNPP: 'Run BNP Paribas — Indices Efficients en Point (2026)',
  BofA: 'Run Bank of America — Indices Sectoriels (08/06/2026)',
}

// nbComposants fermes à ajouter sur des entrées EXISTANTES (sans rien écraser).
const NB_ONLY = { SOLPES50: 10 }

let created = 0, nbAdded = 0
for (const [t, [nom, sect, nb, em]] of Object.entries(NEW)) {
  const desc =
    `${nom}. Secteur : ${sect}.` +
    (typeof nb === 'number' ? ` ~${nb} composants.` : '') +
    ` Indice actions à décrément (50 points/an), sous-jacent d'autocall (obs. trimestrielle, protection 50 %, maturité max 12 ans). Émetteur : ${EM_LONG[em]}.`
  const entry = { nom, secteur: sect, decrement: '50 points/an', description: desc, source: SRC[em] }
  if (typeof nb === 'number') entry.nbComposants = nb
  // merge sans écraser un éventuel champ déjà présent (fichePdf/ficheUrl)
  idx[t] = { ...idx[t], ...entry }
  created++
}
for (const [t, nb] of Object.entries(NB_ONLY)) {
  if (idx[t] && typeof idx[t].nbComposants !== 'number') {
    idx[t].nbComposants = nb
    nbAdded++
  }
}

// tri par clé pour un diff stable
const sorted = Object.fromEntries(Object.keys(idx).sort().map((k) => [k, idx[k]]))
writeFileSync(FILE, JSON.stringify(sorted, null, 1) + '\n')
console.log(`Indices total : ${Object.keys(sorted).length} | entrées créées/complétées : ${created} | nbComposants ajoutés : ${nbAdded}`)
