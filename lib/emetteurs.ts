// ─────────────────────────────────────────────────────────────────────────
//  Codes émetteurs — affichage.
//
//  Règle posée par Laurent (17/08/2026) : partout dans Lifecycle, l'émetteur
//  s'affiche en acronyme de QUATRE LETTRES CAPITALES AU MAXIMUM. Une raison
//  sociale complète (« Goldman Sachs Finance Corp International Ltd ») mange la
//  largeur d'une colonne dans un tableau qui doit tenir à l'écran.
//
//  ⚠️ CE CODE N'EST PAS CELUI DES NOMS DE FICHIERS DE TERMSHEETS.
//  `issuerCode` (lib/termsheets.ts) sert à composer la nomenclature des PDF sur
//  OneDrive : il produit SOCGEN, BARCLAYS, SANTANDER, MAREX. Les ~160 fichiers
//  déjà déposés portent ces suffixes. Aligner les deux reviendrait à renommer
//  tout le dossier au prochain passage de sync-termsheets — ce n'est pas ce qui
//  a été demandé, donc les deux tables restent séparées et cette note explique
//  pourquoi elles diffèrent.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Correspondances explicites. Une entrée ici fait autorité ; tout le reste passe
 * par le repli déterministe ci-dessous.
 */
const CODES: [RegExp, string][] = [
  // Codes dictés par Laurent.
  [/barclays/i, 'BARC'],
  [/goldman|\bGSFCI\b|\bGS\b/i, 'GS'],
  [/CIBC|canadian imperial/i, 'CIBC'],
  [/morgan stanley|\bMSCO\b|\bMS\b/i, 'MSCO'],
  [/BNP/i, 'BNP'],
  [/soci[ée]t[ée] g[ée]n[ée]rale|\bSG Issuer\b|\bSG\b|\bSOCGEN\b/i, 'SG'],
  [/santander/i, 'SANT'],
  [/marex/i, 'MARX'],
  // Émetteurs déjà présents dans les données, dont l'usage maison tient en 4.
  [/BBVA/i, 'BBVA'],
  [/bank of america|\bbofa\b|\bMLBV\b/i, 'BOFA'],
  [/\bUBS\b/i, 'UBS'],
  [/citi/i, 'CITI'],
  [/deutsche/i, 'DB'],
  [/\bCIC\b/i, 'CIC'],
  [/\bEFG\b/i, 'EFG'],
  [/internationale à luxembourg|\bBIL\b/i, 'BIL'],
]

/**
 * Raison sociale → acronyme d'affichage (4 capitales max).
 *
 * Repli pour un émetteur non listé : premier mot, en capitales, tronqué à 4
 * (Mediobanca → MEDI, Nomura → NOMU). C'est déterministe et conforme à la
 * règle, mais ce n'est PAS un code validé — ajoute une entrée dans CODES dès
 * qu'un émetteur devient courant, pour ne pas laisser l'usage se fixer sur une
 * troncature.
 */
export function codeEmetteur(nom?: string | null): string {
  const n = (nom ?? '').trim()
  if (!n) return '—'
  for (const [re, code] of CODES) if (re.test(n)) return code
  return n
    .split(/\s+/)[0]
    .replace(/[^A-Za-zÀ-ÿ]/g, '')
    .toUpperCase()
    .slice(0, 4)
}
