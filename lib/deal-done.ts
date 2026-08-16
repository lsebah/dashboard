// ─────────────────────────────────────────────────────────────────────────
//  Deal Done — les trades annoncés par l'équipe dans le dossier Outlook
//  « DEAL DONE ». Ce ne sont PAS des positions du portefeuille : ce sont des
//  affaires faites, souvent encore en commercialisation, rarement dotées d'un
//  ISIN et presque jamais d'une termsheet au moment de l'annonce.
//
//  Deux conséquences assumées dans ce modèle :
//    • presque tous les champs sont OPTIONNELS. Un mail de deal done est du
//      texte libre : chacun écrit ce qu'il veut. On transcrit ce qui est écrit
//      et on laisse vide le reste — jamais de valeur reconstituée.
//    • le nom du produit et sa description sont les seuls champs sur lesquels
//      on compte toujours : ce sont eux qui identifient l'affaire.
//
//  DOUBLONS — le stagiaire annonce parfois un deal déjà annoncé par un sales.
//  On dédoublonne, mais SEULEMENT sur une identité forte (même produit, même
//  émetteur, même nominal) : deux tickets du même jour sur le même sous-jacent
//  mais de nominal différent sont deux affaires, pas un doublon. Les cas
//  ressemblants sans être identiques sont SIGNALÉS, pas fusionnés — c'est
//  exactement là qu'une fusion automatique ferait disparaître un vrai deal.
// ─────────────────────────────────────────────────────────────────────────

/** Identifiant du commercial. STA = stagiaire. */
export type RR = 'LS' | 'MH' | 'MM' | 'MEG' | 'PD' | 'TB' | 'STA'

/** Expéditeur du mail → identifiant RR. */
export const RR_PAR_EMAIL: Record<string, RR> = {
  'l.sebah@cmf.finance': 'LS',
  'm.gohin@cmf.finance': 'MH',
  'm.monot@cmf.finance': 'MM',
  'm.elghzaoui@cmf.finance': 'MEG',
  'p.doize@cmf.finance': 'PD',
  't.ballot@cmf.finance': 'TB',
  'stagiaire.cmf@cmf.finance': 'STA',
}

export interface Deal {
  /** Clé stable (date + produit normalisé) — sert d'ancre React et de repère. */
  id: string
  /** Date d'annonce du deal (ISO `AAAA-MM-JJ`). */
  date: string
  rr: RR
  /** Nom court du produit — toujours renseigné. */
  produit: string
  /** Payoff en clair — toujours renseigné. */
  description?: string
  emetteur?: string
  devise?: string
  /** Nominal traité, dans la devise du deal. */
  nominal?: number
  /** UF global (upfront total), en %. */
  ufGlobal?: number
  /** UF de la lettre de remise (LR), en %. */
  ufLR?: number
  /** Coupon annuel, en %. */
  coupon?: number
  /** Assureurs vie référencés pour ce produit (AVF). */
  avf?: string[]
  isin?: string
  /** Date d'émission (ISO), quand elle est annoncée. */
  dateEmission?: string
  /** Fin de période de commercialisation (ISO), quand elle est annoncée. */
  finCommercialisation?: string
  maturiteAns?: number
  /**
   * Vrai quand il est ÉTABLI que ce deal est une affaire distincte d'une autre
   * qui lui ressemble — typiquement deux produits de même nom annoncés dans le
   * MÊME mail, avec des conditions différentes. Supprime la suspicion de
   * doublon, qui deviendrait sinon un avertissement permanent que plus personne
   * ne lit. À ne poser qu'après vérification dans le mail d'origine.
   */
  distinctConfirme?: boolean
  /** Sujet du mail d'origine — traçabilité. */
  source?: string
}

