'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  assureurs,
  dealsDeLaSemaine,
  dedoublonner,
  deviseDe,
  DEVISE_PAR_DEFAUT,
  enCommercialisation,
  type Deal,
} from '@/lib/deal-done'
import { codeEmetteur } from '@/lib/emetteurs'
import { dateFr, jourMois } from '@/lib/dates'
import { pourcent, insecable } from '@/lib/pourcentage'

// ─────────────────────────────────────────────────────────────────────────
//  Onglet DEAL DONE — les affaires annoncées par l'équipe (dossier Outlook
//  « DEAL DONE »). Même grammaire visuelle que le Portefeuille, mais ce ne
//  sont pas des positions : pas de P&L, pas de niveaux de sous-jacent, pas de
//  ticket mémoire. Le nom du produit et sa description portent l'information ;
//  tout le reste est optionnel et souvent absent du mail d'origine.
//
//  Largeurs FIXES + `table-fixed` : la grille doit tenir à l'écran sans jamais
//  partir vers la droite. C'est une contrainte de lecture, pas d'esthétique —
//  une colonne de plus se paie sur la description, qui est le cœur de la fiche.
// ─────────────────────────────────────────────────────────────────────────

const COLS = [
  { label: 'Date', w: 66 },
  { label: 'RR', w: 42 },
  // UF et Coupon : largeurs calées sur la valeur la PLUS LONGUE des données
  // (« 9,7008 % » côté coupon). Une insécable trop large pour sa colonne
  // déborderait au lieu de se couper — le remède serait pire que le mal.
  { label: 'UF', w: 62 },
  // La lettre de remise n'a plus de colonne : elle ne concerne qu'une poignée de
  // deals et la largeur profite à la description, qui la porte désormais.
  { label: 'Produit & description', w: 0 }, // flexible
  { label: 'Émetteur', w: 92 },
  { label: 'Dev', w: 40 },
  { label: 'Nominal', w: 96 },
  { label: 'Coupon', w: 78 },
  { label: 'AVF', w: 132 },
  { label: 'Prix', w: 54 },
  { label: 'Compartiment', w: 104 },
]

const RR_COULEUR: Record<string, string> = {
  LS: 'bg-slate-800 text-white',
  MH: 'bg-sky-100 text-sky-800',
  MM: 'bg-violet-100 text-violet-800',
  MEG: 'bg-emerald-100 text-emerald-800',
  PD: 'bg-amber-100 text-amber-800',
  TB: 'bg-rose-100 text-rose-800',
  ALM: 'bg-teal-100 text-teal-800',
  STA: 'bg-slate-100 text-slate-500',
  PRIX: 'bg-slate-100 text-slate-500',
}

const jour = (iso?: string) => dateFr(iso, '')
const jourCourt = (iso?: string) => jourMois(iso, '')
const pct = (v?: number) => pourcent(v)
// Espace fine insécable avant le symbole : « 315 000 $ » se coupait au même
// endroit que les pourcentages.
const SYMBOLE: Record<string, string> = { EUR: ' €', USD: ' $', GBP: ' £', CHF: ' CHF' }
const montant = (v?: number, devise?: string) =>
  typeof v === 'number'
    ? `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}${SYMBOLE[devise ?? ''] ?? ''}`
    : '—'

