// ─────────────────────────────────────────────────────────────────────────
//  Moteur de cartographie du risque — calcule des INDICATEURS de risque à
//  partir du portefeuille réel (positions vivantes + worst-of live). Chaque
//  indicateur porte : niveau, sévérité (axe Y), exposition (axe X = % du
//  portefeuille), montant, produits/émetteurs concernés, facteurs, références.
//  Aucune donnée inventée : tout dérive des positions et des niveaux Yahoo.
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'
import { estVivant, eurNominal, parEmetteur, concentration } from './cmf-analytics'

export type RiskLevel = 'faible' | 'modéré' | 'élevé' | 'critique'

export interface RiskProductRef {
  isin: string
  nom: string
  emetteur: string
  montant: number
}

export interface RiskItem {
  id: string
  nom: string
  categorie: string
  niveau: RiskLevel
  severite: number // 0-100 (axe vertical)
  exposition: number // 0-100 (axe horizontal) = % du portefeuille (capé à 100)
  pctPortefeuille: number
  montantExpose: number
  description: string
  produits: RiskProductRef[]
  emetteurs: string[]
  facteurs: string[]
  references: string[]
  historique: { label: string; value: number }[]
}

export const NIVEAU_COLOR: Record<RiskLevel, string> = {
  faible: '#1b7a4b',
  modéré: '#3e6188',
  élevé: '#b8860b',
  critique: '#b42318',
}
const NIVEAU_SCORE: Record<RiskLevel, number> = { faible: 20, modéré: 45, élevé: 70, critique: 92 }

function barriereProtection(p: Product): number | undefined {
  if (p.terms?.kind === 'autocall') return p.terms.protectionPct
  return p.pdiPct ?? undefined
}
const prodRef = (p: Product): RiskProductRef => ({
  isin: p.isin,
  nom: p.productType ?? p.nom,
  emetteur: p.emetteur,
  montant: eurNominal(p),
})
const uniq = (a: string[]) => Array.from(new Set(a))
const isCredit = (p: Product) =>
  p.family === 'credit_linked' || p.terms?.kind === 'credit' || /\bCLN\b|credit|tranche|recovery/i.test(`${p.productType ?? ''} ${p.nom}`)
const isRates = (p: Product) =>
  p.family === 'rates_structured' || p.terms?.kind === 'rates' || /\bCMS\b|\bTEC\b|taux|bearish|steepener|rate/i.test(`${p.productType ?? ''} ${p.nom}`)
const isDecrement = (p: Product) =>
  /d[ée]cr[ée]ment|decrement|quartz/i.test(`${p.productType ?? ''} ${p.nom}`) ||
  (p.terms?.kind === 'autocall' && !!p.terms.decrement)
const yearsTo = (iso: string) => {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : (t - Date.now()) / (365.25 * 86_400_000)
}

