#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Run FRN (Fixed Rate Note / Note à Taux Fixe) par email.
//  Calqué sur scripts/sync-issuer-runs.mjs : lit les mails de run FRN classés
//  dans le sous-dossier Outlook « Exchange FRN », extrait les prix (émetteur,
//  devise, maturité, coupon, upfront, sensibilité, NC/Callable) et met à jour
//  data/frn-quotes.json. Le run le PLUS RÉCENT par couple
//  (émetteur, devise, type, maturité) écrase les précédents.
//
//  Parsing : pièce jointe .xlsx si présente (colonnes par en-tête), sinon le
//  CORPS texte du mail (heuristiques — miroir de lib/frn/parser.ts).
//
//  Variables d'environnement (secrets / variables GitHub Actions) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET → app Azure AD
//    GRAPH_USER          → boîte à lire (défaut l.sebah@cmf.finance)
//    FRN_MAIL_FOLDER     → nom du sous-dossier (défaut « Exchange FRN »)
//    FRN_MAIL_FOLDER_ID  → (optionnel) id Graph du dossier, court-circuite la recherche
//    FRN_MAIL_QUERY      → repli $search si le dossier est introuvable
//                          (défaut « FRN OR "Taux Fixe" OR "Fixed Rate" »)
//    FRN_MAIL_SENDER     → (optionnel) filtre expéditeur
//    FRN_MAX_MSGS        → nb de mails récents à parser (défaut 10)
//
//  Permission Graph requise : Mail.Read (application) — consentement admin.
//  Dépendance : xlsx (SheetJS), installée par le workflow.
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  GRAPH_USER = 'l.sebah@cmf.finance',
  FRN_MAIL_FOLDER = 'Exchange FRN',
  FRN_MAIL_FOLDER_ID,
  FRN_MAIL_QUERY = 'FRN OR "Taux Fixe" OR "Fixed Rate"',
  FRN_MAIL_SENDER,
  FRN_MAX_MSGS = '10',
} = process.env

const OUT = new URL('../data/frn-quotes.json', import.meta.url)
const need = (v, n) => { if (!v) throw new Error(`Variable manquante : ${n}`); return v }

// ── Émetteurs connus (miroir compact de lib/frn/issuers.ts) ─────────────────
const ISSUERS = [
  ['CACIB', ['credit agricole', 'crédit agricole', 'ca-cib', 'casa', 'cacib']],
  ['CIC', ['credit industriel', 'crédit mutuel', 'bfcm', 'cic']],
  ['SG', ['socgen', 'societe generale', 'société générale', 'sg issuer', 'sg ']],
  ['BNP', ['bnp paribas', 'bnpp', 'bnp']],
  ['Barclays', ['barclays', 'barc']],
  ['GS', ['goldman', 'gsi', 'gs ']],
  ['Citi', ['citigroup', 'citibank', 'citi']],
  ['Santander', ['banco santander', 'santan', 'santander']],
  ['BBVA', ['banco bilbao', 'bbva']],
  ['CIBC', ['canadian imperial', 'cibc']],
  ['Nomura', ['nomura']],
  ['DB', ['deutsche bank', 'db structured', 'db-structured', 'db.com']],
  ['BofA', ['bank of america', 'bofa', 'baml', 'merrill', 'distributionfrance']],
  ['Mediobanca', ['mediobanca']],
  ['Marex', ['marex']],
]
const ORDER = new Map(ISSUERS.map(([n], i) => [n, i]))
function detectIssuer(text) {
  const hay = (text || '').toLowerCase()
  for (const [name, aliases] of ISSUERS) {
    if (hay.includes(name.toLowerCase())) return name
    for (const a of aliases) if (hay.includes(a)) return name
  }
  return null
}
function detectCurrency(text) {
  if (/\b(usd|\$|dollar)\b/i.test(text)) return 'USD'
  if (/\b(eur|€|euro)\b/i.test(text)) return 'EUR'
  return null
}

