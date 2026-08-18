import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { aTermsheet, computeDataHealth } from '@/lib/data-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Contrôle « toutes les TS décodées » : liste les produits VIVANTS qui disposent
// d'une termsheet mais dont le payoff n'est PAS (complètement) décodé :
//   • pas de `terms` (mécanique absente), ou
//   • autocall/phoenix sans calendrier d'observations décodé.
// Consommé par le workflow sync-termsheets (contrôle matinal) et affichable dans
// l'onglet Santé. Aucune valeur n'est inventée : on ne fait que signaler.
const CLOSED = new Set(['rappele', 'vendu', 'echu'])

export async function GET() {
  const aDecoder = products
    .filter((p) => !CLOSED.has(p.statut ?? ''))
    .filter((p) => aTermsheet(p))
    .filter((p) => {
      if (!p.terms) return true // aucune mécanique décodée
      // Vrai autocall/phoenix (barrière de rappel définie) : le calendrier
      // d'observations doit être décodé. Les participations/airbags sans rappel
      // (in fine) n'ont pas de calendrier attendu → pas signalés.
      const t = p.terms
      const aRappel = t.kind === 'autocall' && typeof t.barriereRappelPct === 'number'
      if (aRappel && (!p.observations || p.observations.length === 0)) return true
      return false
    })
    .map((p) => ({
      isin: p.isin,
      nom: p.nom,
      raison: !p.terms ? 'mécanique (terms) non décodée' : 'calendrier d’observations absent',
      client: (p.clients ?? []).join(', ') || null,
    }))

  // En amont du décodage : des termsheets du dossier dont l'ISIN n'a même pas
  // encore de produit dans le feed — invisibles ailleurs, elles ne remonteraient
  // sinon qu'à l'œil, en parcourant le dossier OneDrive au hasard.
  const nonRattachees = computeDataHealth(products).termsheetSansProduit.map((h) => ({
    isin: h.isin,
    nom: h.nom,
    emetteur: h.type,
    detail: h.detail,
  }))

  return NextResponse.json({
    count: aDecoder.length,
    aDecoder,
    countNonRattachees: nonRattachees.length,
    nonRattachees,
  })
}
