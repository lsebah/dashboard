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
 * ── UN SEUL AGENT POUR LES DEUX CADENCES ────────────────────────────────────
 * Auparavant le lundi partait en LOT (tous les PDF dans un mail à Laurent) et le
 * 1er du mois partait AUX CLIENTS. Deux comportements pour un même livrable, et
 * une liste de diffusion cachée dans le workflow. Désormais :
 *   • hebdomadaire et mensuel suivent le MÊME chemin (un PDF → le client) ;
 *   • qui reçoit quoi est une DONNÉE, cochée dans l'onglet Maintenance et lue
 *     ici via GET /api/clients/fiches (source unique, cf. lib/clients-fiches) ;
 *   • L.sebah@cmf.finance est en copie cachée de TOUT envoi client ;
 *   • un compte rendu récapitule à chaque run qui a reçu, qui n'a rien reçu et
 *     pourquoi — les 13 clients sans adresse n'étaient jusqu'ici ignorés qu'en
 *     silence.
 *
 * Pré-requis : l'app doit tourner (route /print + API /api/*). En local :
 *     npm run build && npm run start          # http://localhost:3000
 *     node scripts/reporting_clients.mjs --out "<dossier OneDrive>"
 *
 * Options :
 *   --out <dir>        dossier de sortie         (défaut ./reporting_clients)
 *   --base-url <url>   URL de l'app              (défaut http://localhost:3000)
 *   --client <code>    n'exporter qu'un client   (sinon : tous)
 *   --email            envoie les relevés (exige --cadence)
 *   --cadence <c>      « hebdo » ou « mensuel » — détermine QUI est servi
 *   --force-send       ignore le verrou anti-double-envoi (renvoi volontaire)
 *   --dry-run          établit et affiche le plan d'envoi SANS rien expédier
 *                      (ni email, ni verrou) — à lancer avant d'activer une
 *                      nouvelle cadence pour vérifier qui serait servi
 *
 * Email (avec --email) — variables d'environnement :
 *   RESEND_API_KEY     clé API Resend (sinon email ignoré, PDF générés quand même)
 *   NOTIF_EMAIL_FROM   expéditeur vérifié (défaut l.sebah@cmf.finance)
 *   NOTIF_EMAIL_TO     destinataire du COMPTE RENDU (défaut L.sebah@cmf.finance)
 *   NOTIF_EMAIL_BCC    copie cachée additionnelle (L.sebah@cmf.finance toujours incluse)
 *   KV_REST_API_URL / KV_REST_API_TOKEN   verrou anti-double-envoi
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
const EMAIL = process.argv.includes('--email')
const CADENCE = arg('cadence', null)
// --force-send : ignore le verrou anti-double-envoi (renvoi volontaire).
const FORCE_SEND = process.argv.includes('--force-send')
// --dry-run : tout est calculé, rien n'est expédié ni verrouillé.
const DRY_RUN = process.argv.includes('--dry-run')
const DATE = new Date().toISOString().slice(0, 10)
const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Copie cachée non négociable : Laurent doit conserver une trace de tout ce qui
// part chez un client (les envois Resend n'apparaissent pas dans ses « envoyés »).
const BCC_OBLIGATOIRE = 'L.sebah@cmf.finance'

const LIBELLE = { hebdo: 'hebdomadaire', mensuel: 'mensuel' }

// ── Verrou anti-double-envoi (KV REST Vercel/Upstash) ───────────────────────
// Incident du 1er juillet 2026 : déclenchement manuel le matin + cron GitHub en
// retard → les clients ont reçu le relevé mensuel DEUX fois. Le verrou est posé
// PAR CLIENT et PAR JOUR (et non par run) pour deux raisons :
//   • le 1er du mois peut tomber un lundi : les deux crons se déclenchent, et un
//     client abonné aux deux cadences recevrait deux fois le même relevé ;
//   • après un échec partiel, relancer ne re-sert que ceux qui n'ont rien reçu.
const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const kvConfigure = !!(KV_URL && KV_TOKEN)
const lockKey = (client) => `cmf:reporting:envoi:${DATE}:${slug(client)}`