// ── Plomberie Microsoft Graph (auth application) ────────────────────────────
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
  const r = await fetch(path.startsWith('http') ? path : `https://graph.microsoft.com/v1.0${path}`, {
    headers: { authorization: `Bearer ${tok}` },
  })
  if (!r.ok) throw new Error(`Graph ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

// Résout l'id d'un dossier (même imbriqué) par son displayName — BFS borné.
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

// Mails de run : depuis le dossier si trouvé, sinon repli $search mailbox-wide.
async function runMessages(tok, user) {
  const sel = '$select=id,subject,receivedDateTime,hasAttachments,from,body,bodyPreview'
  const top = Math.max(1, Math.min(50, parseInt(FRN_MAX_MSGS, 10) || 10))
  let fid = FRN_MAIL_FOLDER_ID || (await findFolderId(tok, user, FRN_MAIL_FOLDER))
  let msgs
  if (fid) {
    const page = await graph(tok, `/users/${user}/mailFolders/${fid}/messages?${sel}&$top=${top}&$orderby=receivedDateTime desc`)
    msgs = page.value ?? []
    console.log(`Dossier « ${FRN_MAIL_FOLDER} » : ${msgs.length} mail(s).`)
  } else {
    console.log(`Dossier « ${FRN_MAIL_FOLDER} » introuvable — repli sur recherche « ${FRN_MAIL_QUERY} ».`)
    const page = await graph(tok, `/users/${user}/messages?$search=${encodeURIComponent(`"${FRN_MAIL_QUERY}"`)}&${sel}&$top=${top}`)
    msgs = (page.value ?? []).sort((a, b) => (a.receivedDateTime < b.receivedDateTime ? 1 : -1))
  }
  return msgs.filter((m) => !FRN_MAIL_SENDER || (m.from?.emailAddress?.address ?? '').includes(FRN_MAIL_SENDER))
}

// ── Parsing texte (corps du mail) — miroir de lib/frn/parser.ts ─────────────
const num = (s) => {
  if (s == null) return null
  const v = parseFloat(String(s).replace(',', '.'))
  return Number.isFinite(v) ? v : null
}
const RE_MAT = /(\d{1,2})\s*(?:y|yr|yrs|years?|ans?)\b/i
const RE_PCT = /(\d{1,2}[.,]\d{1,2})\s*%/
const RE_UF = /(?:uf|up[\s-]?front|fee)\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%?/i
const RE_SENSI = /(?:sensi(?:bilit[ée])?|sens|duration|dur)\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,2})?)/i
function lineCall(line) {
  const m = line.match(/\bnc\s?(\d{1,2})\b/i)
  if (m) return { callType: 'CALLABLE', callDetail: `NC${m[1]}` }
  if (/\bcallable\b/i.test(line)) return { callType: 'CALLABLE', callDetail: 'NC1' }
  return { callType: 'NC' }
}
function parseBody(text, fallbackCcy) {
  const rows = []
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const mMat = line.match(RE_MAT)
    if (!mMat) continue
    const maturityYears = num(mMat[1])
    const coupon = num(line.replace(RE_UF, ' ').match(RE_PCT)?.[1])
    if (maturityYears == null || coupon == null) continue
    const call = lineCall(line)
    rows.push({
      maturityYears, coupon,
      uf: num(line.match(RE_UF)?.[1]) ?? 0,
      sensitivity: num(line.match(RE_SENSI)?.[1]),
      callType: call.callType, callDetail: call.callDetail,
      currency: detectCurrency(line) || fallbackCcy,
    })
  }
  return rows
}

// ── Parsing pièce jointe .xlsx (colonnes par en-tête) ───────────────────────
function col(headers, ...keys) {
  return headers.findIndex((h) => keys.some((k) => String(h ?? '').toLowerCase().includes(k)))
}
function parseXlsx(buf, fallbackIssuer, fallbackCcy) {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })
  if (!rows.length) return []
  const h = rows[0]
  const ix = {
    issuer: col(h, 'emetteur', 'émetteur', 'issuer'),
    ccy: col(h, 'devise', 'currency', 'ccy'),
    mat: col(h, 'maturite', 'maturité', 'maturity', 'tenor'),
    coupon: col(h, 'coupon', 'cpn'),
    uf: col(h, 'uf', 'upfront', 'fee'),
    reoffer: col(h, 'reoffer', 're-offer'),
    sensi: col(h, 'sensi', 'duration', 'dur'),
    call: col(h, 'call', 'nc', 'type'),
  }
  const at = (r, i) => (i >= 0 ? r[i] : null)
  return rows.slice(1).map((r) => {
    const callTxt = String(at(r, ix.call) ?? '')
    const ncm = callTxt.match(/nc\s?(\d{1,2})/i)
    const callable = !!ncm || /callable/i.test(callTxt)
    const ro = num(at(r, ix.reoffer))
    return {
      issuer: (col(h, 'emetteur') >= 0 ? String(at(r, ix.issuer) || '') : '') || fallbackIssuer,
      currency: (/usd/i.test(String(at(r, ix.ccy))) ? 'USD' : /eur/i.test(String(at(r, ix.ccy))) ? 'EUR' : fallbackCcy),
      maturityYears: num(at(r, ix.mat)),
      coupon: num(at(r, ix.coupon)),
      uf: num(at(r, ix.uf)) ?? (typeof ro === 'number' ? 100 - ro : 0),
      sensitivity: num(at(r, ix.sensi)),
      callType: callable ? 'CALLABLE' : 'NC',
      callDetail: ncm ? `NC${ncm[1]}` : callable ? 'NC1' : undefined,
    }
  }).filter((q) => q.maturityYears != null && q.coupon != null)
}

async function xlsxAttachment(tok, user, messageId) {
  const att = await graph(tok, `/users/${user}/messages/${messageId}/attachments`)
  const file = (att.value ?? []).find(
    (a) => a['@odata.type'] === '#microsoft.graph.fileAttachment' && /\.xlsx?$/i.test(a.name),
  )
  return file ? Buffer.from(file.contentBytes, 'base64') : null
}

// ── Construction d'un FrnQuote normalisé ────────────────────────────────────
function toQuote(p, issuer, runDate, source) {
  const iss = (p.issuer && detectIssuer(p.issuer)) || issuer
  const ccy = p.currency || 'EUR'
  const callType = p.callType || 'NC'
  const maturityYears = Number(p.maturityYears)
  return {
    id: `${iss}-${ccy}-${callType}-${maturityYears}`,
    issuer: iss,
    currency: ccy,
    callType,
    ...(p.callDetail ? { callDetail: p.callDetail } : {}),
    maturityYears,
    coupon: Number(p.coupon),
    uf: typeof p.uf === 'number' ? p.uf : 0,
    sensitivity: typeof p.sensitivity === 'number' ? p.sensitivity : null,
    baseReoffer: 100,
    runDate,
    source,
  }
}
const quoteKey = (q) => `${q.issuer}|${q.currency}|${q.callType}|${q.maturityYears}`
function mergeLatest(...lists) {
  const m = new Map()
  for (const list of lists)
    for (const q of list) {
      const k = quoteKey(q)
      const cur = m.get(k)
      if (!cur || (q.runDate ?? '') >= (cur.runDate ?? '')) m.set(k, q)
    }
  return [...m.values()].sort(
    (a, b) =>
      (ORDER.get(a.issuer) ?? 99) - (ORDER.get(b.issuer) ?? 99) ||
      a.currency.localeCompare(b.currency) ||
      a.callType.localeCompare(b.callType) ||
      a.maturityYears - b.maturityYears,
  )
}

async function main() {
  // Secrets Graph absents : SKIP propre (exit 0) → pas d'email « Run failed ».
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) {
    console.log('⏭️  Microsoft Graph non configuré (secrets GRAPH_* absents) — run FRN ignoré.')
    return
  }
  const user = GRAPH_USER
  const tok = await token()
  const msgs = await runMessages(tok, user)
  if (!msgs.length) {
    console.log('Aucun mail de run FRN trouvé — rien à faire.')
    return
  }

  const parsed = []
  for (const m of msgs) {
    const dd = (m.receivedDateTime || '').slice(0, 10)
    const ddfr = dd ? `${dd.slice(8, 10)}/${dd.slice(5, 7)}` : ''
    const headerTxt = `${m.subject || ''}\n${m.bodyPreview || ''}`
    const issuer = detectIssuer(headerTxt) || detectIssuer(m.body?.content || '') || 'Inconnu'
    const ccy = detectCurrency(headerTxt) || detectCurrency(m.body?.content || '') || 'EUR'
    const src = `email ${issuer} ${ddfr} — run FRN`

    let rows = []
    if (m.hasAttachments) {
      try {
        const buf = await xlsxAttachment(tok, user, m.id)
        if (buf) rows = parseXlsx(buf, issuer, ccy)
      } catch (e) {
        console.error(`PJ illisible (${m.subject}) : ${String(e)}`)
      }
    }
    if (!rows.length) {
      // Corps HTML → texte grossier (on retire les balises).
      const txt = (m.body?.content || m.bodyPreview || '').replace(/<[^>]+>/g, ' ')
      rows = parseBody(txt, ccy)
    }
    for (const r of rows) if (r.maturityYears && r.coupon != null) parsed.push(toQuote(r, issuer, dd, src))
    console.log(`« ${(m.subject || '').slice(0, 50)} » (${dd}) → ${rows.length} ligne(s), émetteur ${issuer}.`)
  }

  if (!parsed.length) {
    console.log('Aucune ligne de prix exploitable — data/frn-quotes.json inchangé.')
    return
  }

  const current = JSON.parse(readFileSync(OUT, 'utf8'))
  const merged = mergeLatest(current, parsed)
  const changed = JSON.stringify(current) !== JSON.stringify(merged)
  if (changed) {
    writeFileSync(OUT, JSON.stringify(merged, null, 1) + '\n')
    console.log(`frn-quotes.json mis à jour : ${merged.length} quotes (${parsed.length} parsés ce run).`)
  } else {
    console.log('Aucun changement dans frn-quotes.json.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
