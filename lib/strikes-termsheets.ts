// ─────────────────────────────────────────────────────────────────────────
//  Dates de STRIKE lues directement dans le CONTENU de la termsheet — jamais
//  dans le nom du fichier, qui dérive de la date d'émission et s'est révélé
//  faux (cf. lib/coherence.ts). Comble les cas où un trade saisi localement
//  (NouveauTrade) n'a pas encore sa « Date de strike » renseignée : le champ
//  retombe alors par défaut sur l'émission, ce qui date l'affaire plusieurs
//  jours trop tard dans Deal Done.
//
//  Cette table est un correctif ponctuel, pas un référentiel : dès que la
//  synchro automatique des termsheets (scripts/sync-termsheets.mjs) aura
//  indexé ces ISIN — ce qui suppose les secrets GRAPH_* posés côté GitHub
//  Actions, actuellement absents (cf. échecs de sync-termsheets.yml depuis
//  le 20/07/2026) —, la valeur sera portée par le produit lui-même et cette
//  entrée devient redondante (sans risque : les deux valeurs concordent).
// ─────────────────────────────────────────────────────────────────────────

export const STRIKE_TERMSHEET: Record<string, string> = {
  // CIBC · 80% Buffered Participation Note sur SX5E · Trade Date = Strike
  // Date 04/08/2026, Issue Date 18/08/2026 — termsheet
  // 260804_3.5Y_Buffered Participation SX5E_In Fine_XS3468086080_CIBC.pdf.
  XS3468086080: '2026-08-04',
  // BNP · 3.5Y Buffered Return Enhanced S&P 500 Equal Weighted USD · Trade
  // Date = Strike Date 07/08/2026, Issue Date 21/08/2026 — termsheet
  // 260807_3.5Y_Buffered Return Enhanced S&P 500 Equal Weighted USD_In Fine_XS3461528773_BNP.pdf.
  XS3461528773: '2026-08-07',
}
