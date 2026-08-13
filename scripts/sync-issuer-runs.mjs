#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Met à jour la page « Comparatif » (indices décrément / infos émetteurs) à
//  partir du dernier mail « Run Décrement / Comparatif Émetteurs » reçu.
//
//  1. sélectionne les runs dans « Emetteurs » ET ses sous-dossiers, par
//     DOMAINE émetteur + mot-clé d'objet (indépendant du classement manuel) ;
//  2. télécharge le .xlsx, le parse (mêmes colonnes que le comparatif) ;
//  3. réécrit lib/decrement-comparatif.json → la page Comparatif se met à jour.
//
//  Variables d'environnement (secrets GitHub Actions) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET → app Azure AD
//    GRAPH_USER          → boîte à lire (ex. l.sebah@cmf.finance)
//    MAIL_FOLDER         → dossier racine (défaut « Emetteurs », sous-dossiers inclus)
//    MAIL_DOMAINS        → domaines émetteurs, séparés par des virgules
//    MAIL_KEYWORDS       → mots-clés d'objet, séparés par des virgules
//    MAIL_SENDER         → (optionnel) restreint à un expéditeur précis
//
//  Permission Graph requise : Mail.Read (application) — consentement admin.
//  Dépendance : xlsx (SheetJS) — installée par le workflow.
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  GRAPH_USER = 'l.sebah@cmf.finance',
  // Dossier RACINE de la veille émetteurs. On lit « Emetteurs » ET ses
  // sous-dossiers : le classement dans « Emetteurs ▸ Décrement » est manuel et
  // s'est arrêté le 21/07/2026 sans que rien ne le signale — trois semaines de
  // runs (03/08, 10/08, 11/08) sont restées invisibles. La synchro ne doit plus
  // dépendre d'un tri à la main.
  MAIL_FOLDER = 'Emetteurs',
  // Domaines des desks émetteurs qui envoient des runs d'indices à décrément.
  // Filtrer par DOMAINE et non par adresse : l'expéditeur BBVA est passé de
  // theodore.jankowiak à prasit.suryadhay sans préavis.
  MAIL_DOMAINS = '@bbva.com,@ubs.com,@bnpparibas.com,@bofa.com,@citi.com,@gs.com',
  // Mots-clés d'objet. Aucun mot commun n'existe entre tous les runs
  // (« Indices Efficients », « Indices Sectoriels », « Run de prix hebdomadaire »…) :
  // c'est le couple DOMAINE + MOT-CLÉ qui cadre, pas le mot-clé seul.
  MAIL_KEYWORDS = 'decrement,décrément,indices efficients,indices sectoriels,prix hebdomadaire',
  MAIL_SENDER,
} = process.env

const OUT = new URL('../lib/decrement-comparatif.json', import.meta.url)

function need(v, n) {
  if (!v) throw new Error(`Variable manquante : ${n}`)
  return v
}

