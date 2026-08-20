// ─────────────────────────────────────────────────────────────────────────
//  « Santé des données » — détecte les trous du portefeuille (coupon manquant,
//  TS absente, niveau d'airbag non décodé, devise incohérente, type non
//  identifié). Fonction pure → réutilisée par l'écran de suivi et les tests.
// ─────────────────────────────────────────────────────────────────────────
import type { Product } from './types'
import { couponPa } from './lifecycle'
import { aAirbag, airbagNiveau, productTypeLabel } from './classification'
import {
  termsheetUrl,
  TERMSHEET_FILES,
  TERMSHEET_ISINS,
  parseTermsheetName,
  INDEX_SYNC_LE,
  indexAgeJours,
} from './termsheets'
import tsPdfs from './ts-pdfs.json'

const TS_PDFS = tsPdfs as Record<string, string>

export interface HealthItem {
  isin: string
  nom: string
  type: string
  statut?: string
  detail?: string
}

export interface DataHealth {
  total: number
  sansCoupon: HealthItem[]
  sansTS: HealthItem[]
  airbagSansNiveau: HealthItem[]
  deviseSuspecte: HealthItem[]
  typeNonIdentifie: HealthItem[]
  /** Termsheet présente dans le dossier OneDrive, mais AUCUN produit ne
   *  porte son ISIN — le sens inverse de `sansTS`. Sans ce contrôle, une
   *  termsheet neuve reste invisible tant que personne ne la remarque à
   *  l'œil : ni décodée, ni signalée, juste absente. */
  termsheetSansProduit: HealthItem[]
  /** Fraîcheur de l'index du dossier. TOUS les contrôles ci-dessus lisent
   *  l'index, jamais le dossier : si l'index cesse d'être rafraîchi, ils
   *  deviennent silencieusement aveugles et restent au vert. Ce champ rend
   *  cette panne-là visible. */
  indexTermsheets: { syncLe: string; ageJours: number; perime: boolean }
}

/** Au-delà, l'index n'est plus une image du dossier (synchro quotidienne). */
export const INDEX_PERIME_JOURS = 10

/** Statuts qui ferment un produit : plus rien à décoder ni à surveiller. */
export const STATUTS_CLOS = new Set(['rappele', 'vendu', 'echu'])

export interface ADecoder {
  isin: string
  nom: string
  raison: string
  client: string | null
}

/**
 * Produits VIVANTS qui disposent d'une termsheet mais dont le payoff n'est pas
 * (complètement) décodé. Partagé par /api/lifecycle/decode-status et par
 * l'audit hebdomadaire : deux copies de ce filtre finiraient par diverger, et
 * c'est précisément un contrôle qui ne doit pas pouvoir mentir.
 */
export function produitsADecoder(products: Product[]): ADecoder[] {
  return products
    .filter((p) => !STATUTS_CLOS.has(p.statut ?? ''))
    .filter((p) => aTermsheet(p))
    .filter((p) => {
      if (!p.terms) return true // aucune mécanique décodée
      // Vrai autocall/phoenix (barrière de rappel définie) : le calendrier
      // d'observations doit être décodé. Les participations/airbags sans rappel
      // (in fine) n'ont pas de calendrier attendu → pas signalés.
      const t = p.terms
      const aRappel = t.kind === 'autocall' && typeof t.barriereRappelPct === 'number'
      return aRappel && (!p.observations || p.observations.length === 0)
    })
    .map((p) => ({
      isin: p.isin,
      nom: p.nom,
      raison: !p.terms ? 'mécanique (terms) non décodée' : 'calendrier d’observations absent',
      client: (p.clients ?? []).join(', ') || null,
    }))
}

/** Une TS est « disponible » si un PDF local, une URL produit ou l'index la résout. */
export function aTermsheet(p: Product): boolean {
  return !!(TS_PDFS[p.isin] || p.termsheetUrl || termsheetUrl(p.isin))
}

/** Type censé porter un coupon périodique (Athéna / Phoenix). */
function estCouponnable(label: string): boolean {
  return /ath[ée]na|phoenix/i.test(label)
}

const item = (p: Product, detail?: string): HealthItem => ({
  isin: p.isin,
  nom: p.nom,
  type: productTypeLabel(p),
  statut: p.statut,
  detail,
})

export function computeDataHealth(products: Product[]): DataHealth {
  const sansCoupon: HealthItem[] = []
  const sansTS: HealthItem[] = []
  const airbagSansNiveau: HealthItem[] = []
  const deviseSuspecte: HealthItem[] = []
  const typeNonIdentifie: HealthItem[] = []

  for (const p of products) {
    const label = productTypeLabel(p)
    // Coupon attendu (Athéna/Phoenix) mais introuvable.
    if (estCouponnable(label) && couponPa(p) == null) sansCoupon.push(item(p))
    // Termsheet non disponible.
    if (!aTermsheet(p)) sansTS.push(item(p))
    // Airbag sans niveau de protection décodé.
    if (aAirbag(p) && airbagNiveau(p) == null) airbagSansNiveau.push(item(p))
    // Devise ≠ EUR alors que le libellé mentionne EUR (incohérence probable).
    if (p.devise && p.devise !== 'EUR' && /\bEUR(O)?\b/i.test(`${p.nom ?? ''} ${p.description ?? ''}`))
      deviseSuspecte.push(item(p, `devise saisie : ${p.devise}`))
    // Type non identifiable.
    if (label === '—') typeNonIdentifie.push(item(p))
  }

  // Termsheets du dossier dont l'ISIN n'appartient à AUCUN produit du feed —
  // ni décodées, ni même créées. On lit ce qu'on peut du nom de fichier
  // (nomenclature) ; rien n'est deviné pour les champs que le nom ne porte pas.
  const isinsConnus = new Set(products.map((p) => p.isin))
  const termsheetSansProduit: HealthItem[] = TERMSHEET_ISINS.filter((isin) => !isinsConnus.has(isin)).map(
    (isin) => {
      const fichier = TERMSHEET_FILES[isin]
      const meta = parseTermsheetName(fichier)
      return {
        isin,
        nom: meta.nom ?? fichier,
        type: meta.emetteur ?? '—',
        detail: meta.dateEmission ? `déposée le ${meta.dateEmission}` : fichier,
      }
    },
  )

  const ageJours = indexAgeJours()

  return {
    total: products.length,
    sansCoupon,
    sansTS,
    airbagSansNiveau,
    deviseSuspecte,
    typeNonIdentifie,
    termsheetSansProduit,
    indexTermsheets: {
      syncLe: INDEX_SYNC_LE,
      ageJours,
      perime: ageJours > INDEX_PERIME_JOURS,
    },
  }
}
