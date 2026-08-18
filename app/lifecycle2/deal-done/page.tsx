import brut from '@/data/deal-done.json'
import DealDoneView from '../components/DealDoneView'
import type { Deal } from '@/lib/deal-done'

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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Deal Done</h1>
        <p className="text-[13px] text-slate-500">
          Les affaires annoncées par l’équipe dans le dossier Outlook « DEAL DONE »,
          complétées par le registre des commissions — y compris les tickets saisis
          directement dans Lifecycle.
        </p>
      </div>
      <DealDoneView deals={deals} fenetre={fenetre} />
    </div>
  )
}
