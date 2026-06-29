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
 *   --email            envoie les PDF en pièces jointes (Resend) après génération
 *   --per-client       envoie à CHAQUE client son PDF, à son/ses email(s)
 *                      (data/client-emails.json) ; sinon tout le lot à NOTIF_EMAIL_TO
 *   --label <texte>    étiquette de cadence dans le sujet (« hebdomadaire »…)
 *
 * Email (avec --email) — variables d'environnement :
 *   RESEND_API_KEY     clé API Resend (sinon email ignoré, PDF générés quand même)
 *   NOTIF_EMAIL_TO     destinataire    (défaut L.sebah@cmf.finance)
 *   NOTIF_EMAIL_FROM   expéditeur vérifié (défaut notifications@cmf.finance)
 *
 * Automatisé via .github/workflows/reporting-clients.yml (lundi + 1er du mois).
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
// Cadence : étiquette le sujet de l'email (« hebdomadaire » / « mensuel »).
const LABEL = arg('label', null)
// --email : après génération, envoie les PDF en pièces jointes via Resend.
const EMAIL = process.argv.includes('--email')
// --per-client : envoie à CHAQUE client son propre PDF, à son/ses email(s)
// (mapping data/client-emails.json). Sinon : tout le lot à NOTIF_EMAIL_TO (toi).
const PER_CLIENT = process.argv.includes('--per-client')
const DATE = new Date().toISOString().slice(0, 10)
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Mapping CODE CLIENT → email(s) (data/client-emails.json). Une valeur peut être
// une chaîne (un email, ou plusieurs séparés par « , » / « ; »), ou un tableau.
function loadClientEmails() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/client-emails.json'), 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}
function parseEmails(value) {
  const arr = Array.isArray(value) ? value : String(value ?? '').split(/[,;]/)
  return arr.map((e) => e.trim()).filter((e) => e.includes('@'))
}

// Envoi des PDF en pièces jointes via l'API REST Resend (aucune dépendance npm).
// Dégrade proprement si RESEND_API_KEY absent (génération OK, email ignoré).
async function emailReports(files) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.NOTIF_EMAIL_TO || 'L.sebah@cmf.finance'
  // Expéditeur = la boîte de Lolo (réponses clients → sa messagerie).
  const from = process.env.NOTIF_EMAIL_FROM || 'l.sebah@cmf.finance'
  if (!key) {
    console.log('RESEND_API_KEY absent → email ignoré (PDF générés quand même).')
    return
  }
  if (files.length === 0) {
    console.log('Aucun PDF à envoyer.')
    return
  }
  const cadence = LABEL ? `${LABEL} ` : ''
  const subject = `Reporting clients ${cadence}— ${DATE} (${files.length} client${files.length > 1 ? 's' : ''})`
  const lignes = files.map(([client]) => `• ${client}`).join('\n')
  const attachments = files.map(([, file]) => ({
    filename: file,
    content: fs.readFileSync(path.join(OUT, file)).toString('base64'),
  }))
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: `Reporting de valorisation ${cadence}au ${DATE}.\n\n${files.length} fiche(s) client jointes :\n${lignes}\n\n— Dashboard CMF`,
      attachments,
    }),
  })
  if (!res.ok) throw new Error(`Resend → HTTP ${res.status} : ${await res.text()}`)
  console.log(`✉  Email envoyé à ${to} (${files.length} PDF joints).`)
}

// Envoi PAR CLIENT : à chaque client, SON PDF, à son/ses email(s) (mapping). FROM =
// boîte de Lolo (réponses → sa messagerie), BCC de Lolo pour archive. Les clients
// sans email dans le mapping sont IGNORÉS (jamais d'envoi à l'aveugle).
async function emailPerClient(files) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log('RESEND_API_KEY absent → envoi par client ignoré (PDF générés quand même).')
    return
  }
  const from = process.env.NOTIF_EMAIL_FROM || 'l.sebah@cmf.finance'
  const bcc = process.env.NOTIF_EMAIL_BCC || from // copie pour archive/trace
  const emails = loadClientEmails()
  const sent = []
  const skipped = []
  for (const [client, file] of files) {
    const dest = parseEmails(emails[client])
    if (dest.length === 0) {
      skipped.push(client)
      continue
    }
    const content = fs.readFileSync(path.join(OUT, file)).toString('base64')
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: dest,
        bcc: [bcc],
        reply_to: from,
        subject: `Reporting de valorisation — ${DATE}`,
        text:
          'Bonjour,\n\n' +
          'Veuillez trouver ci-joint le reporting de valorisation de vos positions ' +
          `au ${DATE}.\n\n` +
          'Je reste à votre disposition pour tout complément.\n\n' +
          'Bien cordialement,\nLolo Sebah — CMF',
        attachments: [{ filename: file, content }],
      }),
    })
    if (res.ok) sent.push(`${client} → ${dest.join(', ')}`)
    else {
      skipped.push(`${client} (échec HTTP ${res.status})`)
      console.error(`  ✗ ${client} : ${await res.text()}`.slice(0, 200))
    }
  }
  console.log(`✉  Envoi par client : ${sent.length} envoyé(s), ${skipped.length} ignoré(s).`)
  for (const s of sent) console.log(`   ✓ ${s}`)
  if (skipped.length) console.log(`   — sans email (ignorés) : ${skipped.join(' · ')}`)
}

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
  if (EMAIL) await (PER_CLIENT ? emailPerClient(written) : emailReports(written))
}

main().catch((e) => {
  console.error('ÉCHEC :', e.message)
  process.exit(1)
})
