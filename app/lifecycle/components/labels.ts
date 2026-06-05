import type { Situation } from '@/lib/lifecycle'

export const SITUATION_LABEL: Record<Situation, string> = {
  positive: 'Situation positive',
  sans_stress: 'Situation sans stress',
  proche_protection: 'Proche de la protection',
  sous_protection: 'Sous la protection',
  non_classe: 'Non classé',
}

export const SITUATION_COLOR: Record<Situation, string> = {
  positive: 'bg-situation-positive',
  sans_stress: 'bg-situation-neutre',
  proche_protection: 'bg-situation-proche',
  sous_protection: 'bg-situation-sous',
  non_classe: 'bg-slate-300',
}

const FREQ_LABEL: Record<string, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
  in_fine: 'In fine',
  autre: 'Autre',
}

export function freqLabel(f: string) {
  return FREQ_LABEL[f] ?? f
}

const ASSET_LABEL: Record<string, string> = {
  equity: 'Equity',
  rates: 'Taux',
  credit: 'Crédit',
  commodity: 'Commo',
  fx: 'Change',
  hybrid: 'Hybride',
}

export function assetLabel(a: string) {
  return ASSET_LABEL[a] ?? a
}
