#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Met à jour la page « Comparatif » (indices décrément / infos émetteurs) à
//  partir du dernier mail « Run Décrement / Comparatif Émetteurs » reçu.
//
//  1. cherche le mail le plus récent (objet ~ Décrement/Comparatif Émetteurs)
//     avec une pièce jointe Excel (Microsoft Graph, Mail.Read) ;
//  2. télécharge le .xlsx, le parse (mêmes colonnes que le comparatif) ;
//  3. réécrit lib/decrement-comparatif.json → la page Comparatif se met à jour.
//
//  Variables d'environnement (secrets GitHub Actions) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET → app Azure AD
//    GRAPH_USER          → boîte à lire (ex. l.sebah@cmf.finance)
//    MAIL_QUERY          → mots-clés objet (défaut "Décrement OR Comparatif")
//    MAIL_SENDER         → (optionnel) filtre expéditeur (ex. prix@cmf.finance)
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
  MAIL_QUERY = 'Décrement OR Comparatif',
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
async function latestRunMessage(tok) {
  const user = need(GRAPH_USER, 'GRAPH_USER')
  const search = encodeURIComponent(`"${MAIL_QUERY}"`)
  const page = await graph(
    tok,
    `/users/${user}/messages?$search=${search}&$top=25&$select=id,subject,receivedDateTime,hasAttachments,from`,
  )
  const msgs = (page.value ?? [])
    .filter((m) => m.hasAttachments)
    .filter((m) => !MAIL_SENDER || (m.from?.emailAddress?.address ?? '').includes(MAIL_SENDER))
    .sort((a, b) => (a.receivedDateTime < b.receivedDateTime ? 1 : -1))
  return msgs[0]
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
    uf: col(h, 'uf'),
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
  return rows
    .slice(1)
    .filter((r) => clean(at(r, ix.ticker)))
    .map((r) => ({
      ticker: clean(at(r, ix.ticker)),
      emetteur: clean(at(r, ix.emetteur)),
      type: clean(at(r, ix.type)),
      strike: clean(at(r, ix.strike)),
      uf: clean(at(r, ix.uf)),
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
  const tok = await token()
  const user = need(GRAPH_USER, 'GRAPH_USER')
  const msg = await latestRunMessage(tok)
  if (!msg) {
    console.log('Aucun mail « Run Décrement » avec pièce jointe trouvé.')
    return
  }
  console.log(`Mail retenu : « ${msg.subject} » (${msg.receivedDateTime}).`)
  const buf = await xlsxAttachment(tok, user, msg.id)
  if (!buf) {
    console.log('Pas de pièce jointe .xlsx dans ce mail.')
    return
  }
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
