// ─────────────────────────────────────────────────────────────────────────
//  Index des termsheets (PDF) du dossier OneDrive .../Documents/Termsheets/.
//  Parseur : à partir de la liste des noms de fichiers (lib/termsheets-index.json),
//  on extrait l'ISIN de chaque nom → table ISIN → fichier → lien cliquable.
//  Ajouter une termsheet = ajouter son nom dans l'index (re-synchro du dossier).
// ─────────────────────────────────────────────────────────────────────────
import index from './termsheets-index.json'
import type { Frequency } from './types'

// Site OneDrive personnel + dossier (chemin relatif serveur) des termsheets.
const ONEDRIVE_SITE =
  'https://capitalmanagementfrance-my.sharepoint.com/personal/l_sebah_cmf_finance'
const TERMSHEETS_FOLDER =
  '/personal/l_sebah_cmf_finance/Documents/Documents/Termsheets'

// ISIN = 2 lettres + 9 alphanum + 1 chiffre (clé de contrôle).
const ISIN_RE = /[A-Z]{2}[A-Z0-9]{9}[0-9]/

/** Noms de fichiers du dossier sans ISIN identifiable (non rattachables). */
export const TERMSHEET_ORPHELINS: string[] = []

// Fichiers du dossier dont le NOM ne contient pas l'ISIN (réf interne banque,
// « Serie XXXX », « Quartz NN »…). Rattachement manuel ISIN → nom de fichier,
// l'ISIN ayant été lu dans le TEXTE de la TS. Complété au fil des lectures.
const TERMSHEET_FILES_OVERRIDE: Record<string, string> = {
  XS2759139525: 'EI9052EAG - 5Y Athena Airbag on Kering in EUR - Finalized TS[1].pdf',
}

/** ISIN → nom de fichier de la termsheet (premier match conservé). */
export const TERMSHEET_FILES: Record<string, string> = {}
for (const f of index as string[]) {
  const m = f.match(ISIN_RE)
  if (!m) {
    TERMSHEET_ORPHELINS.push(f)
    continue
  }
  if (!TERMSHEET_FILES[m[0]]) TERMSHEET_FILES[m[0]] = f
}
// Les rattachements manuels priment (orphelins sans ISIN dans le nom).
Object.assign(TERMSHEET_FILES, TERMSHEET_FILES_OVERRIDE)

/** ISIN couverts par une termsheet du dossier. */
export const TERMSHEET_ISINS: string[] = Object.keys(TERMSHEET_FILES)

export function termsheetFile(isin: string): string | undefined {
  return TERMSHEET_FILES[isin]
}

/**
 * Lien OneDrive (visionneuse) pour un ISIN, si la termsheet est connue.
 * Le chemin direct du fichier renvoie un 404 sur OneDrive perso ; on passe par
 * `onedrive.aspx?id=<chemin fichier>&parent=<dossier>` qui ouvre la visionneuse.
 */
export function termsheetUrl(isin: string): string | undefined {
  const f = TERMSHEET_FILES[isin]
  if (!f) return undefined
  const filePath = `${TERMSHEETS_FOLDER}/${f}`
  return `${ONEDRIVE_SITE}/_layouts/15/onedrive.aspx?id=${encodeURIComponent(
    filePath,
  )}&parent=${encodeURIComponent(TERMSHEETS_FOLDER)}`
}

// ─────────────────────────────────────────────────────────────────────────
//  Convention de nommage du dossier Termsheets :
//   YYMMDD_<durée>Y_<Nom commercial>_<Fréquence>_<ISIN>_<ÉMETTEUR>.pdf
//  ex. « 260220_5Y_Phoenix Memoire Réarmement Europe_Trimestriel_XS3250102665_BBVA.pdf »
//  - YYMMDD  : date de strike / émission
//  - <durée>Y: maturité en années (5Y, 10Y, 12Y…)
//  - Fréquence : Mensuel | Trimestriel | Semestriel | Annuel | In Fine
//  - ÉMETTEUR : code court (BNP, SOCGEN, BBVA, GS, MSCO, CITI, CIBC, EFG…)
//  `parseTermsheetName` lit un nom (même non conforme) ; `canonicalTermsheetName`
//  reconstruit le nom propre à partir des métadonnées d'un produit.
// ─────────────────────────────────────────────────────────────────────────
export interface TermsheetMeta {
  fichier: string
  isin?: string
  dateEmission?: string // ISO (yyyy-mm-dd)
  dureeAnnees?: number
  nom?: string
  frequence?: Frequency
  emetteur?: string // code court tel qu'écrit dans le nom de fichier
  conforme: boolean // respecte la convention complète
}

const FREQ_FROM_LABEL: Record<string, Frequency> = {
  mensuel: 'mensuel',
  trimestriel: 'trimestriel',
  semestriel: 'semestriel',
  annuel: 'annuel',
  'in fine': 'in_fine',
  in_fine: 'in_fine',
  infine: 'in_fine',
}
const FREQ_LABEL_CANON: Record<Frequency, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
  in_fine: 'In Fine',
  autre: 'Autre',
}

