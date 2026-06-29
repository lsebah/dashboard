// ─────────────────────────────────────────────────────────────────────────
//  Helpers "lifecycle" — dérivations à partir d'un Produit.
//  Aucune dépendance externe : ces fonctions servent autant à l'affichage
//  qu'au futur moteur de monitoring (prochaine observation, statut, distances
//  aux barrières…).
// ─────────────────────────────────────────────────────────────────────────
import type { Product, Observation, Underlying, Frequency } from './types'
import { couponLedger } from './coupons-ledger'

/** Construit un calendrier d'observations à partir de listes de dates. */
export function buildObservations(
  obsDates: string[],
  payDates: string[],
  opts: {
    /** Niveau de rappel (% initial) — constant ou fonction de n (1-based). */
    niveauRappelPct?: number | ((n: number) => number | undefined)
    /** Montant de remboursement si rappelé (% nominal) — constant ou f(n). */
    montantRemboursementPct?: number | ((n: number) => number | undefined)
    /** Coupon de la période (% nominal) — constant ou f(n). */
    couponPct?: number | ((n: number) => number | undefined)
    /** Barrière de coupon (% initial). */
    niveauCouponPct?: number
    /** Première période où le rappel devient actif (fin du non-call). 1 = dès le départ. */
    rappelActifAPartirDe?: number
  } = {},
): Observation[] {
  const val = (
    v: number | ((n: number) => number | undefined) | undefined,
    n: number,
  ): number | undefined => (typeof v === 'function' ? v(n) : v)

  return obsDates.map((dateObservation, i) => {
    const n = i + 1
    return {
      n,
      dateObservation,
      datePaiement: payDates[i],
      autocallActif: n >= (opts.rappelActifAPartirDe ?? 1),
      niveauRappelPct: val(opts.niveauRappelPct, n),
      montantRemboursementPct: val(opts.montantRemboursementPct, n),
      couponPct: val(opts.couponPct, n),
      niveauCouponPct: opts.niveauCouponPct,
    }
  })
}

/** Sous-jacent le moins performant (pertinent pour les worst-of). */
export function worstOf(product: Product): Underlying | undefined {
  if (product.sousJacents.length === 0) return undefined
  const withPerf = product.sousJacents.filter((u) => typeof u.perf === 'number')
  if (withPerf.length === 0) return product.sousJacents[0]
  return withPerf.reduce((a, b) => ((a.perf ?? 0) <= (b.perf ?? 0) ? a : b))
}

/** Prochaine observation à venir (>= aujourd'hui). */
export function prochaineObservation(
  product: Product,
  now: Date = new Date(),
): Observation | undefined {
  const today = now.toISOString().slice(0, 10)
  return (product.observations ?? []).find((o) => o.dateObservation >= today)
}

/**
 * Date du prochain événement — UNIQUEMENT depuis le calendrier décodé de la
 * termsheet (prochaine observation ≥ aujourd'hui). On NE retombe PAS sur le champ
 * `nextEvent` issu de l'Excel : il peut être faux/périmé (la TS fait foi). Un
 * produit non décodé affiche donc « — » tant que sa termsheet n'est pas saisie.
 */
export function prochainEvenement(product: Product): string | undefined {
  return prochaineObservation(product)?.dateObservation
}

/** Nombre de mois (arrondi) entre aujourd'hui et la maturité. */
export function moisRestants(product: Product, now: Date = new Date()): number {
  const fin = new Date(product.dateEcheance)
  const months =
    (fin.getFullYear() - now.getFullYear()) * 12 +
    (fin.getMonth() - now.getMonth())
  return Math.max(0, months)
}

/** Avancement dans la vie du produit, entre 0 et 1. */
export function avancement(product: Product, now: Date = new Date()): number {
  const debut = new Date(product.dateConstatationInitiale).getTime()
  const fin = new Date(product.dateEcheance).getTime()
  const t = now.getTime()
  if (fin <= debut) return 0
  return Math.min(1, Math.max(0, (t - debut) / (fin - debut)))
}

/**
 * Situation du produit vis-à-vis de sa barrière de protection, à la manière
 * de vizibility (positive / sans stress / proche de la protection / sous la
 * protection / non classé). Basée sur la perf du worst-of vs la barrière.
 */
export type Situation =
  | 'positive'
  | 'sans_stress'
  | 'proche_protection'
  | 'sous_protection'
  | 'non_classe'

