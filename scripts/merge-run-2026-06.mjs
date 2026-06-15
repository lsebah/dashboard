#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Met à jour lib/decrement-comparatif.json depuis les DERNIERS runs émetteurs
//  lus dans le sous-dossier mail « Emetteurs ▸ Décrement » (campagne juin 2026).
//  - coupon p.a. écrasé par la valeur du dernier run (structure = type de la ligne :
//    Phoenix Mémoire pour UBS/BBVA/BofA/GS, Athena/Athena Dégressif pour MS/BNPP) ;
//  - upfront = valeur mail BRUTE (reoffer 95 % → 100−95 = 5 %, ou « UF 5 % ») →
//    uf="5.00%" + ufFromMail=true (pas de commission +1,5 % à l'affichage) ;
//  - dateRun mis à jour. Citi (aucun run mail) reste inchangé (doc + 1,5 %).
//  c = coupon p.a. (null = pas coté ce run → on garde le coupon existant), d = date run.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../lib/decrement-comparatif.json', import.meta.url)
const rows = JSON.parse(readFileSync(FILE, 'utf8'))

const UP = {
  // ── UBS — Run Athéna & Phoenix Indices Décrément (Phoenix Mémoire, reoffer 95) ──
  MQDXES50: { c: 7.25, d: '08/06/2026' }, MQDZHC50: { c: 10.50, d: '08/06/2026' },
  MQDZHE50: { c: 10.25, d: '08/06/2026' }, MQDLUX50: { c: 9.40, d: '08/06/2026' },
  EU30MPT: { c: 7.20, d: '08/06/2026' }, MQDEDT50: { c: 8.30, d: '08/06/2026' },
  MQDXSD50: { c: 8.50, d: '08/06/2026' }, AWDEUAD1: { c: 8.35, d: '08/06/2026' },
  EU20CPT: { c: 10.00, d: '08/06/2026' }, MQD30G50: { c: 12.40, d: '08/06/2026' },
  MQDINF50: { c: 6.60, d: '08/06/2026' }, EZ6PAB50: { c: 6.35, d: '08/06/2026' },
  EUSO40PT: { c: 6.45, d: '01/06/2026' }, MSTE50GE: { c: 6.35, d: '01/06/2026' },

  // ── BBVA — RUN DECREMENTS 02/06 (Phoenix Mémoire, reoffer 95) ──
  EURHGPT: { c: 6.97, d: '02/06/2026' }, EURBMGPT: { c: 8.26, d: '02/06/2026' },
  EUBCGPT: { c: 8.99, d: '02/06/2026' }, SOLEML50: { c: 6.52, d: '02/06/2026' },
  EURAGPT: { c: 8.64, d: '02/06/2026' },

  // ── BofA — Run Autocall Indices Sectoriels 08/06 (Phoenix Mémoire, UF 5 %) ──
  MQDXC10P: { c: 13.77, d: '08/06/2026' }, EHECFD50: { c: 11.81, d: '08/06/2026' },
  ENLUXD50: { c: 11.27, d: '08/06/2026' }, MQDZBK50: { c: 10.46, d: '08/06/2026' },
  ENERED5P: { c: 6.19, d: '08/06/2026' }, BAREUD5P: { c: 8.47, d: '08/06/2026' },
  MXEUAD50: { c: 13.49, d: '08/06/2026' }, EAIBED50: { c: 12.17, d: '08/06/2026' },
  ETRMLD50: { c: 7.51, d: '08/06/2026' }, ETMLSD50: { c: 9.05, d: '08/06/2026' },
  EUSO50: { c: 7.47, d: '08/06/2026' }, MQDZQS50: { c: 11.17, d: '08/06/2026' },

  // ── GS — Autocall sur Indices Optimisés 08/06 (Phoenix Mémoire v2, reoffer 95) ──
  MXEUSC50: { c: 7.67, d: '08/06/2026' }, MXTRSM50: { c: 7.32, d: '08/06/2026' },
  MXPHA50D: { c: 6.75, d: '08/06/2026' }, MXLFB50D: { c: 9.91, d: '08/06/2026' },
  MSLS50GE: { c: 9.78, d: '08/06/2026' }, MXEBA50D: { c: 9.36, d: '08/06/2026' },
  MXEMUB50: { c: 7.98, d: '08/06/2026' }, MXTOGF50: { c: 9.34, d: '08/06/2026' },
  MXEE50DE: { c: 6.83, d: '08/06/2026' }, MXEBR50D: { c: 8.00, d: '08/06/2026' },
  MXCPFB50: { c: 13.63, d: '08/06/2026' }, MAEROD: { c: 9.17, d: '08/06/2026' },
  MXUSIT50: { c: 8.83, d: '08/06/2026' }, MXTAAI50: { c: 5.83, d: '08/06/2026' },
  MXTSDF50: { c: 9.70, d: '08/06/2026' }, MXEUC50D: { c: 9.86, d: '08/06/2026' },
  USML100D: { c: 8.47, d: '08/06/2026' }, MXEMF50D: { c: 9.40, d: '08/06/2026' },
  MXEMS50D: { c: 8.18, d: '08/06/2026' }, MXE2050D: { c: 8.14, d: '08/06/2026' },
  MXEDFB50: { c: null, d: '08/06/2026' }, // coupon non coté (div/spot too high) → garde l'existant

  // ── MS — Offre Indices en Points 02/04 (Athena, reoffer 95 / 5 % UF) ──
  MQDHC10P: { c: 18.59, d: '02/04/2026' }, MQDZC50P: { c: 27.85, d: '02/04/2026' },
  BEU40CDD: { c: 25.21, d: '02/04/2026' }, CBEU40CD: { c: 22.50, d: '02/04/2026' },
  MQLUXA50: { c: 19.40, d: '02/04/2026' }, MQLUXX50: { c: 18.91, d: '02/04/2026' },
  SOLOIL50: { c: 13.49, d: '02/04/2026' }, IEEL20TD: { c: 10.65, d: '02/04/2026' },
  IEEL15TD: { c: null, d: '02/04/2026' }, IEEN15TD: { c: 8.52, d: '02/04/2026' },
  IEEN20TD: { c: 8.36, d: '02/04/2026' }, MQDER50P: { c: 15.44, d: '02/04/2026' },
  MXEADT50: { c: 16.56, d: '02/04/2026' }, SOLDEA50: { c: 18.61, d: '02/04/2026' },
  SOROBO50: { c: 15.94, d: '02/04/2026' }, IETAI10: { c: 16.20, d: '02/04/2026' },
  MQELEC50: { c: 18.14, d: '02/04/2026' }, MXDBLS50: { c: 18.23, d: '02/04/2026' },
  GIC30D50: { c: 16.56, d: '02/04/2026' }, MXEUDS50: { c: 16.64, d: '02/04/2026' },
  MXTDSB50: { c: 15.91, d: '02/04/2026' }, MXEBSALD: { c: 15.67, d: '02/04/2026' },
  MQCOCO20: { c: 15.68, d: '02/04/2026' }, JUMBO40: { c: 10.78, d: '02/04/2026' },
  ESOVED50: { c: 17.50, d: '02/04/2026' }, EUSOVT20: { c: 14.87, d: '02/04/2026' },
  TPABC50: { c: 14.69, d: '02/04/2026' }, EZPAB50P: { c: 14.75, d: '02/04/2026' },
  PBT40D50: { c: 12.45, d: '02/04/2026' }, PABTA50: { c: 13.06, d: '02/04/2026' },
  IEFRA12D: { c: 15.19, d: '02/04/2026' }, B230BCED: { c: 19.15, d: '02/04/2026' },
  MXEMSB50: { c: 17.33, d: '02/04/2026' }, BE30BCED: { c: 9.98, d: '02/04/2026' },
  MQDWS10P: { c: 16.66, d: '02/04/2026' }, SOLPES50: { c: 26.31, d: '02/04/2026' },
  MQEUTE50: { c: 8.29, d: '02/04/2026' }, MQDRE10P: { c: 17.47, d: '02/04/2026' },

  // ── BNPP — RUN Indices Efficients en Point (Athena Dégressif, UF 5 % global) ──
  PHARMAPT: { c: 10.8, d: '01/06/2026' }, LUXET50D: { c: 10.6, d: '01/06/2026' },
  LUX21T: { c: 11.7, d: '01/06/2026' }, TECLUXT: { c: 9.8, d: '01/06/2026' },
  SOBANKT: { c: 12.0, d: '01/06/2026' }, MQDXEN50: { c: 8.4, d: '01/06/2026' },
  VOLTD50: { c: 10.1, d: '01/06/2026' }, MQDEEB50: { c: 11.6, d: '01/06/2026' },
  EBASMD50: { c: 11.1, d: '01/06/2026' }, EDFEND50: { c: 12.5, d: '01/06/2026' },
  AIDM40PT: { c: 8.7, d: '01/06/2026' }, PXTECH: { c: 10.8, d: '01/06/2026' },
  MTCORE: { c: 9.3, d: '01/06/2026' }, EUSTITT: { c: 8.1, d: '01/06/2026' },
  GOLDM50: { c: 20.8, d: '01/06/2026' }, SOLESD50: { c: 9.4, d: '01/06/2026' },
  ETZSD50: { c: 9.0, d: '01/06/2026' }, MXEURO15: { c: 10.4, d: '01/06/2026' },
  EEFA50D: { c: 9.0, d: '01/06/2026' }, USTISPT: { c: 8.2, d: '01/06/2026' },
  CNFSPT: { c: 14.4, d: '01/06/2026' },
  AIDM50PT: { c: 8.8, d: '18/05/2026' }, MSOVERNT: { c: 8.8, d: '27/05/2026' },
  GLETHAE: { c: 14.4, d: '27/05/2026' }, WINNER50: { c: 8.6, d: '21/04/2026' },
}

let coupons = 0, ufs = 0
for (const r of rows) {
  const u = UP[r.ticker]
  if (!u) continue
  r.uf = '5.00%'
  r.ufFromMail = true
  r.dateRun = u.d
  ufs++
  if (typeof u.c === 'number') { r.couponPa = u.c; coupons++ }
}
writeFileSync(FILE, JSON.stringify(rows, null, 0) + '\n')
const reste = rows.filter((r) => !r.ufFromMail).map((r) => r.ticker)
console.log(`Lignes mises à jour : ${ufs} (dont ${coupons} coupons). Inchangées (doc) : ${reste.length}`)
console.log('Inchangées :', reste.join(', '))
