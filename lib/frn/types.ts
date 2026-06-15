// ─────────────────────────────────────────────────────────────────────────
//  FRN (Fixed Rate Notes) — modèle d'un « prix » (run) envoyé par un émetteur.
// ─────────────────────────────────────────────────────────────────────────
export type Currency = 'EUR' | 'USD'
export type CallType = 'NC' | 'CALLABLE'

export interface FrnQuote {
  id: string
  issuer: string
  currency: Currency
  callType: CallType
  callDetail?: string // ex. « NC1 » (callable = NC1 uniquement)
  maturityYears: number // 1..10
  coupon: number // coupon quoté en %
  uf: number // upfront fee en %
  sensitivity: number | null // duration (sensibilité)
  baseReoffer: number // reoffer de base, défaut 100
  runDate: string // ISO (date du run)
  source?: string // ex. « email CACIB run 11/06 »
}