/** Construit la liste des indicateurs de risque depuis le portefeuille. */
export function computeRisks(
  products: Product[],
  courant: Record<string, number | null> | null,
): RiskItem[] {
  const vivants = products.filter(estVivant)
  const total = vivants.reduce((s, p) => s + eurNominal(p), 0) || 1
  const items: RiskItem[] = []
  const push = (
    base: Omit<RiskItem, 'severite' | 'exposition' | 'pctPortefeuille'> & { montantExpose: number; severiteBump?: number },
  ) => {
    const pctPortefeuille = (base.montantExpose / total) * 100
    items.push({
      ...base,
      pctPortefeuille,
      exposition: Math.min(100, pctPortefeuille),
      severite: Math.min(100, NIVEAU_SCORE[base.niveau] + (base.severiteBump ?? 0)),
    })
  }

  // 1) Risque de marché — proximité de barrière (worst-of live)
  const barr = vivants.map((p) => {
    const wo = courant ? courant[p.isin] ?? null : null
    const prot = barriereProtection(p)
    const marge = typeof wo === 'number' && typeof prot === 'number' ? wo - prot : null
    return { p, wo, prot, marge }
  })
  const sous = barr.filter((b) => b.marge !== null && b.marge < 0)
  const proche = barr.filter((b) => b.marge !== null && b.marge >= 0 && b.marge <= 10)
  const barrAffected = [...sous, ...proche]
  if (barrAffected.length) {
    const montant = barrAffected.reduce((s, b) => s + eurNominal(b.p), 0)
    push({
      id: 'barriere',
      nom: 'Proximité de barrière (worst-of)',
      categorie: 'Risque de marché',
      niveau: sous.length ? 'critique' : 'élevé',
      severiteBump: Math.min(8, proche.length),
      montantExpose: montant,
      description:
        'Produits dont le sous-jacent le moins performant (worst-of) est proche ou sous la barrière de protection du capital. Un franchissement à la baisse expose à une perte en capital à maturité.',
      produits: barrAffected.map((b) => prodRef(b.p)),
      emetteurs: uniq(barrAffected.map((b) => b.p.emetteur)),
      facteurs: [
        `${sous.length} produit(s) SOUS la barrière`,
        `${proche.length} produit(s) proche(s) (marge ≤ 10 pt)`,
        'Sensibilité directe à la volatilité et à la corrélation des sous-jacents',
      ],
      references: [
        'Worst-of temps réel (Yahoo) comparé à la barrière de protection (terms.protectionPct ou PDI)',
        'Niveaux initiaux des sous-jacents fixés à la constatation initiale (termsheet)',
      ],
      historique: [],
    })
  }

  // 2) Risque de contrepartie — concentration émetteur
  const emet = parEmetteur(vivants)
  const conc = concentration(vivants)
  if (emet[0]) {
    const top = emet[0]
    const niveau: RiskLevel =
      conc.hhiEmetteur > 2000 ? 'critique' : conc.hhiEmetteur > 1500 ? 'élevé' : conc.hhiEmetteur > 1000 ? 'modéré' : 'faible'
    const affected = vivants.filter((p) => p.emetteur === top.label)
    push({
      id: 'conc-emetteur',
      nom: `Concentration émetteur — ${top.label}`,
      categorie: 'Risque de contrepartie',
      niveau,
      montantExpose: top.montant,
      description:
        "Part du portefeuille exposée au premier émetteur. Une concentration élevée accroît la sensibilité au risque de crédit/défaut d'un seul émetteur.",
      produits: affected.map(prodRef),
      emetteurs: emet.slice(0, 3).map((e) => `${e.label} (${e.pct.toFixed(1)} %)`),
      facteurs: [
        `Premier émetteur ${top.label} = ${top.pct.toFixed(1)} % de l'encours`,
        `HHI émetteurs = ${conc.hhiEmetteur} (concentration)`,
        `${conc.nbEmetteurs} émetteurs au total`,
      ],
      references: ['Répartition de l’encours nominal par émetteur', 'Indice de Herfindahl-Hirschman (HHI)'],
      historique: [],
    })
  }

  // 3) Risque de concentration — premier sous-jacent
  if (conc.topSousJacent) {
    const su = conc.topSousJacent
    const niveau: RiskLevel = su.pct > 20 ? 'élevé' : su.pct > 12 ? 'modéré' : 'faible'
    const affected = vivants.filter((p) => p.sousJacents.some((u) => u.nom === su.nom))
    push({
      id: 'conc-sousjacent',
      nom: `Concentration sous-jacent — ${su.nom}`,
      categorie: 'Risque de concentration',
      niveau,
      montantExpose: su.montant,
      description:
        "Exposition agrégée (répartie à parts égales dans les paniers) au sous-jacent le plus représenté. Une chute de ce sous-jacent affecte simultanément plusieurs produits.",
      produits: affected.map(prodRef),
      emetteurs: uniq(affected.map((p) => p.emetteur)),
      facteurs: [`${su.nom} = ${su.pct.toFixed(1)} % de l'exposition sous-jacents`, `${affected.length} produit(s) contiennent ce sous-jacent`],
      references: ['Exposition nominale répartie à parts égales entre les sous-jacents de chaque panier'],
      historique: [],
    })
  }

  // 4) Risque de crédit — CLN / produits liés au crédit
  const credit = vivants.filter(isCredit)
  if (credit.length) {
    const montant = credit.reduce((s, p) => s + eurNominal(p), 0)
    const pctP = (montant / total) * 100
    push({
      id: 'credit',
      nom: 'Exposition crédit (CLN / tranches)',
      categorie: 'Risque de crédit',
      niveau: pctP > 20 ? 'élevé' : pctP > 8 ? 'modéré' : 'faible',
      montantExpose: montant,
      description:
        "Produits dont le remboursement dépend d'événements de crédit (CLN, tranches iTraxx, reverse convertible crédit). Risque de perte en cas de défauts dans le panier de référence.",
      produits: credit.map(prodRef),
      emetteurs: uniq(credit.map((p) => p.emetteur)),
      facteurs: [`${credit.length} produit(s) crédit`, 'Sensibilité au nombre de défauts / à la subordination de la tranche'],
      references: ['Famille produit = crédit / libellé CLN-tranche', 'Voir le module iTraxx pour le détail des tranches'],
      historique: [],
    })
  }

  // 5) Risque de taux — produits indexés taux (CMS/TEC)
  const rates = vivants.filter(isRates)
  if (rates.length) {
    const montant = rates.reduce((s, p) => s + eurNominal(p), 0)
    const pctP = (montant / total) * 100
    push({
      id: 'taux',
      nom: 'Exposition taux (CMS / TEC)',
      categorie: 'Risque de taux',
      niveau: pctP > 20 ? 'élevé' : pctP > 8 ? 'modéré' : 'faible',
      montantExpose: montant,
      description:
        'Produits dont le coupon/remboursement dépend de niveaux de taux (CMS 10 ans, TEC 10, pentification). Sensibilité aux mouvements de la courbe des taux.',
      produits: rates.map(prodRef),
      emetteurs: uniq(rates.map((p) => p.emetteur)),
      facteurs: [`${rates.length} produit(s) indexés taux`, 'Sensibilité à la courbe (niveau, pente)'],
      references: ['Famille produit = taux / libellé CMS-TEC', 'Courbe EUR (CMS, TEC 10) — bloc taux curatés'],
      historique: [],
    })
  }

  // 6) Risque indice à décrément
  const decr = vivants.filter(isDecrement)
  if (decr.length) {
    const montant = decr.reduce((s, p) => s + eurNominal(p), 0)
    const pctP = (montant / total) * 100
    push({
      id: 'decrement',
      nom: 'Exposition indices à décrément',
      categorie: 'Risque structurel',
      niveau: pctP > 20 ? 'élevé' : pctP > 10 ? 'modéré' : 'faible',
      montantExpose: montant,
      description:
        "Produits sur indices à décrément : le prélèvement (points/% de dividende synthétique) pèse mécaniquement sur la performance de l'indice et donc sur les chances de rappel.",
      produits: decr.map(prodRef),
      emetteurs: uniq(decr.map((p) => p.emetteur)),
      facteurs: [`${decr.length} produit(s) sur indice à décrément`, 'Décrément (points/%) appliqué en continu'],
      references: ['Indices à décrément — module Décrément', 'Niveau de décrément de chaque indice (termsheet)'],
      historique: [],
    })
  }

  // 7) Risque de liquidité / duration — maturités longues (> 8 ans)
  const longs = vivants.filter((p) => yearsTo(p.dateEcheance) > 8)
  if (longs.length) {
    const montant = longs.reduce((s, p) => s + eurNominal(p), 0)
    const pctP = (montant / total) * 100
    push({
      id: 'maturite',
      nom: 'Maturités longues (> 8 ans)',
      categorie: 'Risque de liquidité',
      niveau: pctP > 30 ? 'élevé' : pctP > 15 ? 'modéré' : 'faible',
      montantExpose: montant,
      description:
        'Positions à échéance lointaine : faible liquidité secondaire, sensibilité accrue aux taux et au temps avant rappel/maturité.',
      produits: longs.map(prodRef),
      emetteurs: uniq(longs.map((p) => p.emetteur)),
      facteurs: [`${longs.length} produit(s) à plus de 8 ans`, 'Horizon de sortie éloigné'],
      references: ['Date d’échéance des positions (termsheet)'],
      historique: [],
    })
  }

  return items.sort((a, b) => b.severite - a.severite)
}
