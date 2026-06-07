// ─────────────────────────────────────────────────────────────────────────
//  Modèle de données — Lifecycle CMF
//  Conçu pour couvrir TOUTES les classes d'actifs (actions, taux, crédit…).
//  Le cœur "Produit" est une enveloppe commune ; le mécanisme de payoff est
//  porté par une union discriminée selon la `famille` du produit.
// ─────────────────────────────────────────────────────────────────────────

/** Classe d'actif du (des) sous-jacent(s). */
export type AssetClass =
  | 'equity' // actions, indices actions
  | 'rates' // taux : CMS, swap, steepener, range accrual, TARN, callable…
  | 'credit' // crédit : CLN, first-to-default, tranches iTraxx, senior loans…
  | 'commodity' // matières premières (ETF type USO, indices commo…)
  | 'fx' // change
  | 'hybrid' // multi-classe

/** Famille de mécanisme (clé de l'union discriminée des `terms`). */
export type ProductFamily =
  | 'autocall' // Autocall / Phoenix / Athena / Airbag / Inverse / +Bonus…
  | 'reverse_convertible' // Barrier Reverse Convertible (BRC)
  | 'capital_protected' // note à capital garanti / protégé
  | 'participation' // tracker, bonus, twin-win, outperformance
  | 'credit_linked' // CLN, FTD, tranche de crédit
  | 'rates_structured' // produit de taux structuré
  | 'other'

/** Fréquence d'observation / de coupon. */
export type Frequency =
  | 'mensuel'
  | 'trimestriel'
  | 'semestriel'
  | 'annuel'
  | 'in_fine'
  | 'autre'

/** Style de constatation d'une barrière. */
export type BarrierStyle =
  | 'europeenne' // KIE — constatée uniquement à maturité (close)
  | 'americaine' // KIA — constatée en continu / intraday

/** Mode d'évaluation d'un panier de sous-jacents. */
export type BasketType =
  | 'single' // mono sous-jacent
  | 'worst_of' // pire performance du panier
  | 'best_of' // meilleure performance
  | 'equipondere' // performance moyenne arithmétique
  | 'panier' // panier pondéré

/** Statut de vie du produit. */
export type ProductStatus =
  | 'vivant' // en cours
  | 'rappele' // remboursé par anticipation (autocall déclenché) — "CALLED"
  | 'vendu' // cédé sur le secondaire — "SOLD"
  | 'echu' // arrivé à maturité
  | 'monitore' // suivi sans position (watchlist)

/** Allocation d'un produit à un client (code client + montant investi). */
export interface ClientAlloc {
  client: string
  montant?: number
}

// ─── Sous-jacent ───────────────────────────────────────────────────────────
export interface Underlying {
  nom: string
  bloomberg?: string // ex. "USO UP Equity", "SAF FP", "BEU50CFC Index"
  isin?: string
  marche?: string // place de cotation
  devise?: string
  /** Niveau initial (strike) en valeur absolue, fixé à la constatation initiale. */
  niveauInitial?: number
  // — Champs de monitoring (renseignés par le suivi de prix, optionnels) —
  spot?: number // dernier cours
  perf?: number // performance vs niveau initial, en %
}

// ─── Une observation planifiée (ligne du calendrier) ─────────────────────────
export interface Observation {
  n: number
  dateObservation: string // ISO (yyyy-mm-dd)
  datePaiement?: string // ISO
  // — Rappel automatique (autocall) —
  autocallActif?: boolean // false pendant la période non-call (lock-out)
  niveauRappelPct?: number // niveau de déclenchement, en % du niveau initial
  montantRemboursementPct?: number // remboursement si rappelé, en % du nominal
  // — Coupon —
  niveauCouponPct?: number // barrière de coupon, en % du niveau initial
  couponPct?: number // coupon de la période, en % du nominal
  // Niveau du worst-of effectivement constaté à cette date d'observation, en %
  // du niveau initial (renseigné a posteriori depuis l'historique des sous-jacents).
  // Permet de savoir si le coupon a été payé / mis en mémoire / rattrapé.
  niveauConstatePct?: number
  // — Résultat (rempli au fil de la vie du produit) —
  statut?: 'a_venir' | 'passe' | 'rappele'
  resultat?: string
}

