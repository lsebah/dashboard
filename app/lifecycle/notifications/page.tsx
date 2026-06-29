import { products } from '@/lib/products'
import NotificationsView from '../components/NotificationsView'

export const metadata = { title: 'Notifications — Lifecycle CMF' }

export default function NotificationsPage() {
  return <NotificationsView products={products} />
}
