#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Synchronise le dossier OneDrive « Termsheets » avec l'app.
//
//  1. liste les fichiers du dossier (Microsoft Graph, auth application) ;
//  2. réécrit lib/termsheets-index.json → l'app fait apparaître AUTOMATIQUEMENT
//     chaque nouvelle TS comme produit (identité depuis le nom de fichier) ;
//  3. (optionnel, SYNC_RENAME=true) renomme les fichiers non conformes à la
//     nomenclature, en lisant les noms cibles sur l'app déployée
//     (GET /api/lifecycle/termsheet-targets).
//
//  Variables d'environnement (secrets GitHub Actions) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET  → app Azure AD
//    GRAPH_DRIVE_ID            → id du drive OneDrive de l_sebah_cmf_finance
//      (ou GRAPH_USER = l_sebah@cmf.finance pour résoudre /users/{user}/drive)
//    GRAPH_FOLDER_PATH         → défaut "Documents/Termsheets"
//    APP_URL                   → base de l'app déployée (pour le renommage)
//    SYNC_RENAME               → "true" pour activer le renommage
//
//  Permissions Graph requises : Files.Read.All (lecture) ou Files.ReadWrite.All
//  (si renommage). Consentement administrateur du tenant cmf.finance.
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs'

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  GRAPH_DRIVE_ID,
  GRAPH_USER,
  GRAPH_FOLDER_PATH = 'Documents/Termsheets',
  APP_URL,
  SYNC_RENAME,
} = process.env

const INDEX_PATH = new URL('../lib/termsheets-index.json', import.meta.url)

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

// Base du drive : /drives/{id} ou /users/{user}/drive.
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
  // Secrets Graph absents (repo pas encore configuré) : on SKIP proprement
  // (exit 0) au lieu de planter → pas d'email « Run failed » à chaque cron.
  if (!GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_TENANT_ID) {
    console.log('⏭️  Microsoft Graph non configuré (secrets GRAPH_* absents) — synchro ignorée.')
    return
  }
  const tok = await token()
  let files = await listFolder(tok)
  console.log(`Dossier Termsheets : ${files.length} fichiers.`)

  // Renommage vers la nomenclature — PILOTÉ PAR FICHIER (gère les nouveaux docs
  // déposés, et TS/KID/TM/Brochure d'un même ISIN sans collision) :
  //  1. l'ISIN est lu dans le nom du fichier (regex ISO 6166) ;
  //  2. le suffixe de type de doc (_KID / _TM / _Brochure) est détecté et PRÉSERVÉ ;
  //  3. le nom canonique de base vient de l'app (par ISIN) ;
  //  4. cible = <base sans .pdf> + suffixe + .pdf, renommée si différente.
  // Un fichier sans ISIN lisible dans son nom, ou sans cible canonique valide,
  // n'est PAS renommé (signalé pour contrôle manuel — jamais de nom inventé).
  // Pas de \b : « _ » est un caractère « mot » en regex, donc _ISIN_ n'aurait pas
  // de frontière. Le motif ISO 6166 (2 lettres + 9 alphanum + 1 chiffre) est
  // suffisamment spécifique pour être repéré sans ancrage.
  const ISIN_RE = /[A-Z]{2}[A-Z0-9]{9}[0-9]/
  // Cible canonique valide = commence par YYMMDD_<n>Y_ (métadonnées produit présentes).
  const CIBLE_VALIDE = /^\d{6}_\d+(?:\.\d+)?Y_/
  const docSuffixe = (name) => {
    const s = name.replace(/\.pdf$/i, '')
    if (/[_ -]kid$/i.test(s) || /[_ -]kid[_ -]/i.test(s)) return '_KID'
    if (/[_ -](tm|target[_ -]?market)$/i.test(s)) return '_TM'
    if (/[_ -]brochure$/i.test(s)) return '_Brochure'
    return ''
  }
  const nonRenommes = []
  if (SYNC_RENAME === 'true' && APP_URL) {
    const r = await fetch(`${APP_URL.replace(/\/$/, '')}/api/lifecycle/termsheet-targets`)
    if (r.ok) {
      const { items } = await r.json()
      // ISIN → nom canonique de base (fiable seulement si la cible est conforme).
      const byIsin = new Map(
        items.filter((i) => i.isin && CIBLE_VALIDE.test(i.target || '')).map((i) => [i.isin, i.target]),
      )
      for (const f of files) {
        if (!/\.pdf$/i.test(f.name)) continue
        const isin = (f.name.match(ISIN_RE) || [])[1]
        const base = isin ? byIsin.get(isin) : undefined
        if (!base) {
          nonRenommes.push(f.name)
          continue
        }
        const target = base.replace(/\.pdf$/i, '') + docSuffixe(f.name) + '.pdf'
        if (target !== f.name) {
          try {
            await rename(tok, f.id, target)
            console.log(`Renommé : ${f.name} → ${target}`)
            f.name = target
          } catch (e) {
            console.error(`Échec renommage ${f.name} : ${String(e)}`)
          }
        }
      }
      files = await listFolder(tok) // relecture après renommages
      if (nonRenommes.length) {
        console.log(
          `::warning::${nonRenommes.length} fichier(s) non renommé(s) (ISIN absent du nom ou cible canonique indisponible) : ${nonRenommes.slice(0, 10).join(' · ')}`,
        )
      }
    } else {
      console.error(`API termsheet-targets indisponible (${r.status}) — renommage ignoré.`)
    }
  }

  const names = files.map((f) => f.name).sort((a, b) => a.localeCompare(b, 'fr'))
  const current = JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
  const changed = JSON.stringify(current) !== JSON.stringify(names)
  if (changed) {
    writeFileSync(INDEX_PATH, JSON.stringify(names, null, 0) + '\n')
    console.log(`termsheets-index.json mis à jour (${names.length} entrées).`)
  } else {
    console.log('Aucun changement dans l’index.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
