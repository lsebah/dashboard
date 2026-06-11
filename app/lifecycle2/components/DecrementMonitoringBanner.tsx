import state from '@/data/decrement-monitoring.json'

interface Run {
  date: string
  nouveaux: number
  majs: number
  statut: string
  details?: string
}
interface MonitoringState {
  frequence: string
  dossier: string | null
  lastCheck: string | null
  statut: string
  nouveaux: number
  majs: number
  historique: Run[]
}

const S = state as MonitoringState

const STATUT_STYLE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rien: 'bg-slate-50 text-slate-600 border-slate-200',
  erreur: 'bg-red-50 text-red-700 border-red-200',
  'à configurer': 'bg-amber-50 text-amber-700 border-amber-200',
}
const dateFr = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—')

/** Dashboard de suivi de la veille « Décrément » (alimenté par l'agent quotidien). */
export default function DecrementMonitoringBanner() {
  const style = STATUT_STYLE[S.statut] ?? STATUT_STYLE['rien']
  return (
    <div className="mb-3 rounded-lg border border-[#e2e6ec] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat k="Dernière vérification" v={dateFr(S.lastCheck)} />
          <Stat k="Nouveaux produits" v={String(S.nouveaux)} />
          <Stat k="Mises à jour" v={String(S.majs)} />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Statut</div>
            <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
              {S.statut}
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <div>Veille {S.frequence}</div>
          <div>Dossier : {S.dossier ?? <span className="text-amber-600">à configurer</span>}</div>
        </div>
      </div>

      {S.historique.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[12px] text-slate-500">
          {S.historique.slice(-4).reverse().map((r, i) => (
            <li key={i}>
              • {dateFr(r.date)} — {r.nouveaux} nouveau(x), {r.majs} MAJ
              {r.details ? ` · ${r.details}` : ''}
            </li>
          ))}
        </ul>
      )}

      {!S.dossier && (
        <p className="mt-2 text-[12px] text-amber-700">
          ⚠ Surveillance non activée : indique la boîte mail + le chemin exact du dossier « Décrément »
          pour armer la veille quotidienne à 19h00.
        </p>
      )}
    </div>
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{k}</div>
      <div className="mt-0.5 font-semibold tabular-nums text-slate-800">{v}</div>
    </div>
  )
}
