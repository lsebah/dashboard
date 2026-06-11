// ─────────────────────────────────────────────────────────────────────────
//  Facture « CMF FACTURE GABRIELLE » — construit l'email pré-rempli à envoyer
//  à Gabrielle Salmon (office@cmf.finance), qui édite la facture pour
//  l'émetteur. Format aligné sur le skill existant (onglet Commissions).
// ─────────────────────────────────────────────────────────────────────────
export const GABRIELLE_EMAIL = 'office@cmf.finance'
export const FACTURE_CC = 'p.doize@cmf.finance,t.ballot@cmf.finance'

const num = (n?: number | null) =>
  typeof n === 'number' ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : ''
const pct2 = (n?: number | null) => (typeof n === 'number' ? `${(n * 100).toFixed(2)} %` : '—')
const dateFr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '')

export interface FactureData {
  emetteur?: string | null
  isin: string
  issue?: string | null
  description?: string | null
  nominal?: number | null
  ufPct?: number | null // décimal (0.025 = 2,5 %)
  comTotal?: number | null // montant upfront total (€)
  comClient?: number | null // montant reversé au CGP (€)
  client?: string | null
}

/** mailto: vers Gabrielle, corps tabulé reprenant les données de la commission. */
export function factureMailto(l: FactureData): string {
  const d = dateFr(l.issue)
  const lignes = [
    'Hello Gabrielle,',
    '',
    'Peux-tu éditer la facture suivante',
    '',
    `Émetteur\t${l.emetteur ?? ''}`,
    `ISIN\t\t${l.isin}`,
    `Trade Date\t${d}`,
    `Issue Date\t${d}`,
    `Payoff\t\t${l.description ?? ''}`,
    `Nominal\t\tEUR ${num(l.nominal)}`,
    `Upfront\t\t${pct2(l.ufPct)}  —  EUR ${num(l.comTotal)}`,
  ]
  if (typeof l.comClient === 'number' && l.comClient > 0 && l.client)
    lignes.push('', `Dès règlement reçu, merci de reverser EUR ${num(l.comClient)} à ${l.client}.`)
  lignes.push('', 'Merci')
  const p = new URLSearchParams()
  p.set('cc', FACTURE_CC)
  p.set('subject', `Nouvelle Facture ${l.emetteur ?? ''}`.trim())
  p.set('body', lignes.join('\n'))
  return `mailto:${GABRIELLE_EMAIL}?${p.toString()}`
}
