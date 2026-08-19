// ─────────────────────────────────────────────────────────────────────────
//  Facture « CMF FACTURE GABRIELLE » — construit l'email pré-rempli à envoyer
//  à Gabrielle Salmon (office@cmf.finance), qui édite la facture pour
//  l'émetteur. Source UNIQUE du gabarit — l'onglet Commissions l'importe,
//  au lieu d'en garder sa propre copie (les deux avaient fini par diverger :
//  seule celle de CommissionsView portait encore le détail Rétro/Net, et les
//  deux partageaient le même bug d'encodage — voir plus bas).
// ─────────────────────────────────────────────────────────────────────────
import { pourcent } from './pourcentage'

export const GABRIELLE_EMAIL = 'office@cmf.finance'
export const FACTURE_CC = 'p.doize@cmf.finance,t.ballot@cmf.finance'

const num = (n?: number | null) =>
  typeof n === 'number' ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : ''
const pct2 = (n?: number | null) => (typeof n === 'number' ? pourcent(n * 100, 2) : '—')
const dateFr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '')

export interface FactureData {
  emetteur?: string | null
  isin: string
  issue?: string | null
  description?: string | null
  nominal?: number | null
  ufPct?: number | null // décimal (0.025 = 2,5 %)
  comTotal?: number | null // upfront total (€)
  retroPct?: number | null // décimal (0.035 = 3,5 %)
  comClient?: number | null // rétro reversée au CGP (€)
  comCmf?: number | null // net CMF, après rétro (€)
  client?: string | null
}

/** mailto: vers Gabrielle, corps tabulé reprenant les données de la commission. */
export function factureMailto(l: FactureData): string {
  const d = dateFr(l.issue)
  const avecRetro = typeof l.comClient === 'number' && l.comClient > 0 && !!l.client
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
    `Upfront Total\tEUR ${num(l.comTotal)} (${pct2(l.ufPct)})`,
  ]
  if (avecRetro) {
    lignes.push(
      `Rétro CGP\tEUR ${num(l.comClient)} (${pct2(l.retroPct)})`,
      `Net CMF\t\tEUR ${num(l.comCmf)}`,
      '',
      `Dès le règlement de cette facture reçu, il faudra reverser à ${l.client}.`,
    )
  }
  lignes.push('', 'Merci')
  // mailto: exige un %-encodage RFC 3986 (espace → %20) — URLSearchParams encode
  // en application/x-www-form-urlencoded (espace → +), que les clients mail
  // n'interprètent PAS comme un espace pour un corps mailto : le message
  // s'affichait avec des « + » littéraux à la place de chaque espace.
  const q = [
    `cc=${encodeURIComponent(FACTURE_CC)}`,
    `subject=${encodeURIComponent(`Nouvelle Facture ${l.emetteur ?? ''}`.trim())}`,
    `body=${encodeURIComponent(lignes.join('\n'))}`,
  ].join('&')
  return `mailto:${GABRIELLE_EMAIL}?${q}`
}
