#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Télécharge les fiches émetteurs (one-pagers PDF) depuis les mails
//  « [NEW INDEX] » / runs et les range dans public/fiches/<TICKER>.pdf, puis
//  renseigne `fichePdf` dans lib/decrement-indices.json. Le bouton « Fiche »
//  du Comparatif affiche alors le vrai PDF de la banque.
//
//  NB : ceci utilise Microsoft Graph BRUT (/attachments/{id}/$value) qui renvoie
//  les OCTETS du PDF — contrairement au connecteur de chat (lecture = texte
//  extrait uniquement). D'où la nécessité de l'app Azure (Mail.Read).
//
//  Env : GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET,
//        GRAPH_USER (défaut l.sebah@cmf.finance), MAIL_QUERY (défaut "[NEW INDEX] OR Decrement OR Run Indices")
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

const {
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET,
  GRAPH_USER = 'l.sebah@cmf.finance',
  MAIL_QUERY = '"[NEW INDEX]" OR "Run Indices" OR Decrement',
} = process.env

const DIR = new URL('../public/fiches/', import.meta.url)
const INDEX = new URL('../lib/decrement-indices.json', import.meta.url)
const need = (v, n) => { if (!v) throw new Error(`Variable manquante : ${n}`); return v }

async function token() {
  const body = new URLSearchParams({
    client_id: need(GRAPH_CLIENT_ID, 'GRAPH_CLIENT_ID'),
    client_secret: need(GRAPH_CLIENT_SECRET, 'GRAPH_CLIENT_SECRET'),
    scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
  })
  const r = await fetch(`https://login.microsoftonline.com/${need(GRAPH_TENANT_ID,'GRAPH_TENANT_ID')}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) throw new Error(`Auth ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token
}
async function gget(tok, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, { headers: { authorization: `Bearer ${tok}` } })
  if (!r.ok) throw new Error(`Graph ${path} → ${r.status}`)
  return r.json()
}

async function main() {
  const tok = await token()
  const idx = JSON.parse(readFileSync(INDEX, 'utf8'))
  const tickers = Object.keys(idx)
  mkdirSync(DIR, { recursive: true })
  const search = encodeURIComponent(MAIL_QUERY)
  const page = await gget(tok, `/users/${GRAPH_USER}/messages?$search=${search}&$top=50&$select=id,subject,hasAttachments`)
  let saved = 0
  for (const m of (page.value ?? [])) {
    if (!m.hasAttachments) continue
    const att = await gget(tok, `/users/${GRAPH_USER}/messages/${m.id}/attachments?$select=id,name,contentType`)
    for (const a of (att.value ?? [])) {
      if (!/pdf$/i.test(a.name || '') && a.contentType !== 'application/pdf') continue
      // ticker = code en MAJ de 6-9 alphanum trouvé dans le nom de pièce jointe et présent dans la lib
      const codes = (a.name.match(/[A-Z0-9]{5,9}/g) || []).filter((c) => tickers.includes(c))
      const ticker = codes[0]
      if (!ticker) continue
      // octets bruts du PDF
      const r = await fetch(`https://graph.microsoft.com/v1.0/users/${GRAPH_USER}/messages/${m.id}/attachments/${a.id}/$value`,
        { headers: { authorization: `Bearer ${tok}` } })
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      writeFileSync(new URL(`${ticker}.pdf`, DIR), buf)
      idx[ticker] = { ...idx[ticker], fichePdf: `/fiches/${ticker}.pdf` }
      saved++
      console.log(`Fiche ${ticker} ← « ${a.name} » (${buf.length} o)`)
    }
  }
  writeFileSync(INDEX, JSON.stringify(idx, null, 1) + '\n')
  console.log(`Terminé : ${saved} fiches PDF téléchargées.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
