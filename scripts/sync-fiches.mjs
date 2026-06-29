#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Récupère les one-pagers (fiches) des indices à décrément depuis le dossier
//  OneDrive « Fiches Décrements » de l.sebah@cmf.finance, les enregistre dans
//  public/fiches/<TICKER>.pdf et renseigne `fichePdf` dans
//  lib/decrement-indices.json → le ⓘ du Comparatif devient cliquable.
//
//  NB : utilise Microsoft Graph BRUT (downloadUrl / $value) qui renvoie les
//  OCTETS du PDF — le connecteur de chat ne donne que le texte extrait. D'où
//  l'app Azure (permission application Files.Read.All + consentement admin).
//
//  Env : GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET,
//        GRAPH_USER    (défaut l.sebah@cmf.finance)
//        FICHES_FOLDER (défaut « Fiches Décrements »)
//
//  Nommage conseillé des fichiers dans le dossier : inclure le TICKER de
//  l'indice dans le nom (ex. « MQDZC50P - Eurozone Consumer.pdf »). Sinon le
//  script tente un rapprochement par le nom complet de l'indice.
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

const {
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET,
  GRAPH_USER = 'l.sebah@cmf.finance',
  FICHES_FOLDER = 'Fiches Décrements',
} = process.env

const DIR = new URL('../public/fiches/', import.meta.url)
const INDEX = new URL('../lib/decrement-indices.json', import.meta.url)
const need = (v, n) => { if (!v) throw new Error(`Variable manquante : ${n}`); return v }
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

async function token() {
  const body = new URLSearchParams({
    client_id: need(GRAPH_CLIENT_ID, 'GRAPH_CLIENT_ID'),
    client_secret: need(GRAPH_CLIENT_SECRET, 'GRAPH_CLIENT_SECRET'),
    scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
  })
  const r = await fetch(`https://login.microsoftonline.com/${need(GRAPH_TENANT_ID, 'GRAPH_TENANT_ID')}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!r.ok) throw new Error(`Auth ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token
}
async function gget(tok, url) {
  const r = await fetch(url.startsWith('http') ? url : `https://graph.microsoft.com/v1.0${url}`,
    { headers: { authorization: `Bearer ${tok}` } })
  if (!r.ok) throw new Error(`Graph ${url} → ${r.status}: ${await r.text()}`)
  return r.json()
}

// Trouve l'item-dossier « Fiches Décrements » dans le drive de l'utilisateur.
async function folderId(tok) {
  const q = encodeURIComponent(FICHES_FOLDER)
  const res = await gget(tok, `/users/${GRAPH_USER}/drive/root/search(q='${q}')?$select=id,name,folder`)
  const folder = (res.value ?? []).find((x) => x.folder && norm(x.name) === norm(FICHES_FOLDER))
    ?? (res.value ?? []).find((x) => x.folder)
  if (!folder) throw new Error(`Dossier « ${FICHES_FOLDER} » introuvable dans le OneDrive de ${GRAPH_USER}.`)
  return folder.id
}

async function* children(tok, id) {
  let url = `/users/${GRAPH_USER}/drive/items/${id}/children?$select=name,id,file,@microsoft.graph.downloadUrl&$top=200`
  while (url) {
    const page = await gget(tok, url)
    for (const it of (page.value ?? [])) yield it
    url = page['@odata.nextLink'] ?? null
  }
}

// Rapproche un nom de fichier d'un ticker de la librairie d'indices.
function matchTicker(name, idx) {
  const tickers = Object.keys(idx)
  // 1) ticker présent tel quel dans le nom de fichier
  const codes = (name.match(/[A-Z0-9]{5,9}/g) || []).filter((c) => tickers.includes(c))
  if (codes[0]) return codes[0]
  // 2) rapprochement par le nom complet de l'indice (le plus long inclus)
  const n = norm(name)
  let best = null, bestLen = 0
  for (const t of tickers) {
    const nom = norm(idx[t].nom)
    if (nom && nom.length > 6 && n.includes(nom) && nom.length > bestLen) { best = t; bestLen = nom.length }
  }
  return best
}

async function main() {
  // Secrets Graph absents : SKIP propre (exit 0) → pas d'email « Run failed ».
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) {
    console.log('⏭️  Microsoft Graph non configuré (secrets GRAPH_* absents) — fiches ignorées.')
    return
  }
  const tok = await token()
  const idx = JSON.parse(readFileSync(INDEX, 'utf8'))
  mkdirSync(DIR, { recursive: true })
  const fid = await folderId(tok)
  let saved = 0
  for await (const it of children(tok, fid)) {
    if (!it.file || !/pdf$/i.test(it.name || '')) continue
    const ticker = matchTicker(it.name, idx)
    if (!ticker) { console.warn(`Fiche non rattachée (ticker introuvable) : « ${it.name} »`); continue }
    const dl = it['@microsoft.graph.downloadUrl']
    const r = await fetch(dl)
    if (!r.ok) { console.warn(`Téléchargement échoué pour ${it.name} (${r.status})`); continue }
    const buf = Buffer.from(await r.arrayBuffer())
    writeFileSync(new URL(`${ticker}.pdf`, DIR), buf)
    idx[ticker] = { ...idx[ticker], fichePdf: `/fiches/${ticker}.pdf` }
    saved++
    console.log(`Fiche ${ticker} ← « ${it.name} » (${buf.length} o)`)
  }
  const sorted = Object.fromEntries(Object.keys(idx).sort().map((k) => [k, idx[k]]))
  writeFileSync(INDEX, JSON.stringify(sorted, null, 1) + '\n')
  console.log(`Terminé : ${saved} fiches PDF récupérées depuis « ${FICHES_FOLDER} ».`)
}
main().catch((e) => { console.error(e); process.exit(1) })
