import brut from '@/data/deal-done.json'
import DealDoneView from '../components/DealDoneView'
import type { Deal } from '@/lib/deal-done'
import { commissions } from '@/lib/commissions'
import { croiserAvecRegistre } from '@/lib/deal-done-registre'

export const metadata = { title: 'Deal Done — Lifecycle CMF' }

// Les prix viennent du run Bloomberg côté navigateur : la page est rendue à la
// demande pour ne pas figer un instantané au build.
export const dynamic = 'force-dynamic'

interface Fichier {
  fenetre?: { du: string; au: string }
  deals: Deal[]
}

export default function DealDonePage() {
  const { deals, fenetre } = brut as unknown as Fichier
  // Le dossier Outlook dit ce qui a été ANNONCÉ, le registre ce qui a été FAIT.
  // Le croisement complète les annonces manquantes et rend leur ISIN aux autres.
  const { deals: enrichis, ajoutes } = croiserAvecRegistre(deals, commissions.lignes, '2026')
  const tous = [...enrichis, ...ajoutes]
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Deal Done</h1>
        <p className="text-[13px] text-slate-500">
          Les affaires annoncées par l’équipe dans le dossier Outlook « DEAL DONE »,
          complétées par le registre des commissions — {ajoutes.length} affaire(s) 2026 qui
          n’avaient pas été annoncées y sont reprises.
        </p>
      </div>
      <DealDoneView deals={tous} fenetre={fenetre} />
    </div>
  )
}
