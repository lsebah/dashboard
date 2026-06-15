// ─────────────────────────────────────────────────────────────────────────
//  Tranches iTraxx (CLN sur indices de crédit iTraxx Main / Crossover).
//  Données réelles transcrites des runs « CLN Tranches » reçus par email.
// ─────────────────────────────────────────────────────────────────────────
export type ItraxxIndex = 'Main' | 'Crossover'

export interface ItraxxTranche {
  id: string
  index: ItraxxIndex
  series?: string // ex. « S45 »
  tranche: string // ex. « 3-6% »
  attachment?: number // point d'attachement (%)
  detachment?: number // point de détachement (%)
  maturityYears?: number
  coupon?: number | null // coupon (unité dans couponUnit)
  couponUnit?: string // '%' | 'bps'
  couponType?: string // 'fixed' | 'floating' | 'balloon' | 'zero recovery' | 'combo'
  format?: string // ex. « Zero Recovery », « 100% Capital Protected », « Balloon »
  issuer?: string
  devise?: string
  runDate?: string // ISO
  source?: string
}
