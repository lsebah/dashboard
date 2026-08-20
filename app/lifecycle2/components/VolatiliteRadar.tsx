'use client'
// ─────────────────────────────────────────────────────────────────────────
//  RADAR DE VOLATILITÉ — reprise de l'outil Leonteq (note de S. Noujaim du
//  27/08/2024), sans Bloomberg.
//
//  Ordonnée : niveau de volatilité. Abscisse : percentile sur douze mois —
//  part du temps où la volatilité était plus basse qu'aujourd'hui. Haut à
//  droite : candidats AUTOCALL (vol chère, au sommet de son année). Bas à
//  gauche : candidats PARTICIPATIFS (vol basse, au creux).
//
//  Les noms des indices sont TOUJOURS écrits dans le graphe, jamais seulement
//  en légende : la planche part en PDF chez des clients, où une couleur sans
//  étiquette ne se lit pas.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import { quadrant, type PointRadar, type Quadrant } from '@/lib/volatilite'

interface Point extends PointRadar {
  devise: string
}

interface Charge {
  genereLe: string
  mesure: string
  fenetreJours: number
  fenetrePercentileJours: number
  volMediane: number
  points: Point[]
  indisponibles: { cle: string; nom: string; symbole: string; raison: string }[]
}

const QUADRANT_LABEL: Record<Quadrant, string> = {
  autocall: 'Autocall',
  participatif: 'Participatif',
  neutre: 'Neutre',
}
const QUADRANT_CLS: Record<Quadrant, string> = {
  autocall: 'bg-emerald-100 text-emerald-800',
  participatif: 'bg-sky-100 text-sky-800',
  neutre: 'bg-slate-100 text-slate-600',
}

const pct = (v: number, d = 1) => `${v.toFixed(d).replace('.', ',')} %`
const niveau = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

// ── Le graphe ────────────────────────────────────────────────────────────
const W = 860
const H = 520
const M = { haut: 24, droite: 28, bas: 54, gauche: 62 }