/** Analyse un nom de fichier de termsheet (tolérant aux variantes). */
export function parseTermsheetName(fichier: string): TermsheetMeta {
  const base = fichier.replace(/\.(pdf|txt)$/i, '')
  const isin = base.match(ISIN_RE)?.[0]
  const tokens = base.split('_').map((t) => t.trim()).filter(Boolean)

  const dateM = tokens[0]?.match(/^(\d{2})(\d{2})(\d{2})$/)
  const dateEmission = dateM ? `20${dateM[1]}-${dateM[2]}-${dateM[3]}` : undefined

  const iTenor = tokens.findIndex((t) => /^(\d+(?:\.\d+)?)Y+$/i.test(t))
  const dureeAnnees =
    iTenor >= 0 ? parseFloat(tokens[iTenor].match(/^(\d+(?:\.\d+)?)Y+$/i)![1]) : undefined

  const iFreq = tokens.findIndex((t) => FREQ_FROM_LABEL[t.toLowerCase()] !== undefined)
  const frequence = iFreq >= 0 ? FREQ_FROM_LABEL[tokens[iFreq].toLowerCase()] : undefined

  // Émetteur = dernier jeton s'il n'est pas l'ISIN et ressemble à un code.
  const last = tokens[tokens.length - 1]
  const emetteur =
    last && last !== isin && /^[A-Za-z().+\- ]{2,}$/.test(last) ? last : undefined

  // Nom = jetons entre durée et fréquence (sinon entre date et ISIN).
  let nom: string | undefined
  if (iTenor >= 0 && iFreq > iTenor) nom = tokens.slice(iTenor + 1, iFreq).join(' ').trim() || undefined
  else if (isin) {
    const iIsin = tokens.findIndex((t) => t.includes(isin))
    if (iIsin > 1) nom = tokens.slice(1, iIsin).join(' ').trim() || undefined
  }

  const conforme = !!(dateEmission && dureeAnnees && frequence && isin && emetteur)
  return { fichier, isin, dateEmission, dureeAnnees, nom, frequence, emetteur, conforme }
}

// Raison sociale émetteur → code court utilisé dans la nomenclature.
const ISSUER_CODES: [RegExp, string][] = [
  [/soci[ée]t[ée] g[ée]n[ée]rale|\bSG Issuer\b|\bSG\b/i, 'SOCGEN'],
  [/BNP/i, 'BNP'],
  [/BBVA/i, 'BBVA'],
  [/goldman/i, 'GS'],
  [/morgan stanley/i, 'MSCO'],
  [/citi/i, 'CITI'],
  [/CIBC|canadian imperial/i, 'CIBC'],
  [/EFG/i, 'EFG'],
  [/barclays/i, 'BARCLAYS'],
  [/santander/i, 'SANTANDER'],
  [/deutsche/i, 'DB'],
  [/\bCIC\b/i, 'CIC'],
  [/marex/i, 'MAREX'],
  [/bank of america|bofa/i, 'BOFA'],
  [/internationale à luxembourg|\bBIL\b/i, 'BIL'],
  [/vinga/i, 'VINGA'],
]

/** Code émetteur court (BNP, SOCGEN…) depuis la raison sociale. */
export function issuerCode(name?: string): string {
  if (!name) return '—'
  for (const [re, code] of ISSUER_CODES) if (re.test(name)) return code
  return name.split(/\s+/)[0].toUpperCase()
}

/** Nom de fichier TS cible (nomenclature) calculé depuis un produit de l'app. */
export function canonicalForProduct(p: {
  isin: string
  dateEmission: string
  dateConstatationInitiale: string
  dateEcheance: string
  description?: string
  nom: string
  frequence: Frequency
  emetteur: string
}): string {
  const a = new Date(p.dateConstatationInitiale).getTime()
  const b = new Date(p.dateEcheance).getTime()
  const dureeAnnees =
    Number.isFinite(a) && Number.isFinite(b)
      ? Math.max(1, Math.round((b - a) / (365.25 * 86_400_000)))
      : 0
  return canonicalTermsheetName({
    dateEmission: p.dateEmission,
    dureeAnnees,
    nom: p.description ?? p.nom,
    frequence: p.frequence,
    isin: p.isin,
    emetteur: issuerCode(p.emetteur),
  })
}

/** Reconstruit le nom canonique (convention) à partir des métadonnées produit. */
export function canonicalTermsheetName(p: {
  dateEmission: string
  dureeAnnees: number
  nom: string
  frequence: Frequency
  isin: string
  emetteur: string // code court (BNP, SOCGEN…)
}): string {
  const d = p.dateEmission.replace(/-/g, '').slice(2) // YYMMDD
  const nom = p.nom.replace(/[\\/_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const freq = FREQ_LABEL_CANON[p.frequence] || 'Autre'
  return `${d}_${p.dureeAnnees}Y_${nom}_${freq}_${p.isin}_${p.emetteur}.pdf`
}

/** Métadonnées de la termsheet d'un ISIN (depuis le nom de fichier). */
export function termsheetMeta(isin: string): TermsheetMeta | undefined {
  const f = TERMSHEET_FILES[isin]
  return f ? parseTermsheetName(f) : undefined
}

/** Termsheets du dossier dont le nom ne respecte pas la convention (à renommer). */
export const TERMSHEET_NONCONFORME: TermsheetMeta[] = (index as string[])
  .map(parseTermsheetName)
  .filter((m) => !m.conforme)
