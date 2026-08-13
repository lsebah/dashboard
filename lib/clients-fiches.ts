// ─────────────────────────────────────────────────────────────────────────
//  Fiches clients — source unique de vérité pour l'identité d'un client, ses
//  documents, sa rétrocession et surtout ses ABONNEMENTS AU REPORTING.
//
//  Pourquoi une source unique : jusqu'ici la liste des destinataires vivait dans
//  data/client-emails.json (dans git, éditable seulement par commit) et la
//  cadence était codée en dur dans le workflow — le lundi partait en LOT à
//  Laurent, le 1er du mois partait aux clients. Résultat : 13 clients sur 31
//  n'avaient aucune adresse et étaient ignorés EN SILENCE, sans que rien ne le
//  signale. Désormais l'abonnement est une donnée (cochée dans l'onglet
//  Maintenance), lue par l'agent d'envoi via /api/clients/fiches.
//
//  MIGRATION SANS RÉGRESSION : un client sans fiche enregistrée hérite d'une
//  fiche PAR DÉFAUT qui reproduit exactement le comportement actuel —
//  `envoiMensuel` vrai s'il a une adresse dans data/client-emails.json,
//  `envoiHebdo` faux (aujourd'hui aucun client ne reçoit d'envoi hebdomadaire).
//  Personne ne gagne ni ne perd un envoi du seul fait du déploiement.
// ─────────────────────────────────────────────────────────────────────────

/** Assureurs vie France proposés (multi-sélection). */
export const AV_FRANCE = [
  'AXA',
  'Abeille',
  'Generali',
  'Swisslife',
  'Spirica',
  'UAF',
  'Nortia',
  'Autres',
] as const

export type AvFrance = (typeof AV_FRANCE)[number]

/** Cadence d'envoi du relevé de valorisation. */
export type Cadence = 'hebdo' | 'mensuel'

export interface FicheClient {
  /** Libellé client EXACT du portefeuille (« ABACUS - 05268 ») — clé primaire. */
  code: string
  /** Raison sociale (« Abacus Patrimoine »). */
  entite?: string
  /** Interlocuteur (personne physique). */
  nom?: string
  /** Une ou plusieurs adresses, séparées par « , » ou « ; ». */
  email?: string
  tel?: string
  adresse?: string
  /** Rétrocession indicative, en DÉCIMAL (0.005 = 0,50 %) — même unité que lib/commissions. */
  retroIndic?: number
  /** Assureurs vie France référencés pour ce client. */
  avFrance?: string[]
  /** Abonnement au relevé hebdomadaire (lundi). */
  envoiHebdo: boolean
  /** Abonnement au relevé mensuel (1er du mois). */
  envoiMensuel: boolean
  /** Horodatage ISO de la dernière modification (traçabilité). */
  maj?: string
}

/** Fiche + d'où elle vient — l'interface distingue le saisi du déduit. */
export interface FicheEffective extends FicheClient {
  /** 'fiche' = enregistrée en Maintenance ; 'defaut' = héritée de l'existant. */
  origine: 'fiche' | 'defaut'
  /** Adresses exploitables (validées, dédoublonnées). */
  destinataires: string[]
  /** Adresses saisies mais rejetées (affichées en garde-fou, jamais envoyées). */
  emailsInvalides: string[]
}

// Volontairement conservateur : on préfère signaler une adresse douteuse dans
// l'interface plutôt que la donner à Resend, qui la rejetterait silencieusement
// au milieu d'un envoi.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(?:\.[^\s@,;.]+)+$/

export function emailValide(v: string): boolean {
  return EMAIL_RE.test(v.trim())
}

/**
 * Découpe une saisie multi-adresses en adresses valides / invalides.
 * Accepte « , » et « ; » comme séparateurs (les deux sont utilisés dans le
 * fichier historique), dédoublonne sans tenir compte de la casse.
 */
export function separerEmails(value: unknown): { valides: string[]; invalides: string[] } {
  const brut = Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[,;]/)
  const valides: string[] = []
  const invalides: string[] = []
  const vus = new Set<string>()
  for (const e of brut) {
    const v = e.trim()
    if (!v) continue
    if (!emailValide(v)) {
      invalides.push(v)
      continue
    }
    const cle = v.toLowerCase()
    if (vus.has(cle)) continue
    vus.add(cle)
    valides.push(v)
  }
  return { valides, invalides }
}

/**
 * Pourcentage saisi (« 0,5 », « 0.5 », « 0,5 % ») → décimal (0.005).
 * Renvoie `undefined` si la saisie est vide ou illisible, et REFUSE le négatif
 * comme le supérieur à 100 % : une rétrocession hors de [0 ; 100] n'est pas une
 * valeur approchée, c'est une faute de frappe.
 */
