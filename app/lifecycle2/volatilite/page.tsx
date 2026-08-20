import VolatiliteRadar from '../components/VolatiliteRadar'

export const metadata = { title: 'Volatilité — Lifecycle CMF' }

// Les cotations sont relevées à la demande : figer un radar au build reviendrait
// à distribuer une photo de volatilité vieille du dernier déploiement.
export const dynamic = 'force-dynamic'

export default function VolatilitePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Radar de volatilité</h1>
        <p className="text-[13px] text-slate-500">
          Où se situe la volatilité de chaque grand indice, en niveau et par rapport à sa propre
          année — pour choisir entre vendre de la vol (autocall) et en acheter (participatif).
        </p>
      </div>
      <VolatiliteRadar />
    </div>
  )
}
