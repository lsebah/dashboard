'use client'
// ─────────────────────────────────────────────────────────────────────────
//  RADAR DE VOLATILITÉ — d'après l'outil « Volatility Radar » de Leonteq
//  (S. Noujaim, 27/08/2024).
//
//  On trace des TITRES, pas des indices. C'est la lecture d'origine et la
//  seule qui serve : le radar existe pour choisir une VALEUR sur laquelle
//  monter un autocall ou un participatif. L'indice n'est ici qu'un univers —
//  on le choisit, on ne le trace pas (Laurent, 20/08/2026).
//
//  LECTURE :
//   • ordonnée : niveau de volatilité ;
//   • abscisse : percentile — part du temps, sur douze mois, où la volatilité
//     était plus basse qu'aujourd'hui ;
//   • haut-droite : vol chère et au sommet de son année → candidats AUTOCALL ;
//   • bas-gauche : vol basse et au creux → candidats PARTICIPATIFS.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react'
import { quadrant, type PointRadar, type Quadrant } from '@/lib/volatilite'
import { INDICES_RADAR } from '@/lib/indices-radar'

interface Point extends PointRadar {
  poids?: number | null
}

interface ChargeComposants {
  genereLe?: string
  indice: { cle: string; nom: string }
  composition: {
    source: string
    majLe: string
    ageJours: number
    perimee: boolean
    total: number
    traces: number
    tronque: number
  } | null
  raison?: string
  volMediane: number
  points: Point[]
  indisponibles: { symbole: string; nom: string; raison: string }[]
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
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

// ── Le graphe ────────────────────────────────────────────────────────────
const W = 900
const H = 560
const M = { haut: 26, droite: 30, bas: 56, gauche: 64 }

/**
 * Nuage volatilité × percentile. Chaque point porte SON NOM : la planche part
 * en pièce jointe, et un point sans étiquette n'y sert à rien.
 */
function Radar({ points, volMediane }: { points: Point[]; volMediane: number }) {
  const vols = points.map((p) => p.vol)
  const volMax = Math.max(...vols, 1) * 1.12
  const volMin = Math.max(0, Math.min(...vols, volMediane) * 0.88)

  const x = (p: number) => M.gauche + (p / 100) * (W - M.gauche - M.droite)
  const y = (v: number) =>
    H - M.bas - ((v - volMin) / Math.max(volMax - volMin, 1e-9)) * (H - M.haut - M.bas)

  const yMediane = y(volMediane)
  const xMilieu = x(50)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Radar de volatilité">
      {/* Quadrants : le fond dit la conclusion avant même de lire les points. */}
      <rect
        x={xMilieu}
        y={M.haut}
        width={W - M.droite - xMilieu}
        height={Math.max(0, yMediane - M.haut)}
        fill="#ecfdf5"
      />
      <rect
        x={M.gauche}
        y={yMediane}
        width={xMilieu - M.gauche}
        height={Math.max(0, H - M.bas - yMediane)}
        fill="#f0f9ff"
      />

      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={x(p)} y1={M.haut} x2={x(p)} y2={H - M.bas} stroke="#e2e8f0" strokeWidth={1} />
          <text x={x(p)} y={H - M.bas + 18} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {p} %
          </text>
        </g>
      ))}
      <line
        x1={M.gauche}
        y1={yMediane}
        x2={W - M.droite}
        y2={yMediane}
        stroke="#94a3b8"
        strokeDasharray="4 4"
      />
      <text x={W - M.droite} y={yMediane - 6} textAnchor="end" className="fill-slate-400 text-[10px]">
        médiane {pct(volMediane, 1)}
      </text>

      <text x={xMilieu + 12} y={M.haut + 18} className="fill-emerald-700 text-[12px] font-medium">
        Autocall — vol chère, au sommet de son année
      </text>
      <text x={M.gauche + 12} y={H - M.bas - 10} className="fill-sky-700 text-[12px] font-medium">
        Participatif — vol basse, au creux
      </text>

      {points.map((p) => {
        const cx = x(p.percentile)
        const cy = y(p.vol)
        const q = quadrant(p, volMediane)
        const couleur = q === 'autocall' ? '#059669' : q === 'participatif' ? '#0284c7' : '#475569'
        // Étiquette à gauche du point quand il est trop à droite, pour qu'elle
        // ne sorte jamais du cadre à l'impression.
        const aGauche = cx > W - M.droite - 130
        return (
          <g key={p.cle}>
            <circle cx={cx} cy={cy} r={5} fill={couleur} />
            <text
              x={aGauche ? cx - 9 : cx + 9}
              y={cy - 5}
              textAnchor={aGauche ? 'end' : 'start'}
              className="fill-slate-800 text-[11px] font-semibold"
            >
              {p.nom}
            </text>
            <text
              x={aGauche ? cx - 9 : cx + 9}
              y={cy + 8}
              textAnchor={aGauche ? 'end' : 'start'}
              className="fill-slate-500 text-[10px]"
            >
              {pct(p.vol, 1)} · P{Math.round(p.percentile)}
            </text>
          </g>
        )
      })}

      <text
        transform={`translate(14 ${H / 2}) rotate(-90)`}
        textAnchor="middle"
        className="fill-slate-500 text-[12px]"
      >
        Volatilité réalisée annualisée
      </text>
      <text x={W / 2} y={H - 10} textAnchor="middle" className="fill-slate-500 text-[12px]">
        Percentile sur 12 mois — part du temps où la volatilité était plus basse qu’aujourd’hui
      </text>
    </svg>
  )
}

