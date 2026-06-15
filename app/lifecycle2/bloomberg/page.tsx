import type { Metadata } from 'next'
import MarketTerminal from '../components/MarketTerminal'

export const metadata: Metadata = { title: 'Marchés — terminal · CMF' }

// Terminal marché temps réel (Lifecycle 2). La vue « Niveaux à extraire » reste
// disponible sur /lifecycle/bloomberg.
export default function Bloomberg2Page() {
  return <MarketTerminal />
}
