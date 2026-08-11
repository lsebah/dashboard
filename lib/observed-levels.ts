// ─────────────────────────────────────────────────────────────────────────
//  Niveaux worst-of CONSTATÉS à des observations passées, pour les sous-jacents
//  dont l'historique n'est PAS disponible via Yahoo (indices à décrément
//  propriétaires : MXEADT50, MerQube, Bloomberg decrement…). Le calcul live
//  (/api/lifecycle/niveaux) ne peut alors PAS reconstruire le niveau à la date
//  d'observation ⇒ on le renseigne ici, à partir du close OFFICIEL Bloomberg
//  (jamais inventé). Ces niveaux alimentent `niveauConstatePct` → détection
//  automatique du rappel (rappelConstate) et suivi des coupons.
//
//  Clé = ISIN → { dateObservation 'YYYY-MM-DD' : niveau en % du strike }.
// ─────────────────────────────────────────────────────────────────────────
export const observedLevels: Record<string, Record<string, number>> = {
  // FRIP00001NZ9 — Autocall croissant MSCI Europe Aerospace & Defense décrément
  // (indice MXEADT50). Obs n°1 du 24/07/2026 : close Bloomberg 1087,0455 /
  // strike 1022,02 (24/07/2025) = 106,36 %. ≥ barrière de rappel 100 %
  // ⇒ autocall CONSTATÉ, remboursement 110,40 % payable le 31/07/2026.
  FRIP00001NZ9: { '2026-07-24': 106.36 },
}

/** Renvoie le produit avec `niveauConstatePct` renseigné sur les observations
 *  dont on connaît le niveau officiel (indices non-Yahoo). Ne mute pas l'entrée
 *  d'origine ; renvoie le produit inchangé s'il n'y a rien à fusionner. */
export function withObservedLevels<T extends { isin: string; observations?: { dateObservation: string; niveauConstatePct?: number }[] }>(
  product: T,
): T {
  const map = observedLevels[product.isin]
  if (!map || !product.observations) return product
  return {
    ...product,
    observations: product.observations.map((o) =>
      typeof map[o.dateObservation] === 'number' && typeof o.niveauConstatePct !== 'number'
        ? { ...o, niveauConstatePct: map[o.dateObservation] }
        : o,
    ),
  }
}