// ─── Mécanismes par famille (union discriminée) ─────────────────────────────

/** Autocall / Phoenix / Athena / Airbag / BRC à barrière. */
export interface AutocallTerms {
  kind: 'autocall'
  sens: 'standard' | 'inverse' // inverse : rappel si sous-jacent SOUS le niveau
  effetMemoire: boolean // coupon à effet mémoire
  // Oxygène : feature propre aux Athena. À MATURITÉ uniquement (si le produit
  // n'a pas été rappelé avant), si le sous-jacent est ≥ au niveau Oxygène, tous
  // les coupons mémoire sont payés. À ne pas confondre avec la période non-call
  // (lock-out), qui est gérée par `rappelActifAPartirDe` / `autocallActif`.
  oxygene?: boolean
  oxygenePct?: number // niveau Oxygène, en % de l'initial (si feature présente)
  couponPa?: number // coupon annualisé indicatif, en %
  barriereCouponPct?: number // barrière de coupon, en % de l'initial
  barriereRappelPct?: number // niveau de rappel de base, en % de l'initial
  degressif?: boolean // barrière de rappel décroissante (step-down)
  protectionPct: number // barrière de protection du capital, en % de l'initial
  protectionStyle: BarrierStyle
  airbag?: boolean // mécanisme airbag (rappel < 100% / amorti de la perte)
  strikeMoyen?: boolean // strike moyen (moyennage du niveau initial)
  lookback?: boolean
  decrement?: string // indice à décrément, ex. "1.20 EUR" / "Financing Cost"
  bonusFinalPct?: number // prime de remboursement final si pas de franchissement
}

/**
 * Crédit (CLN / FTD / tranche d'indice iTraxx). Le capital est à risque via les
 * événements de crédit (défauts) qui « rongent » la tranche entre le point
 * d'attachement et de détachement. Souvent zero-recovery (perte = 100% du nom).
 */
export interface CreditTerms {
  kind: 'credit'
  type: 'single_name' | 'first_to_default' | 'tranche' | 'index'
  indexReference?: string // ex. "iTraxx Europe Crossover Série 42"
  entitesReference?: string[] // liste de noms (FTD / single name)
  nbEntites?: number // nombre de noms du portefeuille (ex. 125)
  attachementPct?: number // point d'attachement (tranche), en %
  detachementPct?: number // point de détachement (tranche), en %
  recouvrementPct?: number // taux de recouvrement supposé, en %
  zeroRecovery?: boolean // recouvrement fixé à 0% (perte = 100% du nom)
  levier?: number // levier de tranche = 1 / (détachement − attachement)
  nbDefautsBuffer?: number // défauts absorbés avant d'entamer la tranche
  nbDefautsWipe?: number // défauts cumulés qui épuisent la tranche
  couponPct?: number // coupon par période, en %
  couponPa?: number // coupon annualisé, en %
  couponGaranti?: boolean // coupon non réduit par les événements de crédit
  prixEmissionPct?: number // prix d'émission (ZC à escompte, ex. 53.6)
  inFine?: boolean
  protectionCapital?: boolean // capital protégé (false pour ces CLN)
}

/**
 * Taux structuré : Phoenix/Autocall sur taux (« Bearish CMS10 »), CMS steepener,
 * range accrual, TARN, callable…
 *
 * Phoenix Bearish CMS10 : produit de taux où le coupon conditionnel est versé si
 * le taux de référence (ex. EUR CMS 10Y) est SOUS une barrière (sens « bearish »),
 * avec effet mémoire ; rappel anticipé si le taux passe sous la barrière de rappel.
 * Souvent capital garanti à maturité + un coupon garanti one-off, paiement in fine.
 * Le calendrier (barrières de taux par observation) est porté par `observations`
 * (niveauCouponPct = barrière de coupon en taux ; niveauRappelPct = barrière de
 * rappel en taux ; couponPct = coupon conditionnel de la période).
 */
