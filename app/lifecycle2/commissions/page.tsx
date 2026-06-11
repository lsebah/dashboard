import { commissions } from '@/lib/commissions'
import CommissionsView from '@/app/lifecycle/components/CommissionsView'

export default function CommissionsPage() {
  return <CommissionsView data={commissions} />
}
