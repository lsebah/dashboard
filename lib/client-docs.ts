// ─────────────────────────────────────────────────────────────────────────
//  Inventaire des documents clients déposés sur OneDrive.
//
//  Emplacement de référence (poste de Laurent) :
//      C:\Users\lseba\OneDrive - CMF\Documents\Clients\<dossier client>
//  côté Microsoft Graph, le même dossier s'adresse par le chemin « Documents/Clients ».
//  C'est exactement le mécanisme déjà en place pour les termsheets
//  (scripts/sync-termsheets.mjs) : un job liste le dossier et écrit un
//  inventaire versionné ; l'app ne fait que LIRE cet inventaire — elle ne peut
//  pas atteindre un chemin Windows local depuis Vercel.
//
//  Le DER (Document d'Entrée en Relation) est réglementairement obligatoire :
//  on le repère par son nom de fichier et on affiche explicitement son absence,
//  plutôt que de laisser un dossier « vide » se confondre avec un dossier
//  « pas encore synchronisé ».
// ─────────────────────────────────────────────────────────────────────────

export interface DocFichier {
  nom: string
  /** Taille en octets, si connue. */
  taille?: number
  /** Dernière modification (ISO). */
  modifie?: string
  /** Lien OneDrive/SharePoint ouvrable dans le navigateur. */
  url?: string
}

export interface InventaireDocs {
  /** Horodatage ISO de la dernière synchronisation ; null = jamais synchronisé. */
  genere: string | null
  /** Chemin Graph du dossier racine listé. */
  racine: string
  /** Nom du dossier OneDrive → fichiers qu'il contient. */
  dossiers: Record<string, DocFichier[]>
}

/** Racine OneDrive côté Windows, telle que Laurent la voit dans l'Explorateur. */
export const RACINE_WINDOWS = 'C:\\Users\\lseba\\OneDrive - CMF\\Documents\\Clients'

/** Chemin Windows attendu pour un client — affiché dans l'interface pour y déposer les pièces. */
export function cheminWindows(code: string): string {
  return `${RACINE_WINDOWS}\\${code}`
}

/** Minuscules, sans accent, ponctuation réduite à des espaces — pour comparer des noms. */
function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Partie « nom » d'un code client : « ABACUS - 05268 » → « abacus ».
 * Les dossiers OneDrive sont rarement nommés avec le numéro de compte ; le
 * rapprochement doit donc tolérer sa présence comme son absence.
 */
export function radicalCode(code: string): string {
  return normaliser(code.split(' - ')[0] ?? code)
}

/**
 * Vrai si le nom de fichier désigne un DER.
 * Le sigle doit être un MOT : sans cette contrainte, « Ordre_de_souscription »
 * ou « dernier_releve » seraient comptés comme des DER et masqueraient une
 * absence réelle de document réglementaire.
 */
export function estDer(nomFichier: string): boolean {
  const n = normaliser(nomFichier.replace(/\.[a-z0-9]+$/i, ''))
  if (/(^| )der( |$)/.test(n)) return true
  return /entree en relation/.test(n)
}

/**
 * Dossier OneDrive correspondant à un code client, ou undefined.
 * Rapprochement par égalité stricte puis par radical — jamais par
 * « ressemblance » : associer le mauvais dossier ferait afficher le DER d'un
 * client sur la fiche d'un autre.
 */
export function dossierDe(code: string, dossiers: Record<string, DocFichier[]>): string | undefined {
  const noms = Object.keys(dossiers)
  const cible = normaliser(code)
  const exact = noms.find((d) => normaliser(d) === cible)
  if (exact) return exact
  const radical = radicalCode(code)
  if (!radical) return undefined
  const parRadical = noms.filter((d) => radicalCode(d) === radical)
  // Ambiguïté (deux dossiers pour le même radical) → on ne tranche pas.
  return parRadical.length === 1 ? parRadical[0] : undefined
}

export interface DocsClient {
  /** Dossier OneDrive rapproché, ou undefined si aucun. */
  dossier?: string
  /** DER trouvé (le plus récemment modifié si plusieurs). */
  der?: DocFichier
  /** Tous les autres documents du dossier. */
  autres: DocFichier[]
  /** Chemin Windows où déposer les pièces de ce client. */
  chemin: string
}

/** Documents d'un client : DER isolé, reste listé. */
export function docsDuClient(code: string, inv: InventaireDocs | null | undefined): DocsClient {
  const chemin = cheminWindows(code)
  const dossiers = inv?.dossiers ?? {}
  const dossier = dossierDe(code, dossiers)
  if (!dossier) return { autres: [], chemin }
  const fichiers = dossiers[dossier] ?? []
  const ders = fichiers.filter((f) => estDer(f.nom))
  // Plusieurs DER (renouvellements) → on retient le plus récent, à défaut le premier.
  const der = ders.slice().sort((a, b) => (b.modifie ?? '').localeCompare(a.modifie ?? ''))[0]
  return {
    dossier,
    der,
    autres: fichiers.filter((f) => f !== der).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    chemin,
  }
}

/**
 * Dossiers présents sur OneDrive qui ne correspondent à aucun client connu.
 * Signalés dans l'interface : c'est le symptôme habituel d'un dossier mal
 * nommé, donc d'un DER que l'app croit absent alors qu'il existe.
 */
export function dossiersOrphelins(codes: string[], inv: InventaireDocs | null | undefined): string[] {
  const dossiers = inv?.dossiers ?? {}
  const rapproches = new Set<string>()
  for (const c of codes) {
    const d = dossierDe(c, dossiers)
    if (d) rapproches.add(d)
  }
  return Object.keys(dossiers)
    .filter((d) => !rapproches.has(d))
    .sort((a, b) => a.localeCompare(b, 'fr'))
}