function Radar({
  points,
  volMediane,
  selection,
  onSelect,
}: {
  points: Point[]
  volMediane: number
  selection: string | null
  onSelect: (cle: string) => void
}) {
  const vols = points.map((p) => p.vol)
  const volMax = Math.max(...vols, volMediane) * 1.18
  const volMin = Math.max(0, Math.min(...vols) * 0.82)

  const x = (percentile: number) => M.gauche + (percentile / 100) * (W - M.gauche - M.droite)
  const y = (vol: number) =>
    H - M.bas - ((vol - volMin) / (volMax - volMin || 1)) * (H - M.haut - M.bas)

  const xMed = x(50)
  const yMed = y(volMediane)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Radar de volatilité">
      {/* Quadrants : seuls les deux coins « actionnables » sont teintés. */}
      <rect x={xMed} y={M.haut} width={W - M.droite - xMed} height={yMed - M.haut} fill="#ecfdf5" />
      <rect x={M.gauche} y={yMed} width={xMed - M.gauche} height={H - M.bas - yMed} fill="#f0f9ff" />

      <text x={W - M.droite - 8} y={M.haut + 18} textAnchor="end" className="fill-emerald-700" fontSize="12" fontWeight="600">
        Autocall — vol chère, au sommet de son année
      </text>
      <text x={M.gauche + 8} y={H - M.bas - 8} className="fill-sky-700" fontSize="12" fontWeight="600">
        Participatif — vol basse, au creux
      </text>

      {/* Grille */}
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={x(p)} y1={M.haut} x2={x(p)} y2={H - M.bas} stroke="#e2e8f0" strokeWidth={p === 50 ? 1.5 : 1} strokeDasharray={p === 50 ? '4 3' : undefined} />
          <text x={x(p)} y={H - M.bas + 18} textAnchor="middle" fontSize="11" className="fill-slate-500">
            {p} %
          </text>
        </g>
      ))}
      <line x1={M.gauche} y1={yMed} x2={W - M.droite} y2={yMed} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={W - M.droite} y={yMed - 6} textAnchor="end" fontSize="10" className="fill-slate-500">
        médiane {pct(volMediane)}
      </text>

      {/* Axes */}
      <line x1={M.gauche} y1={M.haut} x2={M.gauche} y2={H - M.bas} stroke="#334155" />
      <line x1={M.gauche} y1={H - M.bas} x2={W - M.droite} y2={H - M.bas} stroke="#334155" />
      <text x={W / 2} y={H - 12} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-slate-700">
        Percentile sur 12 mois — part du temps où la volatilité était plus basse qu’aujourd’hui
      </text>
      <text x={16} y={H / 2} textAnchor="middle" fontSize="12" fontWeight="600" transform={`rotate(-90 16 ${H / 2})`} className="fill-slate-700">
        Volatilité réalisée annualisée
      </text>

      {/* Points — étiquette toujours écrite, décalée pour ne pas mordre le bord. */}
      {points.map((p) => {
        const cx = x(p.percentile)
        const cy = y(p.vol)
        const q = quadrant(p, volMediane)
        const couleur = q === 'autocall' ? '#059669' : q === 'participatif' ? '#0284c7' : '#475569'
        const aGauche = cx > W - M.droite - 130
        const actif = selection === p.cle
        return (
          <g key={p.cle} onClick={() => onSelect(p.cle)} className="cursor-pointer">
            {actif && <circle cx={cx} cy={cy} r={13} fill={couleur} opacity={0.18} />}
            <circle cx={cx} cy={cy} r={actif ? 7 : 5.5} fill={couleur} stroke="#fff" strokeWidth={1.5} />
            <text
              x={aGauche ? cx - 11 : cx + 11}
              y={cy - 9}
              textAnchor={aGauche ? 'end' : 'start'}
              fontSize="12.5"
              fontWeight="700"
              className="fill-slate-900"
            >
              {p.nom}
            </text>
            <text
              x={aGauche ? cx - 11 : cx + 11}
              y={cy + 6}
              textAnchor={aGauche ? 'end' : 'start'}
              fontSize="11"
              className="fill-slate-600"
            >
              {pct(p.vol)} · P{Math.round(p.percentile)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Fiche d'un indice ────────────────────────────────────────────────────
function FicheIndice({ p, volMediane }: { p: Point; volMediane: number }) {
  const q = quadrant(p, volMediane)
  return (
    <div className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-cmf-navy">{p.nom}</div>
          <div className="text-[11px] text-slate-500">
            {niveau(p.dernierNiveau)} {p.devise} au {dateFr(p.dateNiveau)}
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${QUADRANT_CLS[q]}`}>
          {QUADRANT_LABEL[q]}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        <dt className="text-slate-500">Volatilité réalisée</dt>
        <dd className="tabular-nums font-semibold">{pct(p.vol, 2)}</dd>
        <dt className="text-slate-500">Percentile 12 mois</dt>
        <dd className="tabular-nums font-semibold">{pct(p.percentile)}</dd>
        <dt className="text-slate-500">Performance 12 mois</dt>
        <dd className="tabular-nums">{p.perf12m == null ? '—' : pct(p.perf12m)}</dd>
        {p.implicite && (
          <>
            <dt className="text-slate-500">
              {p.implicite.nom} <span className="text-slate-400">({p.implicite.horizonJours} j)</span>
            </dt>
            <dd className="tabular-nums">{pct(p.implicite.valeur, 2)}</dd>
          </>
        )}
      </dl>
      <p className="mt-2 text-[11px] text-slate-400">
        Percentile calculé sur {p.observations} observations.
      </p>
    </div>
  )
}

export default function VolatiliteRadar() {
  const [data, setData] = useState<Charge | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [selection, setSelection] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    fetch('/api/lifecycle/volatilite', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => vivant && setData(j as Charge))
      .catch((e) => vivant && setErreur((e as Error).message))
    return () => {
      vivant = false
    }
  }, [])

  const imprimer = useCallback(() => window.print(), [])

  const selectionne = useMemo(
    () => data?.points.find((p) => p.cle === selection) ?? null,
    [data, selection],
  )

  if (erreur)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Radar indisponible — {erreur}. Aucune volatilité n’est affichée plutôt qu’une valeur périmée.
      </div>
    )
  if (!data) return <div className="text-sm text-slate-500">Chargement des cotations…</div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="max-w-3xl text-[13px] text-slate-500">
          Volatilité <strong>réalisée</strong> annualisée sur {data.fenetreJours} séances, et son
          percentile sur {data.fenetrePercentileJours} séances. Cliquez un indice pour sa fiche.
        </p>
        <button
          onClick={imprimer}
          className="rounded-md bg-cmf-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0b1d36]"
        >
          Imprimer / PDF
        </button>
      </div>

      {/* Avertissement de mesure — il DOIT rester sur la version imprimée. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
        <strong>Volatilité réalisée</strong>, calculée sur les clôtures quotidiennes. L’outil
        d’origine lit une volatilité <em>implicite</em> ATM 6 mois (Bloomberg), qui n’est disponible
        dans aucune source publique : la réalisée dit ce que le marché a fait, l’implicite ce qu’il
        anticipe. La lecture du radar est la même, la grandeur ne l’est pas.
      </div>

      {data.indisponibles.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-900">
          <strong>{data.indisponibles.length} indice(s) absent(s) du radar</strong> — un univers
          amputé qui se tait ferait croire qu’il est complet.
          <ul className="mt-1 space-y-0.5">
            {data.indisponibles.map((i) => (
              <li key={i.cle}>
                {i.nom} <span className="font-mono text-[11px]">({i.symbole})</span> — {i.raison}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <Radar
          points={data.points}
          volMediane={data.volMediane}
          selection={selection}
          onSelect={(c) => setSelection((s) => (s === c ? null : c))}
        />
      </div>

      {/* La fiche cliquée à l'écran ; toutes les fiches à l'impression, pour que
          la planche mensuelle parte complète sans manipulation. */}
      {selectionne && (
        <div className="print:hidden">
          <FicheIndice p={selectionne} volMediane={data.volMediane} />
        </div>
      )}
      <div className="hidden grid-cols-2 gap-3 print:grid">
        {data.points.map((p) => (
          <FicheIndice key={p.cle} p={p} volMediane={data.volMediane} />
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 print:hidden">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['Indice', 'Niveau', 'Vol. réalisée', 'Percentile 12 m', 'Perf. 12 m', 'Implicite', 'Lecture'].map(
                (h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.points.map((p) => {
              const q = quadrant(p, data.volMediane)
              return (
                <tr
                  key={p.cle}
                  onClick={() => setSelection((s) => (s === p.cle ? null : p.cle))}
                  className={`cursor-pointer border-t border-slate-100 ${selection === p.cle ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-3 py-1.5 font-medium">{p.nom}</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {niveau(p.dernierNiveau)} {p.devise}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums font-semibold">{pct(p.vol, 2)}</td>
                  <td className="px-3 py-1.5 tabular-nums">{pct(p.percentile)}</td>
                  <td className={`px-3 py-1.5 tabular-nums ${(p.perf12m ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {p.perf12m == null ? '—' : pct(p.perf12m)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-slate-500">
                    {p.implicite ? `${p.implicite.nom} ${pct(p.implicite.valeur, 1)}` : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${QUADRANT_CLS[q]}`}>
                      {QUADRANT_LABEL[q]}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Cotations Yahoo Finance, relevées le {dateFr(data.genereLe)}. D’après l’outil « Volatility
        Radar » de Leonteq (S. Noujaim, 27/08/2024).
      </p>
    </div>
  )
}
