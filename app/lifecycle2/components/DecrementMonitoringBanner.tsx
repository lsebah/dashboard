'use client'

import { useEffect, useState } from 'react'
import seed from '@/data/decrement-monitoring.json'
import type { MonitoringState } from '@/lib/decrement/types'

const STATUT_STYLE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rien: 'bg-slate-50 text-slate-600 border-slate-200',
  erreur: 'bg-red-50 text-red-700 border-red-200',
  'à configurer': 'bg-amber-50 text-amber-700 border-amber-200',
}
const dateFr = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—')

// Refresh attendu tous les 30 jours : on calcule l'ancienneté du dernier
// contrôle et on alerte quand les données dépassent la fenêtre.
const REFRESH_JOURS = 30
const joursDepuis = (iso: string | null): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

/** Dashboard de suivi de la veille « Décrément » (état live KV, fallback seed). */
export default function DecrementMonitoringBanner() {
  const [S, setS] = useState<MonitoringState>(seed as MonitoringState)

  useEffect(() => {
    let on = true
    fetch('/api/decrement/monitoring', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: MonitoringState) => {
        if (on && d) setS(d)
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])

  const style = STATUT_STYLE[S.statut] ?? STATUT_STYLE['rien']
  const age = joursDepuis(S.lastCheck)
  const perime = age != null && age >= REFRESH_JOURS
  return (
    <div className="mb-3 rounded-lg border border-[#e2e6ec] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat k="Dernière vérification" v={dateFr(S.lastCheck)} />
          <Stat k="Nouveaux produits" v={String(S.nouveaux)} />
          <Stat k="Mises à jour" v={String(S.majs)} />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Fraîcheur</div>
            <span
              className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                perime ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              title={`Refresh attendu tous les ${REFRESH_JOURS} jours`}
            >
              {age == null ? '—' : perime ? `à rafraîchir (${age} j)` : `à jour (${age} j)`}
            </span>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Statut</div>
            <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
              {S.statut}
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <div>Veille {S.frequence} · refresh {REFRESH_JOURS} j</div>
          <div>Dossier : {S.dossier ?? <span className="text-amber-600">à configurer</span>}</div>
        </div>
      </div>

      {perime && (
        <p className="mt-2 text-[12px] text-amber-700">
          ⚠ Données décrément vieilles de {age} jours (&gt; {REFRESH_JOURS} j) : relance la synchro des runs
          émetteurs pour rafraîchir les coupons et les indices.
        </p>
      )}

      {S.historique.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-slate-100 pt-2 text-[12px] text-slate-500">
          {S.historique
            .slice(-4)
            .reverse()
            .map((r, i) => (
              <li key={i}>
                • {dateFr(r.date)} — {r.nouveaux} nouveau(x), {r.majs} MAJ{r.details ? ` · ${r.details}` : ''}
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
