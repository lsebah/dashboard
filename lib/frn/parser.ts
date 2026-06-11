// ─────────────────────────────────────────────────────────────────────────
//  Parser de runs FRN collés depuis un email émetteur. HEURISTIQUE : les
//  formats varient ⇒ on extrait au mieux (émetteur, devise, maturité, coupon,
//  UF, sensibilité, NC/Callable) et on laisse l'utilisateur corriger dans la
//  prévisualisation éditable. Structuré pour accueillir des règles par émetteur.
// ─────────────────────────────────────────────────────────────────────────
import type { Currency, CallType } from './types'
import { detectIssuer } from './issuers'

export interface ParsedRow {
  maturityYears: number | null
  coupon: number | null
  uf: number | null
  sensitivity: number | null
  callType: CallType
  callDetail?: string
}

export interface ParseResult {
  issuer: string | null
  currency: Currency | null
  rows: ParsedRow[]
  warnings: string[]
}

const n = (s: string | undefined): number | null => {
  if (!s) return null
  const v = parseFloat(s.replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

function detectCurrency(text: string): Currency | null {
  if (/\b(usd|\$|dollar)\b/i.test(text)) return 'USD'
  if (/\b(eur|€|euro)\b/i.test(text)) return 'EUR'
  return null
}

// Callable détecté sur une ligne (callable = NC1 par convention ici).
function lineCall(line: string): { callType: CallType; callDetail?: string } {
  const m = line.match(/\bnc\s?(\d{1,2})\b/i)
  if (m) return { callType: 'CALLABLE', callDetail: `NC${m[1]}` }
  if (/\bcallable\b/i.test(line)) return { callType: 'CALLABLE', callDetail: 'NC1' }
  return { callType: 'NC' }
}

const RE_MAT = /(\d{1,2})\s*(?:y|yr|yrs|years?|ans?)\b/i
const RE_PCT = /(\d{1,2}[.,]\d{1,2})\s*%/ // premier pourcentage = coupon
const RE_UF = /(?:uf|up[\s-]?front|fee)\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%?/i
const RE_SENSI = /(?:sensi(?:bilit[ée])?|sens|duration|dur)\s*[:=]?\s*(\d{1,2}(?:[.,]\d{1,2})?)/i

/** Analyse un texte de run et renvoie des lignes éditables + avertissements. */
export function parseRun(text: string): ParseResult {
  const issuer = detectIssuer(text)
  const currency = detectCurrency(text)
  const rows: ParsedRow[] = []
  const warnings: string[] = []
  if (!issuer) warnings.push('Émetteur non reconnu — à sélectionner.')
  if (!currency) warnings.push('Devise non détectée — à choisir (EUR/USD).')

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const mMat = line.match(RE_MAT)
    if (!mMat) continue // une ligne sans maturité n'est pas un prix
    const maturityYears = n(mMat[1])
    // Coupon : on ignore un % collé à « UF » pour ne pas confondre.
    const withoutUf = line.replace(RE_UF, ' ')
    const mCpn = withoutUf.match(RE_PCT)
    const coupon = n(mCpn?.[1])
    const uf = n(line.match(RE_UF)?.[1])
    const sensitivity = n(line.match(RE_SENSI)?.[1])
    const call = lineCall(line)
    if (maturityYears == null || coupon == null) {
      warnings.push(`Ligne ignorée (maturité/coupon manquant) : « ${line.slice(0, 48)} »`)
      continue
    }
    rows.push({ maturityYears, coupon, uf, sensitivity, callType: call.callType, callDetail: call.callDetail })
  }

  if (rows.length === 0) warnings.push('Aucune ligne de prix exploitable — saisie manuelle possible.')
  return { issuer, currency, rows, warnings }
}
