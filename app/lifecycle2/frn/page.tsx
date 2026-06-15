import type { Metadata } from 'next'
import FrnView from '../components/FrnView'

export const metadata: Metadata = { title: 'FRN — runs émetteurs · CMF' }

export default function FrnPage() {
  return <FrnView />
}
