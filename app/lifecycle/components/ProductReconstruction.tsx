import type { Product } from '@/lib/types'
import {
  echeancier,
  degressivite,
  scenariosMaturite,
  formatDateFr,
  type Scenario,
} from '@/lib/lifecycle'

const TON: Record<Scenario['ton'], string> = {
  positif: 'border-emerald-200 bg-emerald-50',
  neutre: 'border-slate-200 bg-slate-50',
  negatif: 'border-red-200 bg-red-50',
}
const TON_DOT: Record<Scenario['ton'], string> = {
  positif: 'bg-emerald-500',
  neutre: 'bg-slate-400',
  negatif: 'bg-red-500',
}

/** Mini-courbe SVG du barème de barrière d'autocall (montre la dégressivité). */
function BarriereCurve({ niveaux }: { niveaux: number[] }) {
  const w = 240
  const h = 56
  const pad = 6
  const min = Math.min(...niveaux) - 2
  const max = Math.max(...niveaux) + 2
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, niveaux.length - 1)
  const y = (v: number) => pad + ((max - v) * (h - 2 * pad)) / Math.max(1, max - min)
  const pts = niveaux.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#1d4ed8" strokeWidth={1.5} />
      {niveaux.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2} fill="#1d4ed8" />
      ))}
    </svg>
  )
}

/**
 * Carte « Reconstruction » — tout est dérivé des `terms` décodés de la termsheet
 * (rien de saisi à la main). Met en avant la dégressivité et les scénarios.
 */
export default function ProductReconstruction({ product }: { product: Product }) {
  const t = product.terms
  if (t?.kind !== 'autocall' || !(product.observations?.length)) {
    return (
      <div className="card p-4 text-xs text-slate-400">
        Reconstruction détaillée disponible une fois la termsheet décodée
        (mécanique + calendrier).
      </div>
    )
  }

  const lignes = echeancier(product)
  const degr = degressivite(product)
  const scenarios = scenariosMaturite(product)
  const niveaux = lignes
    .map((l) => l.niveauRappelPct)
    .filter((v): v is number => typeof v === 'number')

  const chips: string[] = [
    `Sens ${t.sens}`,
    `Protection ${t.protectionPct}% ${t.protectionStyle === 'europeenne' ? 'KIE' : 'KIA'}`,
  ]
  if (t.effetMemoire) chips.push('Effet mémoire')
  if (t.airbag) chips.push('Airbag')
  if (t.oxygene) chips.push('Oxygène')
  if (degr) chips.push('Barrière dégressive')
  if (t.bonusFinalPct) chips.push(`Bonus +${t.bonusFinalPct}%`)
  if (t.decrement) chips.push(`Décrément · ${t.decrement}`)

  return (
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-cmf-navy text-sm">Reconstruction (termsheet)</h3>
        <span className="text-[10px] text-slate-400">dérivé, non saisi</span>
      </div>

      {/* Paramètres décodés */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="badge">
            {c}
          </span>
        ))}
      </div>

      {/* Barème dégressif */}
      {degr && (
        <div>
          <div className="field-label mb-1">
            Barème d&apos;autocall — dégressif {degr.depart}% → {degr.fin}%
            <span className="text-slate-400"> (−{degr.pas.toFixed(2)} pt / observation)</span>
          </div>
          <BarriereCurve niveaux={niveaux} />
        </div>
      )}

      {/* Échéancier reconstruit */}
      <div>
        <div className="field-label mb-1">Échéancier reconstruit</div>
        <div className="max-h-56 overflow-y-auto rounded border border-slate-100">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 text-slate-500 sticky top-0">
              <tr>
                <th className="text-left font-medium px-2 py-1">#</th>
                <th className="text-left font-medium px-2 py-1">Observation</th>
                <th className="text-right font-medium px-2 py-1">Niveau rappel</th>
                <th className="text-right font-medium px-2 py-1">Remb. si rappelé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((l) => (
                <tr key={l.n} className={l.passe ? 'text-slate-400' : ''}>
                  <td className="px-2 py-1 tabular-nums">{l.n}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {formatDateFr(l.date)}
                    {!l.actif && (
                      <span className="ml-1 text-[9px] text-amber-600">oxygène</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {typeof l.niveauRappelPct === 'number' ? `${l.niveauRappelPct}%` : '—'}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {typeof l.remboursementPct === 'number'
                      ? `${l.remboursementPct.toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scénarios de dénouement */}
      <div>
        <div className="field-label mb-1.5">Scénarios de dénouement</div>
        <ul className="space-y-1.5">
          {scenarios.map((s) => (
            <li key={s.titre} className={`rounded-md border p-2 ${TON[s.ton]}`}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className={`w-1.5 h-1.5 rounded-full ${TON_DOT[s.ton]}`} />
                {s.titre}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Si {s.condition}</div>
              <div className="text-[11px] text-slate-700">→ {s.resultat}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