export function situation(product: Product): Situation {
  const wo = worstOf(product)
  const perf = wo?.perf
  if (typeof perf !== 'number') {
    // Sans niveau de sous-jacent courant : un produit de taux à capital garanti
    // ne subit aucun stress sur sa barrière de protection ⇒ « sans stress ».
    // Les autres (actions/crédit sans niveau) ne peuvent pas être classés.
    const t = product.terms
    if (t?.kind === 'rates' && t.capitalGaranti) return 'sans_stress'
    return 'non_classe'
  }

  const terms = product.terms
  const protectionPct =
    terms?.kind === 'autocall'
      ? terms.protectionPct
      : (product.pdiPct ?? undefined)
  const niveau = 100 + perf // niveau du sous-jacent en % de l'initial

  // Produit INVERSE (bearish) : on joue à la BAISSE, la barrière de protection
  // est HAUTE ⇒ tout est en miroir du cas standard (la hausse est défavorable).
  const inverse =
    (terms?.kind === 'autocall' && terms.sens === 'inverse') ||
    (terms?.kind === 'rates' && terms.sens === 'bearish')
  if (inverse) {
    if (perf <= 0) return 'positive' // sous le strike = favorable au bearish
    if (protectionPct === undefined) return 'sans_stress'
    if (niveau >= protectionPct) return 'sous_protection' // barrière haute franchie
    if (protectionPct - niveau <= 10) return 'proche_protection'
    return 'sans_stress'
  }

  if (perf >= 0) return 'positive'
  if (protectionPct === undefined) return 'sans_stress'
  const marge = niveau - protectionPct // points au-dessus de la barrière
  if (niveau < protectionPct) return 'sous_protection'
  if (marge <= 10) return 'proche_protection'
  return 'sans_stress'
}

// Nombre de périodes de coupon par an, par fréquence (pour annualiser un coupon
// de période reconstruit depuis le calendrier). « in_fine »/« autre » exclus :
// le coupon n'y est pas périodique, on n'extrapole pas.
const PERIODES_PAR_AN: Partial<Record<Frequency, number>> = {
  mensuel: 12,
  trimestriel: 4,
  semestriel: 2,
  annuel: 1,
}

/**
 * Repli : reconstruit un coupon annuel depuis le calendrier décodé de la TS
 * (observations) quand aucun coupon p.a. explicite n'est renseigné. On prend le
 * coupon de période (couponPct) et on l'annualise selon la fréquence.
 */
export function couponPaFromObservations(product: Product): number | undefined {
  const perAn = product.frequence ? PERIODES_PAR_AN[product.frequence] : undefined
  if (!perAn) return undefined
  const o = (product.observations ?? []).find(
    (x) => typeof x.couponPct === 'number' && x.couponPct > 0,
  )
  if (!o || typeof o.couponPct !== 'number') return undefined
  return Math.round(o.couponPct * perAn * 100) / 100
}

/** Coupon annualisé indicatif, si défini (termsheet, sinon cellule Excel). */
export function couponPa(product: Product): number | undefined {
  const t = product.terms
  if (t?.kind === 'autocall' && typeof t.couponPa === 'number') return t.couponPa
  if (t?.kind === 'rates' && typeof t.couponConditionnelPa === 'number')
    return t.couponConditionnelPa
  if (t?.kind === 'credit' && typeof t.couponPa === 'number') return t.couponPa
  if (typeof product.couponPaPct === 'number') return product.couponPaPct
  // Champ coupon vide → on le dérive du calendrier décodé de la TS.
  return couponPaFromObservations(product)
}