/** Une planche : le radar d'un univers, avec son entête — l'unité imprimée. */
function Planche({ c }: { c: ChargeComposants }) {
  return (
    <section className="flex break-inside-avoid flex-col gap-2">
      <h2 className="text-[15px] font-semibold text-cmf-navy">{c.indice.nom}</h2>

      {c.composition == null ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
          <strong>Composition non disponible</strong> —{' '}
          {c.raison ??
            'le job mensuel « Rafraîchit les membres des indices » ne l’a pas encore écrite.'}{' '}
          Rien n’est tracé plutôt qu’un univers inventé.
        </div>
      ) : (
        <>
          <p className="text-[12px] text-slate-500">
            {c.composition.traces} titre(s) tracé(s) sur {c.composition.total}
            {c.composition.tronque > 0 && (
              <>
                {' '}
                — <strong>{c.composition.tronque} hors du graphe</strong>, les plus faibles
                pondérations
              </>
            )}
            . Composition : {c.composition.source}, relevée le{' '}
            {c.composition.majLe ? dateFr(c.composition.majLe) : '—'}
            {c.composition.perimee && (
              <strong className="text-red-700"> — périmée, à rafraîchir</strong>
            )}
            .
          </p>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Radar points={c.points} volMediane={c.volMediane} />
          </div>

          {c.indisponibles.length > 0 && (
            <p className="text-[11px] text-red-700">
              {c.indisponibles.length} titre(s) sans historique, absents du graphe :{' '}
              {c.indisponibles.map((i) => i.symbole).join(', ')}
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default function VolatiliteRadar() {
  const [selection, setSelection] = useState<string>(INDICES_RADAR[0]?.cle ?? '')
  const [charges, setCharges] = useState<Record<string, ChargeComposants>>({})
  const [enCours, setEnCours] = useState<Set<string>>(new Set())
  const [toutCharger, setToutCharger] = useState(false)

  // Les univers à charger : celui qu'on regarde, ou tous quand on prépare la
  // planche mensuelle. Chaque titre coûte un historique — on ne les récupère
  // donc pas « au cas où ».
  const aCharger = useMemo(
    () => (toutCharger ? INDICES_RADAR.map((i) => i.cle) : selection ? [selection] : []),
    [toutCharger, selection],
  )

  useEffect(() => {
    let vivant = true
    for (const cle of aCharger) {
      if (charges[cle] || enCours.has(cle)) continue
      setEnCours((s) => new Set(s).add(cle))
      fetch(`/api/lifecycle/volatilite/composants?indice=${encodeURIComponent(cle)}`, {
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => vivant && setCharges((c) => ({ ...c, [cle]: j as ChargeComposants })))
        .catch(() => {
          if (!vivant) return
          const idx = INDICES_RADAR.find((i) => i.cle === cle)
          setCharges((c) => ({
            ...c,
            [cle]: {
              indice: { cle, nom: idx?.nom ?? cle },
              composition: null,
              raison: 'les cotations n’ont pas répondu.',
              volMediane: 0,
              points: [],
              indisponibles: [],
            },
          }))
        })
        .finally(() => {
          if (!vivant) return
          setEnCours((s) => {
            const n = new Set(s)
            n.delete(cle)
            return n
          })
        })
    }
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aCharger])

  const imprimer = useCallback(() => window.print(), [])

  const courant = charges[selection]
  const pretPourImpression = INDICES_RADAR.every((i) => charges[i.cle])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <p className="max-w-3xl text-[13px] text-slate-500">
          Les <strong>titres</strong> d’un indice, placés par leur volatilité et par son percentile
          sur douze mois. Choisissez l’univers ci-dessous.
        </p>
        <div className="flex items-center gap-2">
          {!toutCharger && (
            <button
              onClick={() => setToutCharger(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="Charge tous les univers pour imprimer la planche complète"
            >
              Charger tous les indices
            </button>
          )}
          <button
            onClick={imprimer}
            className="rounded-md bg-cmf-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0b1d36]"
          >
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Avertissement de mesure — il DOIT rester sur la version imprimée. */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
        <strong>Volatilité réalisée</strong>, calculée sur les clôtures quotidiennes. L’outil
        d’origine lit une volatilité <em>implicite</em> ATM 6 mois (Bloomberg), qui n’est disponible
        dans aucune source publique : la réalisée dit ce que le marché a fait, l’implicite ce qu’il
        anticipe. La lecture du radar est la même, la grandeur ne l’est pas.
      </div>

      {/* Sélecteur d'univers — l'indice se choisit, il ne se trace pas. */}
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        {INDICES_RADAR.map((i) => (
          <button
            key={i.cle}
            onClick={() => setSelection(i.cle)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              selection === i.cle
                ? 'bg-cmf-navy text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {i.nom}
          </button>
        ))}
      </div>

      {/* À l'écran : l'univers choisi. */}
      <div className="print:hidden">
        {enCours.has(selection) && !courant ? (
          <div className="text-sm text-slate-500">Chargement des titres…</div>
        ) : courant ? (
          <Planche c={courant} />
        ) : null}
      </div>

      {/* À l'impression : toutes les planches chargées, une par univers. */}
      <div className="hidden flex-col gap-6 print:flex">
        {INDICES_RADAR.map((i) => charges[i.cle])
          .filter((c): c is ChargeComposants => !!c)
          .map((c) => (
            <Planche key={c.indice.cle} c={c} />
          ))}
      </div>

      {toutCharger && !pretPourImpression && (
        <p className="text-[12px] text-slate-500 print:hidden">
          Chargement des autres univers en cours — attendez qu’ils soient tous là avant d’imprimer,
          sinon la planche partira incomplète.
        </p>
      )}

      {/* Tableau des titres de l'univers affiché. */}
      {courant?.composition && courant.points.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 print:hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['Titre', 'Vol. réalisée', 'Percentile 12 m', 'Perf. 12 m', 'Poids', 'Lecture'].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[...courant.points]
                .sort((a, b) => b.percentile - a.percentile)
                .map((p) => {
                  const q = quadrant(p, courant.volMediane)
                  return (
                    <tr key={p.cle} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium">
                        {p.nom} <span className="font-mono text-[11px] text-slate-400">{p.cle}</span>
                      </td>
                      <td className="px-3 py-1.5 tabular-nums font-semibold">{pct(p.vol, 2)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{pct(p.percentile)}</td>
                      <td
                        className={`px-3 py-1.5 tabular-nums ${(p.perf12m ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {p.perf12m == null ? '—' : pct(p.perf12m)}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-slate-500">
                        {typeof p.poids === 'number' ? pct(p.poids, 2) : '—'}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${QUADRANT_CLS[q]}`}
                        >
                          {QUADRANT_LABEL[q]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Cotations Yahoo Finance. Composition des indices rafraîchie mensuellement depuis les sources
        publiques citées sur chaque planche. D’après l’outil « Volatility Radar » de Leonteq
        (S. Noujaim, 27/08/2024).
      </p>
    </div>
  )
}
