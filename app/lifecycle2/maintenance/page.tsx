import MaintenanceClients from '../components/MaintenanceClients'

export const metadata = { title: 'Maintenance clients — Lifecycle CMF' }

// Les fiches sont lues côté navigateur (/api/clients/fiches) : elles vivent dans
// le stockage KV, pas dans le dépôt, et doivent refléter l'instant présent.
export const dynamic = 'force-dynamic'

export default function MaintenancePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Maintenance clients</h1>
        <p className="text-[13px] text-slate-500">
          Identité, documents, rétrocession et abonnements au reporting. Ce qui est coché ici pilote
          directement l’agent d’envoi des relevés.
        </p>
      </div>
      <MaintenanceClients />
    </div>
  )
}
