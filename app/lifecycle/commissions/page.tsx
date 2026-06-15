import { commissions } from '@/lib/commissions'
import CommissionsView from '../components/CommissionsView'

export default function CommissionsPage() {
  return <CommissionsView data={commissions} />
}