/** Scénarios de dénouement pour un produit de taux (Phoenix Bearish CMS, etc.). */
export function scenariosTaux(product: Product): Scenario[] {
  const t = product.terms
  if (t?.kind !== 'rates') return []

  // — TARN / steepener (cible de coupon cumulé) —
  if (t.type === 'tarn') {
    const r1 = t.tauxReference ?? 'CMS long'
    const r2 = t.tauxReference2 ?? 'CMS court'
    const lev = t.multiplicateur ? `${(t.multiplicateur * 100).toFixed(0)}%` : ''
    const s: Scenario[] = []
    if (typeof t.couponGarantiPct === 'number')
      s.push({
        titre: 'Coupons fixes garantis',
        condition: 'périodes initiales',
        resultat: `Coupon garanti ${t.couponGarantiPct}%`,
        ton: 'positif',
      })
    s.push({
      titre: 'Phase steepener',
      condition: `pente ${r1} − ${r2} positive`,
      resultat: `Coupon = ${lev} × (${r1} − ${r2}), planché à ${t.floorPct ?? 0}%`,
      ton: 'neutre',
    })
    if (typeof t.cibleTarnPct === 'number')
      s.push({
        titre: 'Cible atteinte (TARN)',
        condition: `coupons cumulés ≥ ${t.cibleTarnPct}%`,
        resultat: 'Remboursement anticipé 100% du capital',
        ton: 'positif',
      })
    s.push({
      titre: 'À maturité',
      condition: 'cible jamais atteinte',
      resultat: t.capitalGaranti ? 'Capital 100% garanti' : 'Remboursement selon formule',
      ton: 'neutre',
    })
    return s
  }

  const taux = t.tauxReference ?? 'le taux de référence'
  const cmp = t.sens === 'bearish' ? '≤' : '≥'
  const cmpInv = t.sens === 'bearish' ? '>' : '<'
  const obs = product.observations ?? []
  const bRappel = t.barriereRappelTauxPct ?? obs.find((o) => typeof o.niveauRappelPct === 'number')?.niveauRappelPct
  const bCoupon = t.barriereCouponTauxPct ?? obs.find((o) => typeof o.niveauCouponPct === 'number')?.niveauCouponPct
  const cpn = t.couponConditionnelPct
  const scenarios: Scenario[] = []

  if (typeof bRappel === 'number') {
    scenarios.push({
      titre: 'Rappel anticipé',
      condition: `${taux} ${cmp} ${bRappel.toFixed(2)}% à une date d'observation`,
      resultat: `Remboursement ${t.capitalGaranti ? '100% du capital' : 'du capital'}${
        t.couponGarantiPct ? ` + coupon garanti ${t.couponGarantiPct}%` : ''
      }${cpn ? ` + coupons conditionnels${t.effetMemoire ? ' (mémoire)' : ''}` : ''}`,
      ton: 'positif',
    })
  }
  if (typeof bCoupon === 'number' && cpn) {
    scenarios.push({
      titre: 'Coupon conditionnel',
      condition: `${taux} ${cmp} ${bCoupon.toFixed(2)}% à une date d'observation`,
      resultat: `Coupon de ${cpn}%${t.effetMemoire ? ' mis en mémoire' : ''} (payé in fine)`,
      ton: 'neutre',
    })
  }
  scenarios.push({
    titre: 'À maturité',
    condition:
      typeof bCoupon === 'number'
        ? `non rappelé ; ${taux} ${cmpInv} ${bCoupon.toFixed(2)}% (cas défavorable)`
        : 'non rappelé',
    resultat: t.capitalGaranti
      ? `Capital 100% garanti${t.couponGarantiPct ? ` + coupon garanti ${t.couponGarantiPct}%` : ''} + coupons mémoire acquis`
      : 'Remboursement selon la formule finale',
    ton: t.capitalGaranti ? 'neutre' : 'negatif',
  })
  return scenarios
}

// ─── Suivi des coupons (Phoenix : payé / mis en mémoire / rattrapé) ─────────

const round2 = (v: number) => Math.round(v * 100) / 100

export type CouponStatut =
  | 'paye' // condition remplie, coupon de la période payé
  | 'rattrape' // condition remplie, coupon(s) en mémoire rattrapé(s)
  | 'manque' // condition non remplie, coupon non payé (en mémoire si effet mémoire)
  | 'a_constater' // date passée mais niveau du sous-jacent non encore renseigné
  | 'a_venir' // date d'observation future

export interface CouponLigne {
  n: number
  date: string
  datePaiement?: string
  couponPct: number
  barriereCouponPct?: number
  niveauConstatePct?: number
  statut: CouponStatut
  cumulPayePct: number // coupons cumulés effectivement payés à ce stade
  enMemoirePct: number // coupons actuellement en mémoire (non encore payés)
}

/** Produit dont les coupons sont ACQUIS (comptés au P&L total-rendement). */
export function distribueCoupons(product: Product): boolean {
  // Un coupon est acquis dès que son montant figure au calendrier et que la
  // condition est remplie : le flag `inFine` ne change QUE la date d'encaissement
  // (cash versé à l'échéance / au rappel), pas l'acquisition. Un Phoenix Bearish
  // CMS « capital garanti in fine » dont la barrière de taux est franchie doit
  // donc voir ses coupons comptés. Le crédit (CLN) n'a pas de coupon conditionnel.
  if (product.terms?.kind === 'credit') return false
  return (product.observations ?? []).some((o) => typeof o.couponPct === 'number')
}

