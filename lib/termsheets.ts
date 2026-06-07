// ─────────────────────────────────────────────────────────────────────────
//  Index des termsheets (PDF) du dossier OneDrive .../Documents/Termsheets/.
//  Parseur : à partir de la liste des noms de fichiers (lib/termsheets-index.json),
//  on extrait l'ISIN de chaque nom → table ISIN → fichier → lien cliquable.
//  Ajouter une termsheet = ajouter son nom dans l'index (re-synchro du dossier).
// ─────────────────────────────────────────────────────────────────────────
import index from './termsheets-index.json'

const BASE =
  'https://capitalmanagementfrance-my.sharepoint.com/personal/l_sebah_cmf_finance/Documents/Documents/Termsheets/'

// ISIN = 2 lettres + 9 alphanum + 1 chiffre (clé de contrôle).
const ISIN_RE = /[A-Z]{2}[A-Z0-9]{9}[0-9]/

/** Noms de fichiers du dossier sans ISIN identifiable (non rattachables). */
export const TERMSHEET_ORPHELINS: string[] = []

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

/** ISIN couverts par une termsheet du dossier. */
export const TERMSHEET_ISINS: string[] = Object.keys(TERMSHEET_FILES)

export function termsheetFile(isin: string): string | undefined {
  return TERMSHEET_FILES[isin]
}

/** Lien cliquable (PDF SharePoint) pour un ISIN, si la termsheet est connue. */
export function termsheetUrl(isin: string): string | undefined {
  const f = TERMSHEET_FILES[isin]
  return f ? encodeURI(BASE + f) : undefined
}
