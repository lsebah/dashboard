#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Indexe les termsheets PDF déposées dans public/ts/<ISIN>.pdf et écrit
//  lib/ts-pdfs.json = { "<ISIN>": "/ts/<ISIN>.pdf", ... }.
//  Le synopsis produit (Portefeuille) affiche alors le vrai document banque.
//  À relancer après avoir ajouté un PDF :  node scripts/index-ts-pdfs.mjs
// ─────────────────────────────────────────────────────────────────────────
import { readdirSync, writeFileSync } from 'node:fs'

const DIR = new URL('../public/ts/', import.meta.url)
const OUT = new URL('../lib/ts-pdfs.json', import.meta.url)

const files = readdirSync(DIR).filter((f) => /\.pdf$/i.test(f))
const map = {}
for (const f of files) {
  const isin = f.replace(/\.pdf$/i, '')
  map[isin] = `/ts/${f}`
}
writeFileSync(OUT, JSON.stringify(map, null, 2) + '\n')
console.log(`ts-pdfs.json : ${Object.keys(map).length} PDF indexées (${Object.keys(map).join(', ')}).`)
