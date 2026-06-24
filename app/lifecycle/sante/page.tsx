import { products } from '@/lib/products'
import DataHealthView from '../components/DataHealthView'

export const metadata = { title: 'Santé des données — Lifecycle CMF' }

export default function SantePage() {
  return <DataHealthView products={products} />
}