/**
 * Sous-programme Phoenix : pour chaque date d'observation à coupon, détermine si
 * le coupon a été payé, manqué (mis en mémoire) ou rattrapé, à partir du niveau
 * du worst-of constaté (`niveauConstatePct`) vs la barrière de coupon. Tant que
 * le niveau n'est pas renseigné pour une date passée, le statut est « à constater ».
 */
export function suiviCoupons(product: Product, now: Date = new Date()): CouponLigne[] {
  const t = product.terms
  const memoire =
    (t?.kind === 'autocall' && t.effetMemoire) || (t?.kind === 'rates' && !!t.effetMemoire)
  // Produit INVERSE (bearish) : le coupon tombe quand le sous-jacent est SOUS la
  // barrière (la hausse est défavorable) ⇒ condition en miroir du cas standard.
  const inverse =
    (t?.kind === 'autocall' && t.sens === 'inverse') ||
    (t?.kind === 'rates' && t.sens === 'bearish')
  const today = now.toISOString().slice(0, 10)
  let mem = 0
  let cumul = 0
  const out: CouponLigne[] = []
  for (const o of product.observations ?? []) {
    const cpn = o.couponPct
    if (typeof cpn !== 'number') continue
    const past = o.dateObservation <= today
    const barriere = o.niveauCouponPct
    const niveau = o.niveauConstatePct
    // Condition du coupon : le REGISTRE (write-once) fait foi pour les dates déjà
    // constatées ; sinon on la dérive du niveau worst-of constaté vs la barrière
    // (actions ; inversée pour un produit bearish) ; sinon « à constater ».
    const enregistre = couponLedger(product.isin, o.dateObservation)
    const conditionRemplie: boolean | undefined =
      enregistre !== undefined
        ? enregistre === 'paye'
        : t?.kind === 'autocall' && t.couponGaranti
          ? true // coupon inconditionnel — toujours payé (pas de barrière)
          : typeof niveau === 'number' && typeof barriere === 'number'
            ? inverse
              ? niveau <= barriere
              : niveau >= barriere
            : undefined
    let statut: CouponStatut
    if (!past) {
      statut = 'a_venir'
    } else if (conditionRemplie === undefined) {
      statut = 'a_constater'
    } else if (conditionRemplie) {
      const rattrape = memoire && mem > 0
      cumul += cpn + (memoire ? mem : 0)
      mem = 0
      statut = rattrape ? 'rattrape' : 'paye'
    } else {
      if (memoire) mem += cpn
      statut = 'manque'
    }
    out.push({
      n: o.n,
      date: o.dateObservation,
      datePaiement: o.datePaiement,
      couponPct: cpn,
      barriereCouponPct: barriere,
      niveauConstatePct: niveau,
      statut,
      cumulPayePct: round2(cumul),
      enMemoirePct: round2(mem),
    })
  }
  return out
}

/**
 * Coupons réellement encaissés à ce jour (%). On compte les coupons CONFIRMÉS
 * payés (registre ou niveau worst-of constaté ≥ barrière) : c'est du cash acquis.
 * Une date passée encore « à constater » (sous-jacent indisponible) n'est pas
 * comptée — elle n'efface pas pour autant les coupons déjà confirmés (sinon le
 * P&L retomberait à tort sur le prix seul). Renvoie 0 si rien n'est encore acquis.
 */
export function couponsEncaissesPct(
  product: Product,
  now: Date = new Date(),
): number | undefined {
  if (!distribueCoupons(product)) return 0
  const passes = suiviCoupons(product, now).filter((l) => l.statut !== 'a_venir')
  if (passes.length === 0) return 0
  return passes[passes.length - 1].cumulPayePct
}

/**
 * P&L = prix de marché + coupons encaissés − 100 (si distribution de coupon).
 * Tant que les niveaux d'observation ne sont pas renseignés, retombe sur le P&L
 * de prix seul (prix − 100).
 */
export function pnlAvecCoupons(product: Product, now: Date = new Date()): number | undefined {
  if (typeof product.prixMarche !== 'number') return undefined
  const coupons = couponsEncaissesPct(product, now)
  return round2(product.prixMarche + (coupons ?? 0) - 100)
}

// ─── Reconstruction mathématique (à partir des `terms` décodés) ──────────────