/** Normalise un nom de produit pour la comparaison (accents, ponctuation, casse). */
export function clefProduit(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Identité FORTE d'un deal : produit + émetteur + nominal. */
const identite = (d: Deal): string =>
  [clefProduit(d.produit), (d.emetteur ?? '').toLowerCase(), d.nominal ?? ''].join('|')

export interface Dedoublonnage {
  /** Deals retenus (un par identité forte). */
  deals: Deal[]
  /** Deals écartés comme doublons, avec celui qui les a remplacés. */
  doublons: { ecarte: Deal; retenu: Deal }[]
  /** Paires ressemblantes NON fusionnées — à trancher à l'œil. */
  aVerifier: { a: Deal; b: Deal; motif: string }[]
}

/**
 * Dédoublonne sur l'identité forte. En cas d'égalité, le deal d'un sales prime
 * sur celui du stagiaire (c'est le sens du doublon observé : le stagiaire
 * reprend une annonce déjà faite), et à rôle égal la première annonce prime.
 */
export function dedoublonner(entrees: Deal[]): Dedoublonnage {
  const parIdentite = new Map<string, Deal>()
  const doublons: { ecarte: Deal; retenu: Deal }[] = []

  // Ordre chronologique : la première annonce fait référence.
  const tries = entrees.slice().sort((a, b) => a.date.localeCompare(b.date))
  for (const d of tries) {
    const k = identite(d)
    const deja = parIdentite.get(k)
    if (!deja) {
      parIdentite.set(k, d)
      continue
    }
    // Le stagiaire ne remplace jamais un sales ; un sales remplace le stagiaire.
    if (deja.rr === 'STA' && d.rr !== 'STA') {
      parIdentite.set(k, d)
      doublons.push({ ecarte: deja, retenu: d })
    } else {
      doublons.push({ ecarte: d, retenu: deja })
    }
  }

  const deals = Array.from(parIdentite.values()).sort((a, b) => b.date.localeCompare(a.date))

  // Ressemblances non fusionnées : même produit, même semaine, mais une
  // caractéristique forte diffère. On ne tranche pas — on montre.
  const aVerifier: { a: Deal; b: Deal; motif: string }[] = []
  for (let i = 0; i < deals.length; i++) {
    for (let j = i + 1; j < deals.length; j++) {
      const a = deals[i]
      const b = deals[j]
      if (clefProduit(a.produit) !== clefProduit(b.produit)) continue
      if (Math.abs(joursEntre(a.date, b.date)) > 7) continue
      // Ressemblance déjà tranchée à la lecture du mail : on ne la ressort pas.
      if (a.distinctConfirme || b.distinctConfirme) continue
      const motifs: string[] = []
      if (a.nominal !== b.nominal) motifs.push('nominal différent')
      if ((a.emetteur ?? '') !== (b.emetteur ?? '')) motifs.push('émetteur différent')
      if (motifs.length) aVerifier.push({ a, b, motif: motifs.join(', ') })
    }
  }

  return { deals, doublons, aVerifier }
}

const joursEntre = (a: string, b: string): number =>
  (new Date(a).getTime() - new Date(b).getTime()) / 86400000

/** Lundi (ISO) de la semaine contenant `d`. */
export function lundiDeLaSemaine(d: Date): string {
  const j = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const jour = (j.getUTCDay() + 6) % 7 // lundi = 0
  j.setUTCDate(j.getUTCDate() - jour)
  return j.toISOString().slice(0, 10)
}

/** Deals annoncés pendant la semaine (lundi → dimanche) contenant `reference`. */
export function dealsDeLaSemaine(deals: Deal[], reference: Date): Deal[] {
  const lundi = lundiDeLaSemaine(reference)
  const dimanche = new Date(new Date(lundi).getTime() + 6 * 86400000).toISOString().slice(0, 10)
  return deals.filter((d) => d.date >= lundi && d.date <= dimanche)
}

/**
 * Un deal est « en cours de commercialisation » tant que sa date de fin n'est
 * pas passée. Sans date annoncée, on ne présume RIEN : le produit n'est pas
 * compté comme en commercialisation (l'inverse gonflerait artificiellement la
 * liste avec des affaires closes depuis des mois).
 */
export function enCommercialisation(deals: Deal[], aujourdHui: Date): Deal[] {
  const j = aujourdHui.toISOString().slice(0, 10)
  return deals.filter((d) => !!d.finCommercialisation && d.finCommercialisation >= j)
}

/** Tous les assureurs cités, dédoublonnés — alimente le filtre AVF. */
export function assureurs(deals: Deal[]): string[] {
  const set = new Set<string>()
  for (const d of deals) for (const a of d.avf ?? []) if (a.trim()) set.add(a.trim())
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
}
