#!/usr/bin/env node
/**
 * Reporting clients — un PDF de valorisation par client, STRICTEMENT identique au
 * document « Imprimer / Enregistrer en PDF » de l'app (composant ReportSheet :
 * en-tête CMF, récap produit, niveaux des sous-jacents en % du strike, coupons).
 *
 * Le PDF est produit en imprimant la route /print du dashboard via un navigateur
 * headless (Puppeteer) — c'est donc EXACTEMENT le même rendu que dans l'app, avec
 * les mêmes données live (niveaux Yahoo + surcouche prix Bloomberg/KV).
 *
 * Pré-requis : l'app doit tourner (la route /print et les API /api/* doivent
 * répondre). En local :
 *     npm run build && npm run start          # http://localhost:3000
 *     node scripts/reporting_clients.mjs --out "<dossier OneDrive>"
 *
 * Options :
 *   --out <dir>        dossier de sortie         (défaut ./reporting_clients)
 *   --base-url <url>   URL de l'app              (défaut http://localhost:3000)
 *   --client <code>    n'exporter qu'un client   (sinon : tous)
 *
 * Dépend de puppeteer :  npm i -D puppeteer
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

const OUT = path.resolve(arg('out', path.join(process.cwd(), 'reporting_clients')))
const BASE = arg('base-url', 'http://localhost:3000').replace(/\/$/, '')
const ONLY = arg('client', null)
const DATE = new Date().toISOString().slice(0, 10)
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

async function listClients() {
  if (ONLY) return [ONLY]
  const r = await fetch(`${BASE}/api/clients`)
  if (!r.ok) throw new Error(`GET /api/clients → HTTP ${r.status}`)
  const { clients } = await r.json()
  if (!Array.isArray(clients) || clients.length === 0) throw new Error('aucun client renvoyé par /api/clients')
  return clients
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const clients = await listClients()
  console.log(`→ ${clients.length} client(s) à exporter depuis ${BASE} vers ${OUT}`)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const written = []
  try {
    const page = await browser.newPage()
    for (const client of clients) {
      const url = `${BASE}/print?client=${encodeURIComponent(client)}`
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 90_000 })
      // Attendre que les données live (niveaux/coupons) soient chargées.
      await page.waitForSelector('[data-report-ready="1"]', { timeout: 90_000 })
      const file = `${slug(client)}_valorisation_${DATE}.pdf`
      await page.pdf({
        path: path.join(OUT, file),
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true, // respecte @page { margin: 12mm } de globals.css
      })
      written.push([client, file])
      console.log(`  ✓ ${client.padEnd(24)} → ${file}`)
    }
  } finally {
    await browser.close()
  }
  console.log(`OK — ${written.length} PDF générés dans : ${OUT}`)
}

main().catch((e) => {
  console.error('ÉCHEC :', e.message)
  process.exit(1)
})
