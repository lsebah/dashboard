import comparatif from '@/lib/decrement-comparatif.json'
import ComparatifDecrement from '@/app/lifecycle/components/ComparatifDecrement'

export default function ComparatifPage() {
  return <ComparatifDecrement rows={comparatif} />
}
