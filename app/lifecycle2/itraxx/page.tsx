import type { Metadata } from 'next'
import ItraxxView from '../components/ItraxxView'

export const metadata: Metadata = { title: 'iTraxx — tranches CLN · CMF' }

export default function ItraxxPage() {
  return <ItraxxView />
}
