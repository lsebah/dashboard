// ─────────────────────────────────────────────────────────────────────────
//  Liens vers les termsheets (PDF), par ISIN.
//  Fichiers du dossier OneDrive : .../Documents/Documents/Termsheets/
//  (la termsheet est la source de vérité — voir la fiche produit / popup).
// ─────────────────────────────────────────────────────────────────────────
const BASE =
  'https://capitalmanagementfrance-my.sharepoint.com/personal/l_sebah_cmf_finance/Documents/Documents/Termsheets/'

/** ISIN → nom de fichier exact dans le dossier Termsheets. */
export const TERMSHEET_FILES: Record<string, string> = {
  XS3262011201: '260326_1Y_Inverse Reverse Autocall USO_Trimestriel_XS3262011201_MAREX.PDF',
  XS3291617812: '260312_8Y_Athena Airbag SX5E 8x Repo_Annuel_XS3291617812_BNP.PDF',
  FRSG00015XB8:
    '250325_4Y_Autocall Equipondéré TotalEnergies + ENI + Shell_Annuel_FRSG00015XB8_SOCGEN.pdf',
  XS3266363806:
    '260311_5Y_Athena Airbag Mensuel sur Thales Safran et Rheinmetall_Mensuel_XS3266363806_BNP.PDF',
  XS3317870197:
    '260410_5Y_Phoenix Mémoire Worst of Accor + Carnival corp  + United Airlines_Trimestriel_XS3317870197_BNP.PDF',
  XS3304996484: 'TS - XS3304996484.pdf',
  XS3309979311:
    '260407_5Y_Phoenix Mémoire Software (CRM + MSFT + SAP)_Trimestriel_XS3309979311_BNP.PDF',
  XS3283137407:
    '260316_5Y_Phoenix Mémoire Wof  Alphabet   Amazon   CrowdStrike_Trimestriel_XS3283137407_BNP.PDF',
  XS3148625976:
    '251030_5Y_Phoenix Memory Degressif RACE + ACA + NOVOB_Trimestriel_XS3148625976_BBVA.pdf',
  FRIP000014P8: '250113_10Y_Autocall Bonus Luxe_Annuel_FRIP000014P8_MSCO.pdf',
  XS2769371209: '241111_5Y_Autocall Airbag ASML_Annuel_XS2769371209_GS.pdf',
  XS2872777334:
    '240812_4Y_Participation note SPX no gearing - KG 18.8%_In Fine_XS2872777334_CIBC.pdf',
  XS2884074795: '240820_1Y_Call Spread Low Strike 75135 -  ASML_in fine_XS2884074795_CIBC.pdf',
  XS3073984430:
    '250807_12Y_Phoenix Bearish  CMS10 Trimestriel 2.52.9 - 8%_Trimestriel_XS3073984430_BNP.PDF',
  XS2975786000: '250317_3Y_ZC CLN Tranche Crossover_in fine_XS2975786000_BNP.pdf',
  XS2442403130: '221125_12Y_TARN CMS 30Y - CMS 2Y_Trimestriel_XS2442403130_BNP.pdf',
  FR001400T357: '241014_7Y_Bear Athena SOFR CMS10_Annuel_FR001400T357_SOCGEN.pdf',
  CH1271361060: '231201_2Y_Dette Privée - SIP Chabanais_Semestriel_CH1271361060_.pdf',
  XS2621505341:
    '250514_10Y_TRY Denominated NC3 Callable In Fine Note with EUR Settlement_Annuel_XS2621505341_BNP (2).pdf',
}

export function termsheetFile(isin: string): string | undefined {
  return TERMSHEET_FILES[isin]
}

/** Lien cliquable (PDF SharePoint) pour un ISIN, si la termsheet est connue. */
export function termsheetUrl(isin: string): string | undefined {
  const f = TERMSHEET_FILES[isin]
  return f ? encodeURI(BASE + f) : undefined
}