export function parsePourcentage(input: string | number | null | undefined): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 && input <= 100 ? input / 100 : undefined
  if (input == null) return undefined
  const s = String(input).replace(/[\s  '%]/g, '')
  if (!s) return undefined
  if (/^-/.test(s)) return undefined
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined
  return n / 100
}

/** Décimal (0.005) → texte de saisie en pourcent (« 0,5 »). */
export function formatPourcentage(v: number | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return ''
  return String(Math.round(v * 1000000) / 10000).replace('.', ',')
}

/**
 * Fiche par défaut d'un client sans enregistrement : reproduit à l'identique le
 * comportement d'avant la Maintenance (cf. en-tête du fichier).
 */
export function ficheParDefaut(code: string, emailHistorique?: string): FicheClient {
  const { valides } = separerEmails(emailHistorique)
  return {
    code,
    email: emailHistorique?.trim() || undefined,
    envoiMensuel: valides.length > 0,
    envoiHebdo: false,
  }
}

/** Nettoie une fiche reçue du navigateur (aucune confiance dans l'entrée). */
export function normaliserFiche(input: unknown): FicheClient | undefined {
  if (!input || typeof input !== 'object') return undefined
  const o = input as Record<string, unknown>
  const code = typeof o.code === 'string' ? o.code.trim() : ''
  if (!code) return undefined
  const texte = (v: unknown): string | undefined => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s ? s : undefined
  }
  const av = Array.isArray(o.avFrance)
    ? o.avFrance.filter((x): x is string => typeof x === 'string' && (AV_FRANCE as readonly string[]).includes(x))
    : undefined
  const retro = typeof o.retroIndic === 'number' && Number.isFinite(o.retroIndic) && o.retroIndic >= 0 && o.retroIndic <= 1
    ? o.retroIndic
    : undefined
  return {
    code,
    entite: texte(o.entite),
    nom: texte(o.nom),
    email: texte(o.email),
    tel: texte(o.tel),
    adresse: texte(o.adresse),
    retroIndic: retro,
    avFrance: av && av.length ? av : undefined,
    envoiHebdo: o.envoiHebdo === true,
    envoiMensuel: o.envoiMensuel === true,
    maj: texte(o.maj),
  }
}

/**
 * Liste effective des clients : union de tous les codes connus (portefeuille,
 * annuaire, fichier historique, fiches saisies), chacun résolu en fiche
 * enregistrée ou, à défaut, en fiche par défaut.
 *
 * L'union est indispensable : un client créé en Maintenance n'a encore aucune
 * position, et un client du portefeuille peut n'avoir jamais eu de fiche.
 */
export function fusionnerFiches(opts: {
  codesConnus: string[]
  fiches: Record<string, FicheClient> | null | undefined
  emailsHistoriques: Record<string, string>
}): FicheEffective[] {
  const enregistrees = opts.fiches ?? {}
  const codes = new Set<string>()
  for (const c of opts.codesConnus) if (c && c.trim()) codes.add(c.trim())
  for (const c of Object.keys(enregistrees)) if (c && c.trim()) codes.add(c.trim())
  for (const c of Object.keys(opts.emailsHistoriques)) if (c && !c.startsWith('_')) codes.add(c.trim())

  // Array.from (et non un spread d'itérateur) : le tsconfig cible ES5.
  return Array.from(codes)
    .map((code) => {
      const saisie = enregistrees[code]
      const fiche = saisie ?? ficheParDefaut(code, opts.emailsHistoriques[code])
      const { valides, invalides } = separerEmails(fiche.email)
      return {
        ...fiche,
        code,
        origine: (saisie ? 'fiche' : 'defaut') as 'fiche' | 'defaut',
        destinataires: valides,
        emailsInvalides: invalides,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code, 'fr'))
}

/** Vrai si le client est abonné à la cadence donnée. */
export function abonne(f: Pick<FicheClient, 'envoiHebdo' | 'envoiMensuel'>, cadence: Cadence): boolean {
  return cadence === 'hebdo' ? f.envoiHebdo : f.envoiMensuel
}

/** Motif pour lequel un client abonné ne peut pas être servi (sinon undefined). */
export function motifBlocage(f: FicheEffective): string | undefined {
  if (f.destinataires.length === 0)
    return f.emailsInvalides.length > 0
      ? `adresse illisible : ${f.emailsInvalides.join(', ')}`
      : 'aucune adresse email'
  return undefined
}
