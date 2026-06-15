import comparatif from '@/lib/decrement-comparatif.json'
import ComparatifDecrement from '@/app/lifecycle/components/ComparatifDecrement'
import DecrementMonitoringBanner from '../components/DecrementMonitoringBanner'

export default function DecrementPage() {
  return (
    <div>
      <DecrementMonitoringBanner />
      <ComparatifDecrement rows={comparatif} />
    </div>
  )
}
