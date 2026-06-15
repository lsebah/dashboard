import { products } from '@/lib/products'
import CmfTerminal from './components/CmfTerminal'

// Espace CMF — terminal financier (gestion & suivi du portefeuille structuré).
export default function CmfSpacePage() {
  return <CmfTerminal products={products} />
}
