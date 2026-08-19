import brut from '@/data/deal-done.json'
import DealDoneView from '../components/DealDoneView'
import type { Deal } from '@/lib/deal-done'
import { products } from '@/lib/products'
import { couponPa } from '@/lib/lifecycle'

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
  // Strike (constatation initiale) par ISIN : c'est LUI qui date une affaire
  // reprise du registre, lequel ne connaît que la date d'émission.
  const strikes: Record<string, string> = {}
  const couponsDecodes: Record<string, number> = {}
  for (const p of products) {
    if (p.dateConstatationInitiale) strikes[p.isin] = p.dateConstatationInitiale
    const cpn = couponPa(p)
    if (typeof cpn === 'number') couponsDecodes[p.isin] = cpn
  }
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
      <DealDoneView deals={deals} fenetre={fenetre} strikes={strikes} couponsDecodes={couponsDecodes} />
    </div>
  )
}
