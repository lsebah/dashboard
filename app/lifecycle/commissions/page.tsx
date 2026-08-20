import { commissions } from '@/lib/commissions'
import { fiches } from '@/lib/fiches'
import { lignesAFacturer } from '@/lib/facturation'
import CommissionsView from '../components/CommissionsView'

// Les lignes « à facturer » se calculent côté serveur : elles dérivent du
// portefeuille entier, qu'il serait absurde d'embarquer dans le bundle client
// pour quelques dizaines de lignes.
export default function CommissionsPage() {
  return <CommissionsView data={commissions} aFacturer={lignesAFacturer(fiches)} />
}