export default function DealDoneView({ deals: bruts, fenetre }: { deals: Deal[]; fenetre?: { du: string; au: string } }) {
  const [prix, setPrix] = useState<Record<string, number>>({})
  const [rr, setRr] = useState<string>('')
  const [avf, setAvf] = useState<string>('')
  const [q, setQ] = useState('')
  const [voirDoublons, setVoirDoublons] = useState(false)

  // Prix du run Bloomberg quotidien, par ISIN. La plupart des deals n'ont pas
  // encore d'ISIN au moment de l'annonce : la colonne reste vide, c'est normal.
  useEffect(() => {
    fetch('/api/prices', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.prices && typeof j.prices === 'object') setPrix(j.prices as Record<string, number>)
      })
      .catch(() => {
        /* la colonne Prix reste vide — jamais de prix inventé */
      })
  }, [])

  const { deals, doublons, aVerifier } = useMemo(() => dedoublonner(bruts), [bruts])

  const aujourdHui = useMemo(() => new Date(), [])
  const semaine = useMemo(() => dealsDeLaSemaine(deals, aujourdHui), [deals, aujourdHui])
  const ouverts = useMemo(() => enCommercialisation(deals, aujourdHui), [deals, aujourdHui])
  const listeAvf = useMemo(() => assureurs(deals), [deals])
  const listeRr = useMemo(
    () => Array.from(new Set(deals.map((d) => d.rr).filter(Boolean))) as string[],
    [deals],
  )

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase()
    return deals.filter((d) => {
      if (rr && d.rr !== rr) return false
      if (avf && !(d.avf ?? []).some((a) => a === avf)) return false
      if (t && ![d.produit, d.description, d.emetteur, d.isin].some((v) => (v ?? '').toLowerCase().includes(t)))
        return false
      return true
    })
  }, [deals, rr, avf, q])

  const totalNominalEur = filtres
    .filter((d) => deviseDe(d) === DEVISE_PAR_DEFAUT && typeof d.nominal === 'number')
    .reduce((s, d) => s + (d.nominal ?? 0), 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Bandeau de synthèse */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px]">
        <span className="rounded-full bg-cmf-navy px-2.5 py-1 font-semibold text-white">
          {semaine.length} deal{semaine.length > 1 ? 's' : ''} cette semaine
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
          {ouverts.length} en commercialisation
        </span>
        <span className="text-slate-500">
          {deals.length} deals au total
          {fenetre && <span className="text-slate-400"> · du {jour(fenetre.du)} au {jour(fenetre.au)}</span>}
        </span>
        {totalNominalEur > 0 && (
          <span className="ml-auto tabular-nums text-slate-500">
            Nominal EUR affiché : <strong className="text-slate-800">{montant(totalNominalEur, 'EUR')}</strong>
          </span>
        )}
      </div>

      {/* Doublons */}
      {(doublons.length > 0 || aVerifier.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
          <button onClick={() => setVoirDoublons((v) => !v)} className="font-medium underline">
            {doublons.length} doublon(s) écarté(s) · {aVerifier.length} à vérifier
          </button>
          {voirDoublons && (
            <ul className="mt-2 space-y-1">
              {doublons.map((d, i) => (
                <li key={`d${i}`}>
                  ✕ <strong>{d.ecarte.rr}</strong> « {d.ecarte.produit} » du {jour(d.ecarte.date)} — déjà annoncé par{' '}
                  <strong>{d.retenu.rr}</strong>
                </li>
              ))}
              {aVerifier.map((v, i) => (
                <li key={`v${i}`}>
                  ⚠ « {v.a.produit} » annoncé par <strong>{v.a.rr}</strong> et <strong>{v.b.rr}</strong> la même semaine,{' '}
                  {v.motif} — <em>non fusionnés</em>, à trancher
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit, un émetteur…"
          className="input max-w-[280px]"
        />
        <select value={rr} onChange={(e) => setRr(e.target.value)} className="input max-w-[120px]">
          <option value="">Tous les RR</option>
          {listeRr.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={avf} onChange={(e) => setAvf(e.target.value)} className="input max-w-[200px]">
          <option value="">Toutes les AVF</option>
          {listeAvf.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {(rr || avf || q) && (
          <button onClick={() => { setRr(''); setAvf(''); setQ('') }} className="text-[12px] text-slate-400 hover:text-slate-700">
            Réinitialiser
          </button>
        )}
        <span className="ml-auto text-[12px] text-slate-400">{filtres.length} affiché(s)</span>
      </div>

      {/* Grille */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            {COLS.map((c) => (
              <col key={c.label} style={c.w ? { width: c.w } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              {COLS.map((c) => (
                <th
                  key={c.label}
                  className={`px-2 py-2 font-medium ${['Nominal', 'Coupon', 'Prix', 'UF'].includes(c.label) ? 'text-right' : 'text-left'}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtres.map((d) => {
              const p = d.isin ? prix[d.isin] : undefined
              return (
                <tr key={d.id} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                  <td className="px-2 py-2 tabular-nums text-slate-600">{jour(d.date)}</td>
                  <td className="px-2 py-2">
                    {/* Sans RR (affaire reprise du registre) : un tiret, jamais
                        un commercial attribué au hasard. */}
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        (d.rr && RR_COULEUR[d.rr]) || 'bg-slate-100 text-slate-400'
                      }`}
                      title={d.rr ? undefined : 'Affaire reprise du registre des commissions — RR non renseigné'}
                    >
                      {d.rr ?? '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-medium text-slate-800">{pct(d.ufGlobal)}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-800">{d.produit}</div>
                    {d.description && (
                      <div className="mt-0.5 leading-snug text-slate-500">{insecable(d.description)}</div>
                    )}
                    {d.isin && <div className="mt-0.5 font-mono text-[11px] text-slate-400">{d.isin}</div>}
                  </td>
                  <td className="px-2 py-2 font-medium text-slate-700">{codeEmetteur(d.emetteur)}</td>
                  {/* Devise : EUR par défaut. Toute autre devise ressort en rouge italique —
                      c'est l'exception qui doit sauter aux yeux, pas la règle. */}
                  <td
                    className={`px-2 py-2 ${
                      deviseDe(d) === DEVISE_PAR_DEFAUT ? 'text-slate-600' : 'font-semibold italic text-red-600'
                    }`}
                  >
                    {deviseDe(d)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">{montant(d.nominal, deviseDe(d))}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-medium text-slate-800">{pct(d.coupon)}</td>
                  <td className="px-2 py-2">
                    {(d.avf ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {d.avf!.map((a) => (
                          <span key={a} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{a}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-800">
                    {typeof p === 'number' ? p.toFixed(2).replace('.', ',') : <span className="text-slate-300">—</span>}
                  </td>
                  {/* Compartiment — émission et fin de commercialisation, en rouge. */}
                  <td className="px-2 py-2 tabular-nums leading-snug">
                    {d.dateEmission && (
                      <div className="text-red-600">
                        Ém. <strong>{jourCourt(d.dateEmission)}</strong>
                      </div>
                    )}
                    {d.finCommercialisation && (
                      <div className="text-red-600">
                        Com. <strong>{jourCourt(d.finCommercialisation)}</strong>
                      </div>
                    )}
                    {!d.dateEmission && !d.finCommercialisation && <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              )
            })}
            {filtres.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-8 text-center text-slate-400">
                  Aucun deal ne correspond au filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Transcription littérale des mails du dossier Outlook « DEAL DONE » : un champ absent du mail reste vide,
        jamais reconstitué. La colonne Prix vient du run Bloomberg quotidien et n’est renseignée que pour les
        produits ayant déjà un ISIN — au moment de l’annonce, la termsheet est rarement disponible.
      </p>
    </div>
  )
}
