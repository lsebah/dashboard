#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Renommage CIBLÉ des termsheets OneDrive non conformes (lot ponctuel).
//
//  Contrairement à sync-termsheets.mjs (qui calcule les cibles depuis l'app et
//  peut toucher beaucoup de fichiers), ce script ne renomme QUE les fichiers
//  listés explicitement ci-dessous (RENAMES) — sûr et limité. Il est idempotent :
//  si la cible existe déjà / la source est absente, il passe.
//
//  Après renommage, il réécrit lib/termsheets-index.json (snapshot du dossier),
//  comme sync-termsheets.mjs, pour garder l'app cohérente.
//
//  Variables d'environnement (mêmes secrets que sync-termsheets.mjs) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET  → app Azure AD
//    GRAPH_DRIVE_ID  (ou GRAPH_USER = l_sebah@cmf.finance)
//    GRAPH_FOLDER_PATH (défaut "Documents/Termsheets")
//  Permission Graph requise : Files.ReadWrite.All (consentement admin cmf.finance).
//
//  Usage : node scripts/rename-termsheets-batch.mjs   (DRY_RUN=true pour simuler)
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs'

// Lot de renommages (current → target). Noms validés contre la nomenclature
// YYMMDD_<durée>Y_<Nom>_<Fréquence>_<ISIN>_<ÉMETTEUR>.pdf.
const RENAMES = [
  {
    current: '231201_2Y_Dette Privée - SIP Chabanais_Semestriel_CH1271361060_.pdf',
    target: '231201_2Y_Dette Privée - SIP Chabanais_Semestriel_CH1271361060_SIP.pdf',
  },
  {
    // Brochure commerciale ADEQUITY (= Société Générale) du produit FR001400OZR1.
    // La TS technique 240404_..._SOCGEN.pdf reste le document principal.
    current:
      '240630_12Y_Phoenix Memory sur Taux en Juin 2024 -  2.30%3.20% (ADEQUITY)_Semestriel_FR001400OZR1_.pdf',
    target:
      '240630_12Y_Phoenix Autocall sur Taux Europe Juin 2024 (ADEQUITY)_Semestriel_FR001400OZR1_SOCGEN_Brochure.pdf',
  },
  {
    current: 'LIR006986_XS2110091449_termsheet_Prelim_EN.pdf',
    target: '240223_15Y_Note Callable Zéro Coupon Citigroup_In Fine_XS2110091449_CITI.pdf',
  },
]

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  GRAPH_DRIVE_ID,
  GRAPH_USER,
  GRAPH_FOLDER_PATH = 'Documents/Termsheets',
  DRY_RUN,
} = process.env

const INDEX_PATH = new URL('../lib/termsheets-index.json', import.meta.url)
const dryRun = DRY_RUN === 'true'

function need(v, name) {
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`)
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

function driveBase() {
  if (GRAPH_DRIVE_ID) return `/drives/${GRAPH_DRIVE_ID}`
  return `/users/${need(GRAPH_USER, 'GRAPH_DRIVE_ID ou GRAPH_USER')}/drive`
}

async function graph(tok, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { authorization: `Bearer ${tok}` },
  })
  if (!r.ok) throw new Error(`Graph GET ${path} → ${r.status}: ${await r.text()}`)
  return r.json()
}

async function listFolder(tok) {
  const enc = GRAPH_FOLDER_PATH.split('/').map(encodeURIComponent).join('/')
  let url = `${driveBase()}/root:/${enc}:/children?$select=id,name,file&$top=200`
  const out = []
  while (url) {
    const page = await graph(tok, url)
    for (const it of page.value ?? []) if (it.file) out.push({ id: it.id, name: it.name })
    const next = page['@odata.nextLink']
    url = next ? next.replace('https://graph.microsoft.com/v1.0', '') : null
  }
  return out
}

async function rename(tok, id, name) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${driveBase()}/items/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) throw new Error(`Rename ${id} → ${name} : ${r.status} ${await r.text()}`)
}

async function main() {
  const tok = await token()
  let files = await listFolder(tok)
  const byName = new Map(files.map((f) => [f.name, f]))
  console.log(`Dossier Termsheets : ${files.length} fichiers.${dryRun ? ' [DRY_RUN]' : ''}`)

  for (const { current, target } of RENAMES) {
    if (byName.has(target)) {
      console.log(`= déjà conforme : ${target}`)
      continue
    }
    const f = byName.get(current)
    if (!f) {
      console.warn(`! introuvable (ignoré) : ${current}`)
      continue
    }
    if (dryRun) {
      console.log(`~ (simulé) ${current}\n           → ${target}`)
      continue
    }
    await rename(tok, f.id, target)
    console.log(`✓ ${current}\n  → ${target}`)
  }

  if (dryRun) return
  files = await listFolder(tok) // relecture après renommages
  const names = files.map((f) => f.name).sort((a, b) => a.localeCompare(b, 'fr'))
  const current = JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
  if (JSON.stringify(current) !== JSON.stringify(names)) {
    writeFileSync(INDEX_PATH, JSON.stringify(names, null, 0) + '\n')
    console.log(`termsheets-index.json mis à jour (${names.length} entrées).`)
  } else {
    console.log('Index inchangé.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