async function token() {
  const body = new URLSearchParams({
    client_id: need(GRAPH_CLIENT_ID, 'GRAPH_CLIENT_ID'),
    client_secret: need(GRAPH_CLIENT_SECRET, 'GRAPH_CLIENT_SECRET'),
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const r = await fetch(
    `https://login.microsoftonline.com/${need(GRAPH_TENANT_ID, 'GRAPH_TENANT_ID')}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
  )
  if (!r.ok) throw new Error(`Auth Graph ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token
}

async function graph(tok, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { authorization: `Bearer ${tok}` },
  })
  if (!r.ok) throw new Error(`Graph ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

// Cherche le mail le plus récent (avec PJ) correspondant aux mots-clés.
// Retrouve un dossier par nom, en descendant récursivement l'arborescence.
async function findFolderId(tok, user, name) {
  const target = String(name).trim().toLowerCase()
  const queue = [`/users/${user}/mailFolders?$top=100&$select=id,displayName`]
  let guard = 0
  while (queue.length && guard++ < 200) {
    const page = await graph(tok, queue.shift())
    for (const f of page.value ?? []) {
      if (String(f.displayName ?? '').trim().toLowerCase() === target) return f.id
      queue.push(`/users/${user}/mailFolders/${f.id}/childFolders?$top=100&$select=id,displayName`)
    }
    if (page['@odata.nextLink']) queue.push(page['@odata.nextLink'])
  }
  return null
}

// Ids du dossier racine ET de ses sous-dossiers (Décrement, FRN, CLN…).
async function folderTree(tok, user, rootId) {
  const ids = [rootId]
  const page = await graph(tok, `/users/${user}/mailFolders/${rootId}/childFolders?$top=100&$select=id`)
  for (const f of page.value ?? []) ids.push(f.id)
  return ids
}

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/**
 * Runs candidats, les plus récents d'abord. Sélection = DOMAINE émetteur ET
 * mot-clé d'objet, sur tout l'arbre « Emetteurs » — indépendante du classement
 * manuel dans les sous-dossiers.
 */
async function runMessages(tok) {
  const user = need(GRAPH_USER, 'GRAPH_USER')
  const rootId = await findFolderId(tok, user, MAIL_FOLDER)
  if (!rootId) {
    console.log(`::warning::Dossier « ${MAIL_FOLDER} » introuvable — aucune sélection possible.`)
    return []
  }
  const domains = MAIL_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
  const keywords = MAIL_KEYWORDS.split(',').map((k) => norm(k).trim()).filter(Boolean)

  const out = []
  for (const fid of await folderTree(tok, user, rootId)) {
    const page = await graph(
      tok,
      `/users/${user}/mailFolders/${fid}/messages?$top=50&$orderby=receivedDateTime desc` +
        `&$select=id,subject,receivedDateTime,hasAttachments,from`,
    )
    for (const m of page.value ?? []) {
      const addr = (m.from?.emailAddress?.address ?? '').toLowerCase()
      if (!domains.some((d) => addr.endsWith(d) || addr.includes(d))) continue
      if (MAIL_SENDER && !addr.includes(MAIL_SENDER.toLowerCase())) continue
      const sujet = norm(m.subject)
      if (!keywords.some((k) => sujet.includes(k))) continue
      out.push(m)
    }
  }
  return out.sort((a, b) => (a.receivedDateTime < b.receivedDateTime ? 1 : -1))
}

async function xlsxAttachment(tok, user, messageId) {
  const att = await graph(tok, `/users/${user}/messages/${messageId}/attachments`)
  const file = (att.value ?? []).find(
    (a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && /\.xlsx$/i.test(a.name),
  )
  if (!file) return null
  return Buffer.from(file.contentBytes, 'base64')
}

// Mappe les colonnes par nom d'en-tête (robuste aux décalages).
function col(headers, ...keys) {
  return headers.findIndex((h) =>
    keys.some((k) => String(h ?? '').toLowerCase().includes(k)),
  )
}
function clean(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' || s === '#NAME?' || s.toUpperCase() === 'N/A' ? null : s
}
function num(v) {
  if (v == null) return null
  const m = String(v).match(/-?\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : null
}

function parse(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  const h = rows[0]
  const ix = {
    ticker: col(h, 'ticker', 'indice'),
    emetteur: col(h, 'emetteur', 'émetteur'),
    type: col(h, 'type'),
    strike: col(h, 'strike'),
    uf: col(h, 'uf', 'upfront'),
    reoffer: col(h, 'reoffer', 're-offer', 'prix reoffer'),
    coupon: col(h, 'coupon'),
    memoire: col(h, 'memoire', 'mémoire'),
    barriereCoupon: col(h, 'barriere coupon', 'barrière coupon'),
    barriereProtection: col(h, 'barriere protection', 'barrière protection', 'protection'),
    departAutocall: col(h, 'depart', 'départ'),
    frequence: col(h, 'frequence', 'fréquence'),
    degressivite: col(h, 'degressiv', 'dégressiv'),
    seuilInitial: col(h, 'seuil'),
    maturiteMax: col(h, 'maturite', 'maturité'),
    secteur: col(h, 'secteur'),
    dateRun: col(h, 'date'),
  }
  const at = (r, i) => (i >= 0 ? r[i] : null)
  // Upfront depuis le mail : si la colonne « reoffer » existe, upfront = 100 − reoffer
  // (ex. reoffer 95 → upfront 5). Sinon on prend la colonne upfront telle quelle.
  // Ces upfronts viennent du mail → affichés bruts (ufFromMail), sans commission CMF.
  const ufDepuisMail = (r) => {
    const ro = num(at(r, ix.reoffer))
    if (typeof ro === 'number') return `${(100 - ro).toFixed(2)}%`
    return clean(at(r, ix.uf))
  }
  return rows
    .slice(1)
    .filter((r) => clean(at(r, ix.ticker)))
    .map((r) => ({
      ticker: clean(at(r, ix.ticker)),
      emetteur: clean(at(r, ix.emetteur)),
      type: clean(at(r, ix.type)),
      strike: clean(at(r, ix.strike)),
      uf: ufDepuisMail(r),
      ufFromMail: true,
      couponPa: num(at(r, ix.coupon)),
      memoire: /oui/i.test(String(at(r, ix.memoire) ?? '')),
      barriereCoupon: clean(at(r, ix.barriereCoupon)),
      barriereProtection: clean(at(r, ix.barriereProtection)),
      departAutocall: clean(at(r, ix.departAutocall)),
      frequence: clean(at(r, ix.frequence)),
      degressivite: clean(at(r, ix.degressivite)),
      seuilInitial: clean(at(r, ix.seuilInitial)),
      maturiteMax: clean(at(r, ix.maturiteMax)),
      secteur: clean(at(r, ix.secteur)),
      dateRun: clean(at(r, ix.dateRun)),
    }))
}

async function main() {
  // Secrets Graph absents (repo pas encore configuré) : on SKIP proprement
  // (exit 0) au lieu de planter → pas d'email « Run failed » à chaque cron.
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) {
    console.log('⏭️  Microsoft Graph non configuré (secrets GRAPH_* absents) — synchro ignorée.')
    return
  }
  const tok = await token()
  const user = need(GRAPH_USER, 'GRAPH_USER')
  const candidats = await runMessages(tok)
  if (candidats.length === 0) {
    console.log(`Aucun run d'indices à décrément trouvé dans « ${MAIL_FOLDER} » (et sous-dossiers).`)
    return
  }

  console.log(`${candidats.length} run(s) candidat(s) dans « ${MAIL_FOLDER} » :`)
  for (const m of candidats.slice(0, 15))
    console.log(`  · ${m.receivedDateTime.slice(0, 10)}  ${m.from?.emailAddress?.address ?? '?'}  « ${m.subject} »`)

  // Parsing automatique : uniquement les runs livrés en pièce jointe .xlsx.
  // Les grilles envoyées en TABLEAU HTML dans le corps (BNPP, BofA, Citi, UBS,
  // BBVA) ne sont pas parsées ici — chaque émetteur a sa mise en page.
  const avecXlsx = []
  const sansXlsx = []
  for (const m of candidats) {
    if (m.hasAttachments && (await xlsxAttachment(tok, user, m.id))) avecXlsx.push(m)
    else sansXlsx.push(m)
  }

  // Rendre le trou VISIBLE plutôt que de sortir en silence : c'est ce silence
  // qui a laissé la grille figée pendant des semaines.
  if (sansXlsx.length) {
    console.log(
      `::warning::${sansXlsx.length} run(s) détecté(s) mais NON parsable(s) automatiquement ` +
        `(grille en tableau HTML, pas de .xlsx) — à intégrer à la main : ` +
        sansXlsx.slice(0, 8).map((m) => `${m.receivedDateTime.slice(0, 10)} ${m.subject}`).join(' · '),
    )
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs')
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        ['## Runs décrément à intégrer à la main', '', ...sansXlsx.map((m) => `- **${m.receivedDateTime.slice(0, 10)}** — ${m.subject}`), ''].join('\n'),
      )
    }
  }

  const msg = avecXlsx[0]
  if (!msg) {
    console.log('Aucun run avec pièce jointe .xlsx — comparatif inchangé.')
    return
  }
  console.log(`Mail retenu pour le parsing : « ${msg.subject} » (${msg.receivedDateTime}).`)
  const buf = await xlsxAttachment(tok, user, msg.id)
  const rows = parse(buf)
  if (rows.length < 5) {
    console.log(`Parse douteux (${rows.length} lignes) — mise à jour ignorée.`)
    return
  }
  writeFileSync(OUT, JSON.stringify(rows, null, 0) + '\n')
  console.log(`decrement-comparatif.json mis à jour : ${rows.length} indices.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