export interface RatesTerms {
  kind: 'rates'
  type:
    | 'phoenix_taux'
    | 'cms_steepener'
    | 'range_accrual'
    | 'tarn'
    | 'fixed_to_float'
    | 'callable'
    | 'autre'
  /** « bearish » : coupon/rappel si le taux est BAS (≤ barrière) ; « bullish » : si HAUT. */
  sens?: 'bearish' | 'bullish'
  tauxReference?: string // ex. "EUR CMS 10Y"
  tauxReference2?: string // 2e taux (steepener / TARN), ex. "EUR CMS 2Y"
  indices?: string[] // compat. ancienne (liste d'indices)
  effetMemoire?: boolean
  couponConditionnelPct?: number // coupon conditionnel par période, en %
  couponConditionnelPa?: number // coupon conditionnel annualisé indicatif, en %
  couponGarantiPct?: number // coupon garanti one-off (in fine), en %
  barriereCouponTauxPct?: number // barrière de coupon, en taux (ex. 3.20)
  barriereRappelTauxPct?: number // barrière de rappel, en taux (ex. 2.30)
  capitalGaranti?: boolean // capital protégé 100% à maturité (hors défaut émetteur)
  inFine?: boolean // coupons payés uniquement au dénouement (rappel ou maturité)
  multiplicateur?: number
  capPct?: number
  floorPct?: number
  borneBassePct?: number // range accrual
  borneHautePct?: number
  callable?: boolean
  cibleTarnPct?: number // coupon cumulé cible (TARN)
}

export type ProductTerms = AutocallTerms | CreditTerms | RatesTerms

// ─── Produit (enveloppe commune) ─────────────────────────────────────────────
export interface Product {
  // — Identification —
  id: string
  nom: string
  isin: string
  valor?: string
  emetteur: string
  garant?: string
  notationEmetteur?: string
  assetClass: AssetClass
  family: ProductFamily
  eusipa?: string // code EUSIPA / SSPA

  // — Économie —
  devise: string
  nominal: number // nominal de l'émission (ou de la position)
  valeurNominale?: number // dénomination unitaire
  prixEmission?: number // en %

  // — Dates clés —
  dateConstatationInitiale: string // ISO
  dateEmission: string // ISO
  dateConstatationFinale: string // ISO
  dateEcheance: string // ISO
  frequence: Frequency

  // — Sous-jacents —
  sousJacents: Underlying[]
  basket: BasketType

  // — Mécanisme (selon la famille). Optionnel : renseigné finement pour les
  //   produits décodés depuis une termsheet ; absent pour un import "catalogue". —
  terms?: ProductTerms

  // — Calendrier d'observation (optionnel tant que non importé). —
  observations?: Observation[]

  // — Monitoring (optionnel, renseigné par le suivi) —
  prixMarche?: number // valorisation secondaire mark-to-market, en %
  statut?: ProductStatus

  // — Suivi / reporting (colonnes du fichier Excel "Lifecycle") —
  rr?: string // gérant / relationship manager (LS, PD, JLL…)
  description?: string // libellé lisible, ex. "5Y Phoenix Memory Wof Micron + Marvell"
  productType?: string // Phoenix / Athena / Booster / Airbag / Participation / Call Spread / Callable…
  pnlPct?: number // P&L courant, en %
  pdiPct?: number // PDI — barrière de protection (down-and-in), en %
  clients?: string[] // CLIENT INFO — codes clients alloués
  allocations?: ClientAlloc[] // allocation par client (code + montant investi), depuis le feed
  nextEvent?: string // prochaine échéance (ISO) quand le calendrier n'est pas importé
  // Cellules "résumé" de l'Excel, conservées telles quelles pour l'affichage
  // tabulaire (les barrières crédit/taux portent des taux, d'où le format texte) :
  couponPaPct?: number
  barriereAutocall?: string
  barriereCoupon?: string
  pdiText?: string

  // — Divers —
  termsheetFichier?: string
  termsheetUrl?: string // lien SharePoint vers la termsheet (PDF)
  badges?: string[]
}