/** Une ligne d'échéancier reconstruite (date d'observation → mécanique). */
export interface EcheanceLigne {
  n: number
  date: string
  niveauRappelPct?: number // barrière d'autocall (dégressive le cas échéant)
  remboursementPct?: number // remboursement total si rappelé à cette date
  couponPct?: number
  actif: boolean // false pendant la période non-call (lock-out)
  passe: boolean // date déjà écoulée
}

/** Reconstruit l'échéancier d'observation lisible d'un produit autocall. */
export function echeancier(product: Product, now: Date = new Date()): EcheanceLigne[] {
  const today = now.toISOString().slice(0, 10)
  return (product.observations ?? []).map((o) => ({
    n: o.n,
    date: o.dateObservation,
    niveauRappelPct: o.niveauRappelPct,
    remboursementPct: o.montantRemboursementPct,
    couponPct: o.couponPct,
    actif: o.autocallActif !== false,
    passe: o.dateObservation < today,
  }))
}

/**
 * Rappel constaté (autocall déclenché) : à une date d'observation PASSÉE et
 * AUTOCALL-ACTIVE (hors période non-call), si le niveau du worst-of constaté
 * (`niveauConstatePct`) est ≥ à la barrière d'autocall (`niveauRappelPct`), le
 * produit a été remboursé par anticipation. Renvoie la PREMIÈRE observation
 * déclencheuse (dans le temps), sinon undefined. Sert à dériver le statut
 * « rappelé » sans saisie manuelle. N'opère que si le niveau worst-of a été
 * renseigné pour la date (sinon « à constater » ⇒ pas de rappel auto).
 */
export function rappelConstate(
  product: Product,
  now: Date = new Date(),
): { n: number; date: string; niveauPct: number; barrierePct: number } | undefined {
  const today = now.toISOString().slice(0, 10)
  // Inverse (bearish) : l'autocall se déclenche quand le sous-jacent passe SOUS la
  // barrière de rappel (≤), et non au-dessus (≥) comme un autocall standard.
  const t = product.terms
  const inverse =
    (t?.kind === 'autocall' && t.sens === 'inverse') ||
    (t?.kind === 'rates' && t.sens === 'bearish')
  for (const o of product.observations ?? []) {
    if (o.autocallActif === false) continue // période non-call (lock-out)
    if (o.dateObservation > today) continue // observation future
    const barriere = o.niveauRappelPct
    const niveau = o.niveauConstatePct
    const declenche =
      typeof barriere === 'number' &&
      typeof niveau === 'number' &&
      (inverse ? niveau <= barriere : niveau >= barriere)
    if (declenche)
      return { n: o.n, date: o.dateObservation, niveauPct: niveau!, barrierePct: barriere! }
  }
  return undefined
}

/** Amplitude de dégressivité de la barrière de rappel (départ → fin), si step-down. */
export function degressivite(
  product: Product,
): { depart: number; fin: number; pas: number } | undefined {
  const obs = (product.observations ?? []).filter(
    (o) => typeof o.niveauRappelPct === 'number',
  )
  if (obs.length < 2) return undefined
  const depart = obs[0].niveauRappelPct!
  const fin = obs[obs.length - 1].niveauRappelPct!
  if (depart === fin) return undefined
  return { depart, fin, pas: (depart - fin) / (obs.length - 1) }
}

/** Un scénario de dénouement (à des fins pédagogiques / d'aide à la décision). */
export interface Scenario {
  titre: string
  condition: string
  resultat: string
  ton: 'positif' | 'neutre' | 'negatif'
}