/** Lit un verrou. Lève si le KV est configuré mais injoignable (jamais « on tente quand même »). */
async function dejaEnvoye(client) {
  if (!kvConfigure) return false
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(lockKey(client))}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  })
  if (!r.ok) throw new Error(`verrou illisible (HTTP ${r.status})`)
  const j = await r.json()
  return j.result != null
}

async function marquerEnvoye(client, info) {
  if (!kvConfigure) return
  try {
    await fetch(`${KV_URL}/set/${encodeURIComponent(lockKey(client))}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ at: new Date().toISOString(), ...info }),
    })
  } catch {
    /* le verrou est un garde-fou, pas un point de défaillance après un envoi réussi */
  }
}

// ── Fiches clients (source unique des abonnements) ──────────────────────────
/**
 * Lit les fiches via l'app. On NE recopie pas ici la logique de fusion : elle
 * vit dans lib/clients-fiches.ts, elle est testée, et l'interface Maintenance
 * affiche exactement ce que cette fonction reçoit.
 */
async function chargerFiches() {
  const r = await fetch(`${BASE}/api/clients/fiches`, { cache: 'no-store' })
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(`GET /api/clients/fiches → HTTP ${r.status}. ${detail.slice(0, 200)}`)
  }
  const j = await r.json()
  if (!j.configured)
    throw new Error(
      "les fiches clients ne sont pas persistées sur cet environnement (KV non configuré). " +
        "Envoi refusé : impossible de savoir qui est abonné.",
    )
  if (!Array.isArray(j.fiches) || j.fiches.length === 0) throw new Error('aucune fiche client renvoyée')
  return j.fiches
}

function sujet(cadence) {
  return cadence === 'hebdo' ? 'CMF | Relevé Hebdomadaire' : 'CMF | Relevé Mensuel'
}

/** Envoi d'un relevé à UN client. Renvoie une erreur lisible, ou null si envoyé. */
async function envoyerReleve({ key, from, bcc, cadence, client, destinataires, file }) {
  const content = fs.readFileSync(path.join(OUT, file)).toString('base64')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: destinataires,
      bcc,
      reply_to: from,
      subject: sujet(cadence),
      text:
        'Bonjour,\n\n' +
        'Veuillez trouver ci-joint le reporting de valorisation de vos positions ' +
        `au ${DATE}.\n\n` +
        'Je reste à votre disposition pour tout complément.\n\n' +
        'Bien cordialement,\nLaurent Sebah — CMF',
      attachments: [{ filename: file, content }],
    }),
  })
  if (res.ok) return null
  return `HTTP ${res.status} — ${(await res.text().catch(() => '')).slice(0, 160)}`
}

/**
 * Compte rendu du run : qui a reçu, qui n'a rien reçu et pourquoi.
 * Remplace l'ancien mail « en lot » : Laurent garde une vue consolidée, et les
 * exclusions ne sont plus muettes.
 */
async function envoyerCompteRendu(cadence, bilan) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.NOTIF_EMAIL_TO || BCC_OBLIGATOIRE
  const from = process.env.NOTIF_EMAIL_FROM || 'l.sebah@cmf.finance'
  const bloc = (titre, lignes) => (lignes.length ? `${titre} (${lignes.length})\n${lignes.map((l) => `  • ${l}`).join('\n')}\n\n` : '')
  const corps =
    `Relevé ${LIBELLE[cadence]} du ${DATE}.\n\n` +
    bloc('ENVOYÉS', bilan.envoyes) +
    bloc('ÉCHECS', bilan.echecs) +
    bloc('ABONNÉS NON SERVIS', bilan.bloques) +
    bloc('DÉJÀ ENVOYÉS AUJOURD’HUI (verrou)', bilan.verrouilles) +
    bloc('NON ABONNÉS À CETTE CADENCE', bilan.nonAbonnes) +
    `Corriger un abonnement ou une adresse : onglet Maintenance du terminal Lifecycle.\n— Dashboard CMF`
  if (!key) {
    console.log('RESEND_API_KEY absent → compte rendu non envoyé.')
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `CMF | Reporting ${LIBELLE[cadence]} — ${bilan.envoyes.length} envoyé(s), ${bilan.bloques.length + bilan.echecs.length} en anomalie`,
      text: corps,
    }),
  })
  if (!res.ok) console.error(`Compte rendu non envoyé : HTTP ${res.status}`)
  else console.log(`✉  Compte rendu envoyé à ${to}.`)
}

/** Résumé lisible dans l'onglet Actions (et non seulement dans les logs). */
function resumeJob(cadence, bilan) {
  if (!process.env.GITHUB_STEP_SUMMARY) return
  const bloc = (titre, lignes) => (lignes.length ? `### ${titre} (${lignes.length})\n${lignes.map((l) => `- ${l}`).join('\n')}\n\n` : '')
  const md =
    `## Reporting ${LIBELLE[cadence]} — ${DATE}\n\n` +
    bloc('✅ Envoyés', bilan.envoyes) +
    bloc('❌ Échecs', bilan.echecs) +
    bloc('⚠️ Abonnés non servis', bilan.bloques) +
    bloc('⏭️ Déjà envoyés aujourd’hui', bilan.verrouilles) +
    bloc('· Non abonnés à cette cadence', bilan.nonAbonnes)
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md)
  } catch {
    /* le résumé est un confort, pas un point de défaillance */
  }
}

