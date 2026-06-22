import { products } from '@/lib/products'
import PrintReports from './PrintReports'

// Page d'impression dédiée (hors layout /lifecycle → aucune barre de navigation).
// /print?client=<code>  → une feuille de reporting (rendue en PDF par
//                          scripts/reporting_clients.mjs via un navigateur headless).
// /print                → toutes les feuilles enchaînées (saut de page entre clients),
//                          pratique pour un export « tout en un » par Ctrl-P.
export const dynamic = 'force-dynamic'

export default function PrintPage({ searchParams }: { searchParams: { client?: string } }) {
  const client = typeof searchParams.client === 'string' ? searchParams.client : undefined
  return (
    <div className="min-h-screen bg-white p-6 print:p-0">
      <PrintReports products={products} selectedClient={client} />
    </div>
  )
}