/** Reconstruit les scénarios de remboursement à partir des termes décodés. */
export function scenariosMaturite(product: Product): Scenario[] {
  const t = product.terms
  if (t?.kind !== 'autocall') return []

  const panier =
    product.basket === 'worst_of'
      ? 'le sous-jacent le moins performant'
      : product.basket === 'equipondere'
        ? 'la performance moyenne du panier'
        : 'le sous-jacent'
  const obs = (product.observations ?? []).filter(
    (o) => typeof o.niveauRappelPct === 'number',
  )
  const barrDepart = obs[0]?.niveauRappelPct ?? t.barriereRappelPct ?? 100
  const barrFin = obs.length ? obs[obs.length - 1].niveauRappelPct! : barrDepart
  const styleKI = t.protectionStyle === 'europeenne' ? 'européenne' : 'américaine'
  const remboursementMax =
    product.observations?.[product.observations.length - 1]?.montantRemboursementPct

  // — Sens inverse (ex. Reverse / Inverse Autocall) —
  if (t.sens === 'inverse') {
    return [
      {
        titre: 'Rappel anticipé',
        condition: `${panier} ≤ ${barrDepart}% à une date d'observation`,
        resultat: 'Remboursement 100% du capital + coupon garanti de la période',
        ton: 'positif',
      },
      {
        titre: 'Sans franchissement',
        condition: `à l'échéance, ${panier} < ${t.protectionPct}% (barrière haute ${styleKI})`,
        resultat: 'Remboursement 100% + coupons cumulés',
        ton: 'neutre',
      },
      {
        titre: 'Barrière haute franchie',
        condition: `à l'échéance, ${panier} ≥ ${t.protectionPct}%`,
        resultat: 'Perte en capital (proportionnelle à la hausse du sous-jacent)',
        ton: 'negatif',
      },
    ]
  }

  // — Sens standard (Phoenix / Athena / Airbag / Autocall) —
  const degr = barrDepart !== barrFin ? ` (barrière dégressive ${barrDepart}% → ${barrFin}%)` : ''
  const scenarios: Scenario[] = [
    {
      titre: 'Rappel anticipé',
      condition: `${panier} ≥ barrière de rappel à une date d'observation${degr}`,
      resultat: `Remboursement 100% du capital + coupon(s)${
        remboursementMax ? ` — jusqu'à ${remboursementMax.toFixed(2)}% si rappel tardif` : ''
      }`,
      ton: 'positif',
    },
    {
      titre: 'À maturité, capital protégé',
      condition: `non rappelé et ${panier} ≥ ${t.protectionPct}% (barrière ${styleKI})`,
      resultat: `Remboursement 100% du capital${
        t.bonusFinalPct ? ` + bonus +${t.bonusFinalPct}%` : ''
      }`,
      ton: t.bonusFinalPct ? 'positif' : 'neutre',
    },
    {
      titre: 'À maturité, barrière franchie',
      condition: `${panier} < ${t.protectionPct}% à l'échéance`,
      resultat: t.airbag
        ? `Perte amortie (airbag) : capital × niveau / ${barrFin}%`
        : 'Perte en capital : capital × niveau final du sous-jacent',
      ton: 'negatif',
    },
  ]
  return scenarios
}

/** Scénarios de dénouement pour un produit de crédit (CLN / tranche). */
export function scenariosCredit(product: Product): Scenario[] {
  const t = product.terms
  if (t?.kind !== 'credit') return []
  const idx = t.indexReference ?? 'le portefeuille de référence'
  const tranche =
    typeof t.attachementPct === 'number' && typeof t.detachementPct === 'number'
      ? `tranche ${t.attachementPct}% – ${t.detachementPct}%`
      : 'la tranche'
  const rec = t.zeroRecovery ? 'zero recovery (perte = 100% par nom)' : `recouvrement ${t.recouvrementPct ?? '—'}%`
  const scenarios: Scenario[] = [
    {
      titre: 'Aucun événement de crédit',
      condition: `aucun défaut n'atteint la ${tranche} de ${idx}`,
      resultat: `Remboursement 100% du capital + coupons ${t.couponPct ?? t.couponPa ?? ''}%`,
      ton: 'positif',
    },
  ]
  if (typeof t.nbDefautsBuffer === 'number') {
    scenarios.push({
      titre: 'Défauts sous le point d’attachement',
      condition: `jusqu'à ~${t.nbDefautsBuffer} défaut(s) absorbé(s) par la subordination (${rec})`,
      resultat: 'Capital et coupons intacts',
      ton: 'neutre',
    })
  }
  scenarios.push({
    titre: 'Défauts dans la tranche',
    condition: `au-delà du point d'attachement (${rec})`,
    resultat: `Perte en capital proportionnelle${
      typeof t.nbDefautsWipe === 'number' ? ` — capital épuisé à ~${t.nbDefautsWipe} défauts` : ''
    } ; coupons réduits sur le nominal résiduel`,
    ton: 'negatif',
  })
  return scenarios
}

const MOIS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

/** Formate une date ISO en "j mois aaaa" (fr). */
export function formatDateFr(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export function formatPct(v?: number, digits = 2): string {
  if (typeof v !== 'number') return '—'
  return `${v.toFixed(digits)}%`
}

export function formatMontant(v: number, devise: string): string {
  return `${v.toLocaleString('fr-FR')} ${devise}`
}
