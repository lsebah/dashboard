#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Règle : structures DIFFÉRENTES → elles cohabitent (une ligne par structure).
//  Les runs émetteurs Phoenix (BofA, GS, BBVA) proposent AUSSI une variante
//  Athena sur le même indice → on ajoute la ligne Athena à côté de la ligne
//  Phoenix Mémoire existante (même indice, coupon différent). Idempotent.
//  (UBS : coupons Athéna non captés ce run → à ajouter via une relecture mail.)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../lib/decrement-comparatif.json', import.meta.url)
const rows = JSON.parse(readFileSync(FILE, 'utf8'))

// ticker → [coupon Athena, dateRun, libellé type]
const ATH = {
  // ── BofA — #1 ATHENA sur indice (run 08/06) ──
  MQDXC10P: [14.99, '08/06/2026'], EHECFD50: [13.59, '08/06/2026'], ENLUXD50: [13.04, '08/06/2026'],
  MQDZBK50: [11.68, '08/06/2026'], ENERED5P: [6.68, '08/06/2026'], BAREUD5P: [9.0, '08/06/2026'],
  MXEUAD50: [15.93, '08/06/2026'], EAIBED50: [13.58, '08/06/2026'], ETRMLD50: [8.34, '08/06/2026'],
  ETMLSD50: [10.05, '08/06/2026'], EUSO50: [8.31, '08/06/2026'], MQDZQS50: [12.45, '08/06/2026'],
  // ── GS — Athena v1 (run 08/06) ──
  MXEUSC50: [7.8, '08/06/2026'], MXTRSM50: [7.64, '08/06/2026'], MXPHA50D: [7.36, '08/06/2026'],
  MXLFB50D: [11.24, '08/06/2026'], MSLS50GE: [11.47, '08/06/2026'], MXEBA50D: [10.93, '08/06/2026'],
  MXEMUB50: [8.93, '08/06/2026'], MXTOGF50: [10.48, '08/06/2026'], MXEE50DE: [7.4, '08/06/2026'],
  MXEBR50D: [8.59, '08/06/2026'], MXCPFB50: [15.55, '08/06/2026'], MAEROD: [10.47, '08/06/2026'],
  MXUSIT50: [10.03, '08/06/2026'], MXTAAI50: [5.93, '08/06/2026'], MXTSDF50: [10.77, '08/06/2026'],
  MXEUC50D: [11.25, '08/06/2026'], USML100D: [9.43, '08/06/2026'], MXEMF50D: [10.82, '08/06/2026'],
  MXEMS50D: [9.1, '08/06/2026'], MXE2050D: [9.15, '08/06/2026'],
  // ── BBVA — Athéna Dégressif (run 02/06) ──
  EURHGPT: [10.81, '02/06/2026', 'Athéna Dégressif'], EURBMGPT: [11.09, '02/06/2026', 'Athéna Dégressif'],
  EUBCGPT: [12.58, '02/06/2026', 'Athéna Dégressif'], SOLEML50: [9.2, '02/06/2026', 'Athéna Dégressif'],
  EURAGPT: [12.51, '02/06/2026', 'Athéna Dégressif'],
}

let added = 0
for (const [t, info] of Object.entries(ATH)) {
  const i = rows.findIndex((r) => r.ticker === t) // ligne Phoenix Mémoire existante
  if (i < 0) { console.warn('ligne absente :', t); continue }
  const type = info[2] || 'Athena'
  if (rows.some((r) => r.ticker === t && r.type === type)) continue // déjà ajoutée
  const base = rows[i]
  // Variante Athena : prime à l'autocall (pas de coupon conditionnel → B. coupon nulle),
  // mêmes paramètres de structure (PDI, dégressivité, obs, maturité) issus du run.
  const ath = {
    ...base, type, couponPa: info[0], memoire: false, barriereCoupon: null,
    uf: '5.00%', ufFromMail: true, dateRun: info[1],
  }
  rows.splice(i + 1, 0, ath) // insère juste après la ligne Phoenix Mémoire
  added++
}
writeFileSync(FILE, JSON.stringify(rows, null, 0) + '\n')
console.log(`Lignes Athena ajoutées : ${added} | total lignes : ${rows.length}`)
