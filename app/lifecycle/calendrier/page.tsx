import { products } from '@/lib/products'
import CalendarView from '../components/CalendarView'

export const metadata = { title: 'Calendrier — Lifecycle CMF' }

export default function CalendrierPage() {
  return <CalendarView products={products} />
}
