import { products } from '@/lib/products'
import PrintReports from './PrintReports'
import { produitsEffectifs } from '@/lib/server-overlays'

// Page d'impression dédiée (hors layout /lifecycle → aucune barre de navigation).
// /print?client=<code>  → une feuille de reporting (rendue en PDF par
//                          scripts/reporting_clients.mjs via un navigateur headless).
// /print                → toutes les feuilles enchaînées (saut de page entre clients),
//                          pratique pour un export « tout en un » par Ctrl-P.
//
// Les surcouches du terminal sont résolues ICI, côté serveur : le PDF doit
// contenir les trades saisis dans l'interface et respecter les statuts forcés,
// exactement comme l'écran Portefeuille. La map d'allocations traverse la
// frontière serveur → client (une fonction ne le pourrait pas).
export const dynamic = 'force-dynamic'

export default async function PrintPage({ searchParams }: { searchParams: { client?: string } }) {
  const client = typeof searchParams.client === 'string' ? searchParams.client : undefined
  const { products: effectifs, allocMap } = await produitsEffectifs(products)
  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <PrintReports products={effectifs} allocMap={allocMap} selectedClient={client} />
    </div>
  )
}
