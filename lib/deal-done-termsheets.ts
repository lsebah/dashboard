// ─────────────────────────────────────────────────────────────────────────
//  DEAL DONE × DOSSIER DES TERMSHEETS — la troisième source.
//
//  Deal Done croisait les annonces avec le REGISTRE DES COMMISSIONS, et avec
//  lui seul. Le dossier des termsheets, lui, n'était jamais consulté — alors
//  qu'une termsheet FINALE est la preuve la plus dure qu'une affaire s'est
//  faite : elle porte l'ISIN, la date, l'émetteur et le nom commercial.
//
//  Conséquence constatée le 20/08/2026 : 78 des 117 lignes de Deal Done
//  n'avaient aucun ISIN, donc aucun lien vers le produit ni vers son payoff
//  décodé — et 10 termsheets datées 2026 n'apparaissaient nulle part dans
//  l'onglet, dont 7 dont le payoff était pourtant entièrement décodé.
//
//  Deux gestes distincts, et ils ne se valent pas :
//   • RATTACHER un ISIN à une annonce qui n'en a pas — on le fait, mais avec
//     la même prudence que le registre : coller le mauvais ISIN sur un deal
//     est pire que de n'en coller aucun.
//   • SIGNALER les termsheets du dossier sans aucune ligne Deal Done — on ne
//     fabrique PAS la ligne manquante. Une termsheet dit qu'un produit existe,
//     pas qui l'a vendu ni pour combien ; inventer l'affaire autour d'elle
//     reviendrait à écrire un deal que personne n'a annoncé.
// ─────────────────────────────────────────────────────────────────────────
import type { Deal } from './deal-done'
import { mots, communs, joursEntre } from './deal-done-registre'
import { codeEmetteur } from './emetteurs'
import { TERMSHEET_FILES, parseTermsheetName, type TermsheetMeta } from './termsheets'

export interface TermsheetSansDeal {
  isin: string
  nom: string
  emetteur: string
  date: string
  /** Le payoff est-il décodé côté portefeuille ? */
  decode: boolean
}

export interface CroisementTermsheets {
  /** Deals enrichis de l'ISIN retrouvé au dossier. */
  deals: Deal[]
  /** ISIN rattachés à une annonce qui n'en portait pas — traçabilité. */
  rattaches: { isin: string; deal: string }[]
  /** Termsheets de la période sans aucune ligne Deal Done. */
  sansDeal: TermsheetSansDeal[]
}

/**
 * Une annonce et une termsheet du dossier désignent-elles la même affaire ?
 *
 * Le nom de fichier n'est PAS une source de vérité sur le produit (il s'est
 * déjà révélé faux — « Airbag » sur une termsheet qui n'en comporte pas). Il
 * reste en revanche un bon identifiant : date, émetteur et nom commercial y
 * sont écrits par la personne qui a classé le document.
 *
 * Exigences, calquées sur `memeAffaire` : même émetteur dès que les deux sont
 * connus, puis deux mots distinctifs communs. Un seul mot ne suffit que si la
 * termsheet est datée du jour même de l'annonce — « SpaceX » seul ne prouve
 * rien, « SpaceX le jour même » si.
 */
export function memeAffaireTermsheet(deal: Deal, ts: TermsheetMeta): boolean {
  if (deal.isin || !ts.isin) return false
  const ed = codeEmetteur(deal.emetteur)
  const et = ts.emetteur ? codeEmetteur(ts.emetteur) : null
  // `codeEmetteur` renvoie « — » quand l'annonce ne nomme pas d'émetteur : on
  // ne s'en sert alors pas comme critère, mais on n'invente pas non plus.
  if (ed && et && ed !== '—' && et !== '—' && ed !== et) return false

  const n = communs(mots(`${deal.produit} ${deal.description ?? ''}`), mots(ts.nom))
  if (n === 0) return false
  const ecart = joursEntre(deal.date, ts.dateEmission)
  if (n >= 2) return ecart <= 30
  return ecart <= 7
}

/**
 * Croise les deals avec le dossier des termsheets : rattache les ISIN
 * manquants, et signale les termsheets de la période qui n'ont aucune ligne.
 *
 * À appeler APRÈS `croiserAvecRegistre` : le registre est la source la plus
 * riche (nominal, UF, client), le dossier ne vient que combler les ISIN qu'il
 * n'a pas su fournir.
 */
export function croiserAvecTermsheets(
  deals: Deal[],
  options: { annee?: string; decodes?: Set<string> } = {},
): CroisementTermsheets {
  const { annee = '2026', decodes = new Set<string>() } = options

  const catalogue = Object.entries(TERMSHEET_FILES)
    .map(([isin, fichier]) => ({ ...parseTermsheetName(fichier), isin }))
    .filter((t) => (t.dateEmission ?? '').startsWith(annee))

  const dejaPortes = new Set(deals.map((d) => d.isin).filter((x): x is string => !!x))
  const rattaches: { isin: string; deal: string }[] = []

  const sortie = deals.map((deal) => {
    if (deal.isin) return deal
    // Une termsheet déjà portée par une autre ligne ne peut pas servir deux fois.
    const candidats = catalogue.filter(
      (t) => !dejaPortes.has(t.isin) && memeAffaireTermsheet(deal, t),
    )
    // Ambiguïté = on s'abstient. Deux termsheets plausibles pour une annonce,
    // c'est exactement le cas où un rattachement automatique se trompe.
    if (candidats.length !== 1) return deal
    const t = candidats[0]
    dejaPortes.add(t.isin)
    rattaches.push({ isin: t.isin, deal: deal.id })
    return { ...deal, isin: t.isin }
  })

  const sansDeal: TermsheetSansDeal[] = catalogue
    .filter((t) => !dejaPortes.has(t.isin))
    .map((t) => ({
      isin: t.isin,
      nom: t.nom ?? t.fichier,
      emetteur: t.emetteur ?? '—',
      date: t.dateEmission ?? '',
      decode: decodes.has(t.isin),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return { deals: sortie, rattaches, sansDeal }
}
