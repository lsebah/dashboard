// ─────────────────────────────────────────────────────────────────────────
//  Commissions — registre des commissions de Lifecycle (section
//  COMMISSION · FACTURES · P&L). Une ligne = une commission sur une position :
//  commission perçue (CMF), rétrocession reversée au CGP, facturation/paiement,
//  et commission nette (part Laurent Sebah = perçue × split).
//  Les totaux annuels (Commissions Nettes par an) sont les chiffres officiels.
//
//  SOURCE : ce fichier FAIT FOI. Il a été initialisé depuis le classeur Excel,
//  mais l'Excel n'est plus la source — Lifecycle l'est. Une correction apportée
//  ici est définitive ; aucun export ne viendra la remplacer. C'est aussi ce qui
//  rend légitime de corriger une valeur du registre quand la termsheet la
//  contredit (cf. les trois dates d'émission reprises le 14/08/2026).
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

// ─────────────────────────────────────────────────────────────────────────
//  Identité d'une ligne de commission.
//
//  La clé servait à retrouver une ligne pour y coller une saisie manuelle
//  (UF, rétro, n° de facture, date d'encaissement). Elle ne portait que
//  ISIN + client + date d'émission — ce qui suffisait tant qu'un client ne
//  faisait qu'UN ticket par produit.
//
//  Ce n'est pas le cas : un UPSIZE crée un second ticket, même client, même
//  produit, même date d'émission (FR1459ABG521 / RENAUD GESTION PRIVEE :
//  63 000 € le 12/06 puis 24 000 € le 17/08, tous deux émis le 21/09/2026).
//  Sans le nominal dans la clé, les deux lignes n'en font qu'une : une rétro
//  saisie sur l'une s'appliquerait silencieusement à l'autre.
//
//  Le nominal les sépare — c'est justement ce qui différencie deux tickets.
// ─────────────────────────────────────────────────────────────────────────

/** Identité d'une ligne : ISIN + client + date d'émission + nominal. */
export const ligneKey = (l: Pick<CommissionLigne, 'isin' | 'client' | 'issue' | 'nominal'>): string =>
  `${l.isin}|${l.client ?? ''}|${l.issue ?? ''}|${l.nominal ?? ''}`

/**
 * Ancienne clé (sans nominal). Les saisies déjà enregistrées dans KV/navigateur
 * la portent : on continue de LIRE avec, sinon elles disparaîtraient toutes le
 * jour du changement. Les écritures, elles, utilisent toujours `ligneKey`.
 */
export const ligneKeyLegacy = (l: Pick<CommissionLigne, 'isin' | 'client' | 'issue'>): string =>
  `${l.isin}|${l.client ?? ''}|${l.issue ?? ''}`
