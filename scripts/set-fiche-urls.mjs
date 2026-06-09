#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Renseigne ficheUrl (lien visionneuse OneDrive) pour les indices dont le
//  one-pager existe dans le dossier OneDrive « Fiches Décrements ». Le ⓘ du
//  Comparatif apparaît alors et ouvre la vraie fiche (viewer SharePoint).
//  Lien au format onedrive.aspx?id=<chemin>&parent=<dossier> (cf. termsheets.ts) :
//  le chemin direct renvoie un 404 sur OneDrive perso, ce détour fonctionne.
//
//  NB : c'est un dépannage sans Azure. Quand le cron sync-fiches (Graph $value)
//  tournera, il posera le PDF en local (fichePdf), qui prime sur ficheUrl.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://capitalmanagementfrance-my.sharepoint.com/personal/l_sebah_cmf_finance'
const FOLDER = '/personal/l_sebah_cmf_finance/Documents/Documents/Fiches Décrements'
const url = (file) =>
  `${SITE}/_layouts/15/onedrive.aspx?id=${encodeURIComponent(`${FOLDER}/${file}`)}&parent=${encodeURIComponent(FOLDER)}`

// ticker → nom de fichier exact dans le dossier (espaces compris).
const MAP = {
  MXEDFB50: '4-pager - MXEDFB50.pdf',
  MXEM2050: '4-Pager - MXEM2050.pdf',
  MXEM250D: '4-Pager - MXEM250D.pdf',
  MXEUA250: '4-pager - MXEUA250 .pdf',
  MXEUC50D: '4-Pager - MXEUC50D Index.pdf',
  MXNU2050: '4-pager - MXNU2050 Index.pdf',
  MXUEAE50: '4-pager - MXUEAE50 Index.pdf',
  MXEMBS50: 'February2026 MXEMBS50 Index.pdf',
  ENEAID50: 'March2026 ENEAID50 Index.pdf',
  ENSEAI50: 'March2026 ENSEAI50 Index.pdf',
  MXEMMS50: 'March2026 MXEMMS50 Index.pdf',
  MXEZAD50: 'March2026 MXEZAD50 Index.pdf',
  MXTAGM50: 'March2026 MXTAGM50 Index.pdf',
  MXEMT50D: 'MXEMT50D - 4 - pager.pdf',
  MXTAS50D: 'MXTAS50D - 4pager.pdf',
  MXTB2050: 'MXTB2050 - 4pager.pdf',
  EDFEND50: 'Indice Euronext European Defense Fixed Basket Decrement 50 Points.pdf',
  ALLWTHR: 'Indice MerQube All Weather Commodities Equities 10 50 Point Decrement (EUR)   (1).pdf',
  GOLDM50: 'Indice Solactive North America Gold Miners Top 20 Index 50 Decrement.pdf',
  MTCORE: 'Morningstar Transatlantic Multi-Sector Select 20 Decrement 50 Point GR EUR.pdf',
}

const FILE = new URL('../lib/decrement-indices.json', import.meta.url)
const idx = JSON.parse(readFileSync(FILE, 'utf8'))
let set = 0, skip = 0
for (const [t, file] of Object.entries(MAP)) {
  if (!idx[t]) { console.warn(`ticker absent de la lib : ${t}`); skip++; continue }
  idx[t] = { ...idx[t], ficheUrl: url(file) }
  set++
}
const sorted = Object.fromEntries(Object.keys(idx).sort().map((k) => [k, idx[k]]))
writeFileSync(FILE, JSON.stringify(sorted, null, 1) + '\n')
console.log(`ficheUrl renseigné : ${set} | ignorés : ${skip}`)
