#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Inventorie le dossier OneDrive « Documents ▸ Clients » et écrit
//  data/client-docs.json — l'onglet Maintenance y lit la présence du DER et la
//  liste des autres pièces de chaque client.
//
//  Côté poste de Laurent, ce dossier est :
//      C:\Users\lseba\OneDrive - CMF\Documents\Clients\<dossier client>
//  Vercel ne peut pas atteindre un chemin Windows local : c'est donc un job
//  GitHub qui liste le dossier via Microsoft Graph et versionne l'inventaire —
//  exactement le mécanisme déjà en place pour les termsheets.
//
//  On liste UN niveau de sous-dossiers (un dossier par client) et les fichiers
//  qu'ils contiennent. Les fichiers déposés à la racine sont signalés mais pas
//  rattachés : on ne devine pas à quel client appartient un document.
//
//  Variables d'environnement (secrets GitHub Actions) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET  → app Azure AD
//    GRAPH_DRIVE_ID   → id du drive OneDrive (ou GRAPH_USER pour le résoudre)
//    GRAPH_USER       → ex. l.sebah@cmf.finance
//    CLIENTS_FOLDER_PATH → défaut « Documents/Clients »
//
//  Permission Graph requise : Files.Read.All (lecture seule suffit).
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs'

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  GRAPH_DRIVE_ID,
  GRAPH_USER,
  CLIENTS_FOLDER_PATH = 'Documents/Clients',
} = process.env

const INVENTAIRE = new URL('../data/client-docs.json', import.meta.url)

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

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/')

/** Enfants d'un dossier (fichiers ET sous-dossiers), pagination suivie. */
async function children(tok, folderPath) {
  let url = `${driveBase()}/root:/${encPath(folderPath)}:/children?$select=id,name,file,folder,size,lastModifiedDateTime,webUrl&$top=200`
  const out = []
  while (url) {
    const page = await graph(tok, url)
    out.push(...(page.value ?? []))
    const next = page['@odata.nextLink']
    url = next ? next.replace('https://graph.microsoft.com/v1.0', '') : null
  }
  return out
}

async function main() {
  // Secrets absents : SKIP propre (exit 0). Le job reste vert et l'inventaire
  // conserve sa valeur précédente — on ne remplace jamais des documents connus
  // par un inventaire vide, qui ferait afficher « DER absent » partout.
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) {
    console.log('⏭️  Microsoft Graph non configuré (secrets GRAPH_* absents) — inventaire clients inchangé.')
    return
  }

  const tok = await token()
  const racine = await children(tok, CLIENTS_FOLDER_PATH)
  const sousDossiers = racine.filter((it) => it.folder)
  const fichiersRacine = racine.filter((it) => it.file)

  const dossiers = {}
  for (const d of sousDossiers) {
    const items = await children(tok, `${CLIENTS_FOLDER_PATH}/${d.name}`)
    dossiers[d.name] = items
      .filter((it) => it.file)
      .map((it) => ({
        nom: it.name,
        taille: typeof it.size === 'number' ? it.size : undefined,
        modifie: it.lastModifiedDateTime,
        url: it.webUrl,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    console.log(`  ${d.name.padEnd(30)} ${dossiers[d.name].length} fichier(s)`)
  }

  if (fichiersRacine.length) {
    // On ne devine pas le propriétaire d'un document posé à la racine : il est
    // signalé pour classement, jamais rattaché à un client au jugé.
    console.log(`::warning::${fichiersRacine.length} fichier(s) à la racine de ${CLIENTS_FOLDER_PATH}, non rattachés à un client : ${fichiersRacine.map((f) => f.name).join(', ')}`)
  }

  // On conserve le _README du fichier existant (documentation du format).
  let readme
  try {
    readme = JSON.parse(readFileSync(INVENTAIRE, 'utf8'))._README
  } catch {
    /* premier passage */
  }

  const out = {
    _README: readme,
    genere: new Date().toISOString(),
    racine: CLIENTS_FOLDER_PATH,
    dossiers,
  }
  writeFileSync(INVENTAIRE, `${JSON.stringify(out, null, 2)}\n`)
  const total = Object.values(dossiers).reduce((n, f) => n + f.length, 0)
  console.log(`OK — ${sousDossiers.length} dossier(s) client, ${total} document(s) inventorié(s).`)
}

main().catch((e) => {
  console.error('ÉCHEC :', e.message)
  process.exit(1)
})
