#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Boucle de contrôle « contenu vs nom » du dossier Termsheets.
//
//  Pour chaque PDF dont le nom contient un ISIN (nomenclature), télécharge le
//  fichier (Microsoft Graph) et vérifie que CET ISIN apparaît bien dans le
//  texte du PDF. Cas réel qui a motivé ce contrôle : un fichier nommé
//  « …_XS3287495306_BBVA.pdf » contenait la termsheet d'un autre produit
//  (XS3351619633) — l'app affichait alors la mauvaise fiche en toute confiance.
//
//  Extraction de texte SANS dépendance : les flux FlateDecode des PDF sont
//  dégonflés via zlib (stdlib) et le texte brut est scanné. Si AUCUN ISIN
//  n'est lisible dans le PDF (scan image, chiffrement), le fichier est classé
//  « illisible » (à vérifier à la main), PAS en anomalie.
//
//  Sortie :
//    • console + annotations GitHub (::warning / ::error) ;
//    • data/termsheets-content-check.json (rapport committé par le workflow,
//      affichable plus tard dans l'onglet Santé des données).
//  Ne fait JAMAIS échouer le job (exit 0) : le rapport signale, l'humain tranche.
//
//  Variables d'environnement : GRAPH_TENANT_ID, GRAPH_CLIENT_ID,
//  GRAPH_CLIENT_SECRET, GRAPH_DRIVE_ID (ou GRAPH_USER), GRAPH_FOLDER_PATH.
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, appendFileSync } from 'node:fs'
import { inflateSync, inflateRawSync } from 'node:zlib'

const {
  GRAPH_TENANT_ID,
  GRAPH_CLIENT_ID,
  GRAPH_CLIENT_SECRET,
  GRAPH_DRIVE_ID,
  GRAPH_USER,
  GRAPH_FOLDER_PATH = 'Documents/Termsheets',
} = process.env

const OUT = new URL('../data/termsheets-content-check.json', import.meta.url)
const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/g

async function token() {
  const body = new URLSearchParams({
    client_id: GRAPH_CLIENT_ID,
    client_secret: GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const r = await fetch(
    `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body },
  )
  if (!r.ok) throw new Error(`Auth Graph ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token
}

const driveBase = () =>
  GRAPH_DRIVE_ID ? `/drives/${GRAPH_DRIVE_ID}` : `/users/${GRAPH_USER}/drive`

async function graph(tok, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { authorization: `Bearer ${tok}` },
  })
  if (!r.ok) throw new Error(`Graph GET ${path} → ${r.status}: ${await r.text()}`)
  return r
}

async function listFolder(tok) {
  const enc = GRAPH_FOLDER_PATH.split('/').map(encodeURIComponent).join('/')
  let url = `${driveBase()}/root:/${enc}:/children?$select=id,name,file,size&$top=200`
  const out = []
  while (url) {
    const page = await (await graph(tok, url)).json()
    for (const it of page.value ?? []) if (it.file) out.push({ id: it.id, name: it.name, size: it.size })
    const next = page['@odata.nextLink']
    url = next ? next.replace('https://graph.microsoft.com/v1.0', '') : null
  }
  return out
}

/** Texte « brut » d'un PDF : concatène le fichier + tous les flux dégonflés. */
function pdfText(buf) {
  const chunks = [buf.toString('latin1')]
  let i = 0
  while (true) {
    const s = buf.indexOf('stream', i)
    if (s < 0) break
    // Le flux commence après "stream" + EOL ; se termine à "endstream".
    let start = s + 6
    if (buf[start] === 0x0d) start++
    if (buf[start] === 0x0a) start++
    const e = buf.indexOf('endstream', start)
    if (e < 0) break
    const raw = buf.subarray(start, e)
    for (const inflate of [inflateSync, inflateRawSync]) {
      try {
        chunks.push(inflate(raw).toString('latin1'))
        break
      } catch {
        /* pas un flux Flate — on ignore */
      }
    }
    i = e + 9
  }
  return chunks.join('\n')
}

async function main() {
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET) {
    console.log('⏭️  Secrets Graph absents — contrôle contenu/nom ignoré.')
    return
  }
  const tok = await token()
  const files = (await listFolder(tok)).filter((f) => /\.pdf$/i.test(f.name))
  const report = { asof: new Date().toISOString(), total: files.length, anomalies: [], illisibles: [], ok: 0 }

  for (const f of files) {
    const named = f.name.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/)?.[0]
    if (!named) continue // pas d'ISIN dans le nom → hors périmètre (lint séparé)
    let text
    try {
      const r = await graph(tok, `${driveBase()}/items/${f.id}/content`)
      text = pdfText(Buffer.from(await r.arrayBuffer()))
    } catch (e) {
      report.illisibles.push({ fichier: f.name, raison: `téléchargement/parse : ${String(e).slice(0, 120)}` })
      continue
    }
    const found = [...new Set([...text.matchAll(ISIN_RE)].map((m) => m[1]))]
    if (found.includes(named)) {
      report.ok++
    } else if (found.length === 0) {
      report.illisibles.push({ fichier: f.name, raison: 'aucun ISIN lisible dans le PDF (scan/image ?)' })
    } else {
      report.anomalies.push({ fichier: f.name, isinNom: named, isinsContenu: found.slice(0, 5) })
      console.log(`::error::TS mal nommée ? « ${f.name} » : l'ISIN du nom (${named}) est ABSENT du contenu (trouvés : ${found.slice(0, 3).join(', ')})`)
    }
  }

  for (const il of report.illisibles)
    console.log(`::warning::TS illisible pour le contrôle : « ${il.fichier} » (${il.raison})`)
  console.log(
    `Contrôle contenu/nom : ${report.ok} OK, ${report.anomalies.length} anomalie(s), ${report.illisibles.length} illisible(s) sur ${report.total} PDF.`,
  )

  writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n')
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## Contrôle termsheets : contenu vs nom',
      `- ${report.ok} OK · ${report.anomalies.length} anomalie(s) · ${report.illisibles.length} illisible(s)`,
      ...report.anomalies.map((a) => `- ❌ **${a.fichier}** — nom : ${a.isinNom}, contenu : ${a.isinsContenu.join(', ')}`),
    ]
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
  }
}

main().catch((e) => {
  // Signale mais ne casse pas la synchro (le rapport est un contrôle, pas un gate).
  console.error(`::warning::Contrôle contenu/nom en échec : ${String(e).slice(0, 200)}`)
})
