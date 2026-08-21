import { NextResponse } from 'next/server'
import { kvConfigured, kvGet, kvSet } from '@/lib/kv'
import { yahooSymbol } from '@/lib/underlyings'
import { INDICES_RADAR } from '@/lib/indices-radar'
import {
  CLE_KV_MEMBRES,
  SOURCE_MEMBRES_BLOOMBERG,
  type Membre,
  type SurcoucheMembres,
} from '@/lib/index-members'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Ingestion depuis le PC Bloomberg (sans git). Protégé par l'en-tête
// `x-prices-api-key` (= process.env.PRICES_API_KEY).
//
// Corps accepté (tous les champs sont optionnels, au moins un requis) :
//   { "prices": { "ISIN": 99.5, … } }            prix mark-to-market par ISIN
//   { "levels": { "SAF FP": 187.2, … } }          niveaux (PX_Last) par ticker Bloomberg
//   { "remove": ["ISIN", …] }                     purge de clés du surcouche prix
//   { "membres": { "CAC": [ { ticker, nom, poids } … ] } }  composition d'indices
//   [ { "isin": "...", "price": 99.5 }, … ]        forme tableau (prix uniquement)
//
// Upsert (fusion) dans Vercel KV : `prices:overlay` et `levels:overlay`.
// Le surcouche est lue par /api/prices et /api/levels puis appliquée par-dessus
// feed.json côté portefeuille (le plus récent gagne).
//
// LA COMPOSITION DES INDICES passe par la même porte, pour la même raison que
// les prix : le terminal est sur le PC de Laurent, le dashboard sur Vercel, et
// rien ne les relie sinon ce POST. Euronext, STOXX et iShares ne se laissant
// pas scraper (job mensuel bredouille sur CAC, SX5E et WORLD), le run Bloomberg
// quotidien rapporte aussi `INDX_MWEIGHT` — cf. scripts/bloomberg_prices.py. Elle
// va dans `indices:membres:overlay`, que le radar pose par-dessus
// data/index-members.json (cf. lib/index-members.ts).
const PRICES_KEY = 'prices:overlay'
const LEVELS_KEY = 'levels:overlay'
const STRIKES_KEY = 'decrement:strikes:overlay'
interface StrikeEntry {
  ticker?: string
  date?: string
  value: number
}
interface StrikesOverlay {
  asof: string
  strikes: Record<string, StrikeEntry>
}
interface PricesOverlay {
  asof: string
  prices: Record<string, number>
}
interface LevelsOverlay {
  asof: string
  levels: Record<string, number>
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null

/** Indices connus du radar : rien d'autre n'a de sens à stocker ici. */
const CLES_RADAR = new Set(INDICES_RADAR.map((i) => i.cle))

interface MembresLus {
  retenus: Membre[]
  /** Tickers Bloomberg sans symbole Yahoo connu — écartés, et dits. */
  ecartes: string[]
}

/**
 * Traduit la liste Bloomberg d'un indice en membres exploitables par le radar.
 *
 * Le radar lit des historiques Yahoo : un membre sans symbole Yahoo ne sert à
 * rien. La conversion se fait ICI, côté serveur, avec la table qui sert déjà
 * aux sous-jacents (lib/underlyings.ts) — et elle refuse de deviner. Un suffixe
 * inventé ne rend pas une erreur, il rend le cours d'une AUTRE société : c'est
 * la pire panne possible sur une planche client. Un ticker non mappable est
 * donc écarté et compté dans la réponse, jamais complété au jugé.
 */
function lireMembres(liste: unknown[]): MembresLus {
  const retenus: Membre[] = []
  const ecartes: string[] = []
  const vus = new Set<string>()
  for (const brut of liste) {
    const e = brut as { ticker?: unknown; nom?: unknown; poids?: unknown }
    const ticker = typeof e?.ticker === 'string' ? e.ticker.trim() : ''
    if (!ticker) {
      ecartes.push('(sans ticker)')
      continue
    }
    const symbole = yahooSymbol(ticker)
    if (!symbole) {
      ecartes.push(ticker)
      continue
    }
    // Deux lignes Bloomberg peuvent retomber sur le même symbole Yahoo (double
    // cotation) : le radar tracerait deux fois le même point.
    if (vus.has(symbole)) continue
    vus.add(symbole)
    const poids = num(e?.poids)
    retenus.push({
      symbole,
      // Le nom est ce qui étiquette le point sur la planche ; à défaut, le
      // ticker reste lisible — on n'invente pas une raison sociale.
      nom: typeof e?.nom === 'string' && e.nom.trim() ? e.nom.trim() : ticker,
      ...(poids !== null ? { poids } : {}),
    })
  }
  return { retenus, ecartes }
}

export async function POST(req: Request) {
  const secret = process.env.PRICES_API_KEY
  if (!secret) {
    return NextResponse.json({ error: 'PRICES_API_KEY non configurée côté serveur.' }, { status: 503 })
  }
  if (req.headers.get('x-prices-api-key') !== secret) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      { error: 'KV non configuré (KV_REST_API_URL / KV_REST_API_TOKEN ou REDIS_URL).' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 })
  }

  // — Prix par ISIN (objet { ISIN: prix } ou tableau [{ isin, price }]) —
  const incomingPrices: Record<string, number> = {}
  const collectPrice = (isin: unknown, price: unknown) => {
    const n = num(price)
    if (typeof isin === 'string' && n !== null) incomingPrices[isin] = n
  }
  let hasPrices = false
  if (Array.isArray(body)) {
    hasPrices = true
    for (const r of body) collectPrice((r as { isin?: unknown })?.isin, (r as { price?: unknown })?.price)
  } else if (body && typeof body === 'object') {
    const p = (body as { prices?: unknown }).prices
    if (p && typeof p === 'object') {
      hasPrices = true
      for (const [k, v] of Object.entries(p)) collectPrice(k, v)
    }
  }

  // — Niveaux des sous-jacents par ticker Bloomberg (PX_Last) —
  const incomingLevels: Record<string, number> = {}
  let hasLevels = false
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const l = (body as { levels?: unknown }).levels
    if (l && typeof l === 'object') {
      hasLevels = true
      for (const [k, v] of Object.entries(l)) {
        const n = num(v)
        if (n !== null) incomingLevels[k] = n
      }
    }
  }

  // — Strikes (valeurs initiales) des indices décrément, par ISIN produit —
  //   { strikes: { "ISIN": { ticker, date, value } } }
  const incomingStrikes: Record<string, StrikeEntry> = {}
  let hasStrikes = false
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const s = (body as { strikes?: unknown }).strikes
    if (s && typeof s === 'object') {
      for (const [isin, v] of Object.entries(s)) {
        const e = v as { ticker?: unknown; date?: unknown; value?: unknown }
        const n = num(e?.value)
        if (n !== null) {
          hasStrikes = true
          incomingStrikes[isin] = {
            value: n,
            ...(typeof e.ticker === 'string' ? { ticker: e.ticker } : {}),
            ...(typeof e.date === 'string' ? { date: e.date } : {}),
          }
        }
      }
    }
  }

  // — Purge de clés du surcouche prix —
  const removeKeys: string[] = []
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const r = (body as { remove?: unknown }).remove
    if (Array.isArray(r)) for (const k of r) if (typeof k === 'string') removeKeys.push(k)
  }

  // — Composition des indices, telle que la rapporte le run Bloomberg —
  //   { membres: { "CAC": [ { ticker, nom, poids }, … ], "SX5E": […] } }
  // L'upsert se fait PAR INDICE : un POST qui ne porte que le CAC laisse
  // l'Euro Stoxx et le MSCI World intacts. À l'intérieur d'un indice, en
  // revanche, la liste reçue remplace l'ancienne — une composition est un tout,
  // fusionner deux photos donnerait un indice qui n'existe pas.
  const incomingMembres: Record<string, MembresLus> = {}
  const indicesInconnus: string[] = []
  const indicesVides: string[] = []
  let hasMembres = false
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const m = (body as { membres?: unknown }).membres
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      for (const [brute, liste] of Object.entries(m)) {
        if (!Array.isArray(liste)) continue
        const cle = brute.trim().toUpperCase()
        if (!CLES_RADAR.has(cle)) {
          indicesInconnus.push(brute)
          continue
        }
        const lu = lireMembres(liste)
        // Un indice dont rien n'est exploitable garde ce qu'il avait : écraser
        // une bonne liste par une liste vide, c'est éteindre le radar en
        // silence le jour où le terminal répond mal.
        if (lu.retenus.length === 0) {
          indicesVides.push(cle)
          continue
        }
        hasMembres = true
        incomingMembres[cle] = lu
      }
    }
  }

  if (!hasPrices && !hasLevels && !hasStrikes && !hasMembres && removeKeys.length === 0) {
    return NextResponse.json(
      {
        error:
          'Rien à ingérer. Attendu { prices }, { levels }, { strikes }, { membres } et/ou { remove }.',
        ...(indicesInconnus.length ? { indicesInconnus } : {}),
        ...(indicesVides.length ? { indicesVides } : {}),
      },
      { status: 400 },
    )
  }

  const asof = new Date().toISOString()
  const out: Record<string, unknown> = { asof, persisted: true }

  if (hasPrices || removeKeys.length) {
    const prev = (await kvGet<PricesOverlay>(PRICES_KEY)) ?? { asof: '', prices: {} }
    const prices = { ...prev.prices, ...incomingPrices }
    for (const k of removeKeys) delete prices[k]
    const ok = await kvSet(PRICES_KEY, { asof, prices })
    out.persisted = (out.persisted as boolean) && ok
    out.prices = {
      accepted: Object.keys(incomingPrices).length,
      removed: removeKeys.length,
      total: Object.keys(prices).length,
    }
  }

  if (hasLevels) {
    const prev = (await kvGet<LevelsOverlay>(LEVELS_KEY)) ?? { asof: '', levels: {} }
    const levels = { ...prev.levels, ...incomingLevels }
    const ok = await kvSet(LEVELS_KEY, { asof, levels })
    out.persisted = (out.persisted as boolean) && ok
    out.levels = { accepted: Object.keys(incomingLevels).length, total: Object.keys(levels).length }
  }

  if (hasStrikes) {
    const prev = (await kvGet<StrikesOverlay>(STRIKES_KEY)) ?? { asof: '', strikes: {} }
    const strikes = { ...prev.strikes, ...incomingStrikes }
    const ok = await kvSet(STRIKES_KEY, { asof, strikes })
    out.persisted = (out.persisted as boolean) && ok
    out.strikes = { accepted: Object.keys(incomingStrikes).length, total: Object.keys(strikes).length }
  }

  if (hasMembres) {
    const prev = (await kvGet<SurcoucheMembres>(CLE_KV_MEMBRES)) ?? { asof: '', indices: {} }
    const indices = { ...(prev.indices ?? {}) }
    for (const [cle, lu] of Object.entries(incomingMembres)) {
      indices[cle] = {
        asof,
        source: SOURCE_MEMBRES_BLOOMBERG,
        membres: lu.retenus,
        ecartes: lu.ecartes.length,
      }
    }
    const ok = await kvSet(CLE_KV_MEMBRES, { asof, indices })
    out.persisted = (out.persisted as boolean) && ok
    out.membres = Object.fromEntries(
      Object.entries(incomingMembres).map(([cle, lu]) => [
        cle,
        {
          accepted: lu.retenus.length,
          dropped: lu.ecartes.length,
          // Un échantillon suffit à diagnostiquer un mappage manquant sans
          // renvoyer huit cents tickers au script.
          droppedSample: lu.ecartes.slice(0, 12),
        },
      ]),
    )
    out.indices = Object.keys(indices).length
  }
  if (indicesInconnus.length) out.indicesInconnus = indicesInconnus
  if (indicesVides.length) out.indicesVides = indicesVides

  return NextResponse.json(out)
}
