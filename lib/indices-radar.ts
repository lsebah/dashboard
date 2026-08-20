// ─────────────────────────────────────────────────────────────────────────
//  UNIVERS DU RADAR DE VOLATILITÉ — les grands indices mondiaux suivis.
//
//  Les symboles sont ceux de Yahoo Finance, source déjà utilisée par le site
//  (lib/yahoo.ts) : gratuite, sans clé, et joignable depuis Vercel. Aucun
//  chiffre n'est stocké ici — seulement de quoi aller le chercher.
//
//  `implicite` ne cite qu'une volatilité implicite RÉELLEMENT publiée. Le VIX
//  et le VSTOXX en sont ; il n'existe pas d'équivalent public et fiable pour
//  le CAC 40 ni pour le MSCI World, et on préfère un champ vide à un proxy
//  présenté comme la chose elle-même. Ces implicites sont à 30 JOURS : elles
//  ne remplacent pas l'ATM 6 mois de l'outil Leonteq, elles l'éclairent.
// ─────────────────────────────────────────────────────────────────────────

export interface IndiceRadar {
  cle: string
  nom: string
  /** Symbole Yahoo de l'indice de prix. */
  symbole: string
  /** Devise de cotation, pour l'affichage du niveau. */
  devise: string
  /** Indice de volatilité implicite publique, s'il en existe un. */
  implicite: { symbole: string; nom: string; horizonJours: number } | null
}

export const INDICES_RADAR: IndiceRadar[] = [
  {
    cle: 'SPX',
    nom: 'S&P 500',
    symbole: '^GSPC',
    devise: 'USD',
    implicite: { symbole: '^VIX', nom: 'VIX', horizonJours: 30 },
  },
  {
    cle: 'SX5E',
    nom: 'Euro Stoxx 50',
    symbole: '^STOXX50E',
    devise: 'EUR',
    implicite: { symbole: '^V2TX', nom: 'VSTOXX', horizonJours: 30 },
  },
  {
    cle: 'CAC',
    nom: 'CAC 40',
    symbole: '^FCHI',
    devise: 'EUR',
    // Aucun indice de volatilité CAC public et stable côté Yahoo.
    implicite: null,
  },
  {
    cle: 'WORLD',
    nom: 'MSCI World',
    symbole: '^990100-USD-STRD',
    devise: 'USD',
    implicite: null,
  },
]

export const indiceParCle = (cle: string): IndiceRadar | undefined =>
  INDICES_RADAR.find((i) => i.cle === cle)
