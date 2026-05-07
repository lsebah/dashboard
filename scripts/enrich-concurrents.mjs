#!/usr/bin/env node
// Enrichit data/concurrents.json depuis l'API Etalab recherche-entreprises.
// Règle d'or : on ne touche QUE les champs null. Les saisies manuelles sont sacrées.
// Pour rafraîchir un champ auto, mettre le champ à null avant de relancer.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'concurrents.json')
const API_BASE = 'https://recherche-entreprises.api.gouv.fr'

// Tranches d'effectifs INSEE (libellés)
const TRANCHE_EFFECTIFS = {
  NN: 'non renseigné', '00': '0 salarié', '01': '1-2', '02': '3-5', '03': '6-9',
  11: '10-19', 12: '20-49', 21: '50-99', 22: '100-199', 31: '200-249',
  32: '250-499', 41: '500-999', 42: '1 000-1 999', 51: '2 000-4 999',
  52: '5 000-9 999', 53: '10 000+',
}

// Codes APE pertinents (services financiers)
const FINANCIAL_NAF = /^(64|65|66)\d/

const today = () => new Date().toISOString().slice(0, 10)

async function apiSearch(query, opts = {}) {
  const params = new URLSearchParams({ q: query, per_page: String(opts.perPage ?? 5) })
  if (opts.activitePrincipale) params.set('activite_principale', opts.activitePrincipale)
  const url = `${API_BASE}/search?${params}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    if (res.status === 429) {
      // throttling — on attend 2s et on retry
      await new Promise((r) => setTimeout(r, 2000))
      return apiSearch(query, opts)
    }
    throw new Error(`API ${res.status} ${res.statusText} for "${query}"`)
  }
  return res.json()
}

function pickBestMatch(results, name) {
  const active = results.filter((r) => r.etat_administratif === 'A')
  const pool = active.length ? active : results
  // Préférence : NAF financier
  const financial = pool.filter((r) => FINANCIAL_NAF.test(r.activite_principale ?? ''))
  const candidates = financial.length ? financial : pool
  // Match exact ou très proche du nom complet
  const lowered = name.toLowerCase()
  candidates.sort((a, b) => {
    const aMatch = (a.nom_complet ?? '').toLowerCase().includes(lowered) ? 1 : 0
    const bMatch = (b.nom_complet ?? '').toLowerCase().includes(lowered) ? 1 : 0
    return bMatch - aMatch
  })
  return candidates[0] ?? null
}

function extractMostRecentCa(finances) {
  if (!finances || typeof finances !== 'object') return { ca: null, year: null }
  const years = Object.keys(finances).sort().reverse()
  for (const y of years) {
    const ca = finances[y]?.ca
    if (typeof ca === 'number' && ca > 0) {
      return { ca: Math.round(ca), year: Number(y) } // CA stocké en euros bruts
    }
  }
  return { ca: null, year: null }
}

function fillIfNull(target, key, value, sourceLabel, sourcesAcc) {
  if (target[key] == null && value != null) {
    target[key] = value
    sourcesAcc[key] = sourceLabel
    return true
  }
  return false
}

async function enrichOne(competitor) {
  const filledFields = []
  const sourcesAcc = {}
  let entity = null

  // 1. Si pas de SIREN, on cherche par nom
  if (!competitor.siren) {
    try {
      const search = await apiSearch(competitor.name)
      entity = pickBestMatch(search.results ?? [], competitor.name)
      if (entity?.siren) {
        competitor.siren = entity.siren
        sourcesAcc.siren = 'recherche-entreprises'
        filledFields.push('siren')
      }
    } catch (e) {
      console.warn(`  ⚠ search failed for "${competitor.name}": ${e.message}`)
    }
  } else if (competitor.siren) {
    // 2. SIREN connu → fetch direct
    try {
      const search = await apiSearch(competitor.siren, { perPage: 1 })
      entity = search.results?.[0] ?? null
    } catch (e) {
      console.warn(`  ⚠ siren fetch failed for ${competitor.siren}: ${e.message}`)
    }
  }

  if (!entity) return { filled: filledFields, status: 'not_found' }

  // 3. Remplir les champs null
  if (fillIfNull(competitor, 'denomination', entity.nom_complet ?? null, 'recherche-entreprises', sourcesAcc)) filledFields.push('denomination')
  if (fillIfNull(competitor, 'naf', entity.activite_principale ?? null, 'recherche-entreprises', sourcesAcc)) filledFields.push('naf')

  const trancheCode = entity.tranche_effectif_salarie ?? entity.siege?.tranche_effectif_salarie ?? null
  const trancheLabel = trancheCode ? `${trancheCode} (${TRANCHE_EFFECTIFS[trancheCode] ?? '?'})` : null
  if (fillIfNull(competitor, 'trancheEffectifs', trancheLabel, 'recherche-entreprises', sourcesAcc)) filledFields.push('trancheEffectifs')

  const dirigeant = entity.dirigeants?.[0]
  const dirigeantStr = dirigeant
    ? [dirigeant.prenoms, dirigeant.nom].filter(Boolean).join(' ').trim() || dirigeant.denomination || null
    : null
  if (fillIfNull(competitor, 'dirigeant', dirigeantStr, 'recherche-entreprises', sourcesAcc)) filledFields.push('dirigeant')

  const { ca, year } = extractMostRecentCa(entity.finances)
  if (ca != null) {
    if (fillIfNull(competitor, 'ca', ca, 'recherche-entreprises', sourcesAcc)) filledFields.push('ca')
    if (fillIfNull(competitor, 'caYear', year, 'recherche-entreprises', sourcesAcc)) filledFields.push('caYear')
  }

  // 4. Mettre à jour _sources et _lastEnrichedAt
  competitor._sources = { ...(competitor._sources ?? {}), ...sourcesAcc }
  if (filledFields.length > 0) competitor._lastEnrichedAt = today()

  return { filled: filledFields, status: 'ok' }
}

async function main() {
  const raw = await readFile(DATA_PATH, 'utf-8')
  const data = JSON.parse(raw)

  console.log(`📊 ${data.competitors.length} concurrents à traiter\n`)

  let totalFilled = 0
  for (const c of data.competitors) {
    process.stdout.write(`• ${c.name.padEnd(30)} `)
    const { filled, status } = await enrichOne(c)
    if (status === 'not_found') {
      console.log('— pas trouvé')
    } else if (filled.length === 0) {
      console.log('— déjà complet')
    } else {
      console.log(`✓ ${filled.length} champ(s) rempli(s) [${filled.join(', ')}]`)
      totalFilled += filled.length
    }
    // throttle léger pour éviter le rate limit
    await new Promise((r) => setTimeout(r, 200))
  }

  data.updatedAt = today()
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')

  console.log(`\n✅ ${totalFilled} champs remplis au total`)
  console.log(`📝 Fichier mis à jour : ${DATA_PATH}`)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
