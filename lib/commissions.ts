// ─────────────────────────────────────────────────────────────────────────
//  Commissions — extrait de l'onglet « Lifecycle » du classeur (section
//  COMMISSION · FACTURES · P&L). Une ligne = une commission sur une position :
//  commission perçue (CMF), rétrocession reversée au CGP, facturation/paiement,
//  et commission nette (part Laurent Sebah = perçue × split).
//  Les totaux annuels (Commissions Nettes par an) sont les chiffres officiels du
//  classeur (onglet Backlog / Revenue Par Année), qui font foi.
// ─────────────────────────────────────────────────────────────────────────
import raw from './commissions.json'

export interface CommissionLigne {
  isin: string
  issue: string | null // date d'émission (ISO)
  client: string | null
  emetteur: string | null
  description: string | null
  devise: string | null
  nominal: number | null
  ufPct: number | null // upfront total (décimal, 0.06 = 6 %)
  comCmf: number | null // commission perçue par CMF (€)
  retroPct: number | null // taux de rétrocession au CGP (décimal)
  comClient: number | null // montant reversé au CGP (€)
  comTotal: number | null // commission totale (€) = perçue + rétrocession
  facture: string | null // n° de facture CMF
  sent: string | null // date d'envoi de la facture (ISO)
  credited: string | null // date de crédit / paiement (ISO)
  split: number | null // quote-part Laurent Sebah (1 = 100 %)
  net: number | null // commission nette LS (€) = perçue × split
}

export interface CommissionsData {
  majLe: string
  commissionsNettesParAnnee: Record<string, number>
  dealsParAnnee: Record<string, number>
  trimestre2026: Record<string, number>
  lignes: CommissionLigne[]
  /** Carnet d'adresses (code client/CGP → email destinataire de la facture). */
  mailing: Record<string, { email: string | null; cc: string | null; actif: boolean }>
}

export const commissions = raw as unknown as CommissionsData
