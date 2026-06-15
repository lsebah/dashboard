#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Lint des noms de termsheets vs la convention :
//    YYMMDD_<durée>Y_<Nom>_<Fréquence>_<ISIN>_<ÉMETTEUR>.pdf
//  Liste les fichiers non conformes du dossier Termsheets (depuis
//  lib/termsheets-index.json) et propose un gabarit de renommage.
//  Usage : node scripts/termsheets-lint.mjs
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const index = JSON.parse(readFileSync(join(root, 'lib/termsheets-index.json'), 'utf8'))

const ISIN_RE = /[A-Z]{2}[A-Z0-9]{9}[0-9]/
const FREQ = ['mensuel', 'trimestriel', 'semestriel', 'annuel', 'in fine', 'in_fine', 'infine']

function parse(fichier) {
  const base = fichier.replace(/\.(pdf|txt)$/i, '')
  const isin = base.match(ISIN_RE)?.[0]
  const tokens = base.split('_').map((t) => t.trim()).filter(Boolean)
  const hasDate = /^\d{6}$/.test(tokens[0] ?? '')
  const hasTenor = tokens.some((t) => /^(\d+(?:\.\d+)?)Y+$/i.test(t))
  const hasFreq = tokens.some((t) => FREQ.includes(t.toLowerCase()))
  const last = tokens[tokens.length - 1]
  const hasIssuer = last && last !== isin && /^[A-Za-z().+\- ]{2,}$/.test(last)
  const conforme = !!(hasDate && hasTenor && hasFreq && isin && hasIssuer)
  return { fichier, isin, conforme }
}

const parsed = index.map(parse)
const bad = parsed.filter((p) => !p.conforme)

console.log(`Termsheets : ${index.length} fichiers — ${bad.length} non conforme(s)\n`)
if (bad.length === 0) {
  console.log('✓ Tous les noms respectent la convention.')
} else {
  console.log('Convention : YYMMDD_<durée>Y_<Nom>_<Fréquence>_<ISIN>_<ÉMETTEUR>.pdf\n')
  for (const b of bad) {
    const cible = b.isin
      ? `YYMMDD_<durée>Y_<Nom>_<Fréquence>_${b.isin}_<ÉMETTEUR>.pdf`
      : '(ISIN introuvable dans le nom — à renseigner)'
    console.log(`  ✗ ${b.fichier}`)
    console.log(`      → ${cible}`)
  }
  process.exitCode = 1
}