async function listClients() {
  if (ONLY) return [ONLY]
  const r = await fetch(`${BASE}/api/clients`)
  if (!r.ok) throw new Error(`GET /api/clients → HTTP ${r.status}`)
  const { clients } = await r.json()
  if (!Array.isArray(clients) || clients.length === 0) throw new Error('aucun client renvoyé par /api/clients')
  return clients
}

async function genererPdf(clients) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
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
  return written
}

async function main() {
  if (EMAIL && !LIBELLE[CADENCE])
    throw new Error("--email exige --cadence hebdo|mensuel (aucune cadence par défaut : on n'envoie jamais au jugé)")

  fs.mkdirSync(OUT, { recursive: true })
  const clients = await listClients()

  // Les abonnements sont lus AVANT de lancer Puppeteer : si le stockage des
  // fiches est injoignable, l'agent doit s'arrêter en quelques secondes plutôt
  // qu'après plusieurs minutes de rendu inutile.
  const fiches = EMAIL ? await chargerFiches() : null

  console.log(`→ ${clients.length} client(s) à exporter depuis ${BASE} vers ${OUT}`)
  const written = await genererPdf(clients)
  console.log(`OK — ${written.length} PDF générés dans : ${OUT}`)
  if (!EMAIL) return

  // ── Plan d'envoi, établi AVANT le premier email ──────────────────────────
  const parCode = new Map(fiches.map((f) => [f.code, f]))
  const fichierDe = new Map(written)

  const bilan = { envoyes: [], echecs: [], bloques: [], verrouilles: [], nonAbonnes: [] }
  const aEnvoyer = []

  for (const f of fiches) {
    const abonne = CADENCE === 'hebdo' ? f.envoiHebdo === true : f.envoiMensuel === true
    if (!abonne) continue
    const file = fichierDe.get(f.code)
    if (!file) {
      // Abonné mais aucun PDF : le client n'a aucune position vivante valorisée.
      // Ce n'est pas une erreur, mais ça doit se voir (sinon on croit l'avoir servi).
      bilan.bloques.push(`${f.code} — aucune position valorisée, pas de relevé à produire`)
      continue
    }
    const dest = Array.isArray(f.destinataires) ? f.destinataires : []
    if (dest.length === 0) {
      bilan.bloques.push(
        `${f.code} — ${f.emailsInvalides?.length ? `adresse illisible : ${f.emailsInvalides.join(', ')}` : 'aucune adresse email'}`,
      )
      continue
    }
    aEnvoyer.push({ code: f.code, file, destinataires: dest })
  }
  for (const [code] of written) {
    const f = parCode.get(code)
    const abonne = f && (CADENCE === 'hebdo' ? f.envoiHebdo === true : f.envoiMensuel === true)
    if (!abonne) bilan.nonAbonnes.push(code)
  }

  // Verrous relus pour TOUT le monde avant le premier envoi : si le KV est
  // configuré mais injoignable, on s'arrête sans avoir rien expédié plutôt que
  // de risquer un second envoi non tracé (incident du 1er juillet).
  if (!kvConfigure) {
    console.log('⚠  Verrou KV non configuré — aucune garde anti-double-envoi sur ce run.')
  } else if (!FORCE_SEND) {
    const restants = []
    for (const e of aEnvoyer) {
      if (await dejaEnvoye(e.code)) bilan.verrouilles.push(e.code)
      else restants.push(e)
    }
    aEnvoyer.length = 0
    aEnvoyer.push(...restants)
  }

  const key = process.env.RESEND_API_KEY
  if (!key && !DRY_RUN) {
    console.log('RESEND_API_KEY absent → envoi ignoré (PDF générés quand même).')
    return
  }
  const from = process.env.NOTIF_EMAIL_FROM || 'l.sebah@cmf.finance'
  // Copie cachée : l'adresse de Laurent est ajoutée quoi qu'il arrive.
  const bcc = Array.from(
    new Set([...(process.env.NOTIF_EMAIL_BCC || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean), BCC_OBLIGATOIRE]),
  )

  for (const e of aEnvoyer) {
    // Simulation : le plan est établi et affiché, mais rien ne part et aucun
    // verrou n'est posé — relancer sans --dry-run enverra bien le relevé.
    if (DRY_RUN) {
      bilan.envoyes.push(`${e.code} → ${e.destinataires.join(', ')} [simulation]`)
      console.log(`  ○ ${e.code} → ${e.destinataires.join(', ')} (simulation)`)
      continue
    }
    const erreur = await envoyerReleve({ key, from, bcc, cadence: CADENCE, ...e })
    if (erreur) {
      bilan.echecs.push(`${e.code} → ${e.destinataires.join(', ')} : ${erreur}`)
      console.error(`  ✗ ${e.code} : ${erreur}`)
      continue
    }
    bilan.envoyes.push(`${e.code} → ${e.destinataires.join(', ')}`)
    console.log(`  ✓ ${e.code} → ${e.destinataires.join(', ')}`)
    await marquerEnvoye(e.code, { cadence: CADENCE, destinataires: e.destinataires })
  }

  console.log(
    DRY_RUN ? `— SIMULATION (--dry-run) : aucun email envoyé, aucun verrou posé.` : '',
  )
  console.log(
    `✉  Relevé ${LIBELLE[CADENCE]} : ${bilan.envoyes.length} envoyé(s), ${bilan.echecs.length} échec(s), ` +
      `${bilan.bloques.length} abonné(s) non servi(s), ${bilan.verrouilles.length} déjà envoyé(s) aujourd'hui.`,
  )
  resumeJob(CADENCE, bilan)
  if (!DRY_RUN) await envoyerCompteRendu(CADENCE, bilan)

  // Un abonné non servi ou un échec est une anomalie à corriger : le job doit le
  // signaler en jaune dans l'onglet Actions, sans faire échouer un envoi réussi.
  if (bilan.bloques.length || bilan.echecs.length)
    console.log(
      `::warning::Reporting ${LIBELLE[CADENCE]} : ${bilan.bloques.length} abonné(s) non servi(s) et ${bilan.echecs.length} échec(s) — voir le compte rendu.`,
    )
}

main().catch((e) => {
  console.error('ÉCHEC :', e.message)
  process.exit(1)
})
