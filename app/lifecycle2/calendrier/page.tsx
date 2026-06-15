import { products } from '@/lib/products'
import CalendarView from '@/app/lifecycle/components/CalendarView'

export default function CalendrierPage() {
  return <CalendarView products={products} />
}
