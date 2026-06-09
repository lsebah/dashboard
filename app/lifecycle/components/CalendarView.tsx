'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Product, Observation } from '@/lib/types'
import { formatDateFr, formatPct, formatMontant } from '@/lib/lifecycle'
import { useAugmentedProduct } from '@/lib/useProductLevels'
import ProductSynopsis from './ProductSynopsis'
import ProductReconstruction from './ProductReconstruction'
import Modal from './Modal'

type Filtre = 'toutes' | 'maturite' | 'autocall' | 'coupon'

interface Ev {
  product: Product
  obs: Observation
  date: string // YYYY-MM-DD (dateObservation)
  maturite: boolean
  coupon: boolean
  autocallActif: boolean
}

// ─── Helpers dates ───────────────────────────────────────────────────────
const J = (d: Date) => d.toISOString().slice(0, 10)
function lundi(d: Date): Date {
  const x = new Date(d)
  const j = (x.getDay() + 6) % 7 // 0 = lundi
  x.setDate(x.getDate() - j)
  x.setHours(0, 0, 0, 0)
  return x
}
function addJours(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function addMois(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}
const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const labelJour = (d: Date) => `${JOURS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MOIS[d.getMonth()]}`

// Ticker court d'un sous-jacent (depuis le code Bloomberg ou le nom).
function shortU(p: Product): string {
  if (p.terms?.kind === 'rates') return p.terms.tauxReference ?? 'taux'
  const u = p.sousJacents[0]
  if (!u) return p.productType ?? p.isin.slice(0, 6)
  const t = (u.bloomberg?.split(' ')[0] || u.nom?.split(' ')[0] || '').toUpperCase()
  return p.sousJacents.length > 1 ? `${t}+${p.sousJacents.length - 1}` : t
}

export default function CalendarView({ products }: { products: Product[] }) {
  const today = J(new Date())
  const [mode, setMode] = useState<'hebdo' | 'mensuel'>('hebdo')
  const [ancre, setAncre] = useState<Date>(() => lundi(new Date()))
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [selId, setSelId] = useState<string | null>(null)
  const [openDetail, setOpenDetail] = useState(false)
  const [courant, setCourant] = useState<Record<string, number | null>>({})

  // Tous les événements (toutes dates, passées ET futures) issus des calendriers décodés.
  const events = useMemo<Ev[]>(() => {
    const out: Ev[] = []
    for (const p of products) {
      const obs = p.observations ?? []
      const lastN = obs.reduce((m, o) => Math.max(m, o.n), 0)
      for (const o of obs) {
        if (!o.dateObservation) continue
        out.push({
          product: p,
          obs: o,
          date: o.dateObservation,
          maturite: o.n === lastN || o.dateObservation === p.dateConstatationFinale,
          coupon: typeof o.couponPct === 'number' && o.couponPct > 0,
          autocallActif: o.autocallActif !== false && typeof o.niveauRappelPct === 'number',
        })
      }
    }
    return out
  }, [products])

  // Niveaux courants (worst-of) — un seul appel batché pour tous les produits.
  useEffect(() => {
    const isins = Array.from(new Set(products.map((p) => p.isin)))
    if (isins.length === 0) return
    let annule = false
    fetch(`/api/lifecycle/courant?isins=${encodeURIComponent(isins.join(','))}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return
        const m: Record<string, number | null> = {}
        for (const [isin, v] of Object.entries(d?.courant ?? {}))
          m[isin] = (v as { worstOf: number | null }).worstOf
        setCourant(m)
      })
      .catch(() => {})
    return () => {
      annule = true
    }
  }, [products])

  // Autocall probable : worst-of courant vs barrière de rappel (inverse-aware).
  const estAutocallProbable = (e: Ev): boolean => {
    if (!e.autocallActif) return false
    const wo = courant[e.product.isin]
    const barr = e.obs.niveauRappelPct
    if (typeof wo !== 'number' || typeof barr !== 'number') return false
    const inverse = e.product.terms?.kind === 'autocall' && e.product.terms.sens === 'inverse'
    return inverse ? wo <= barr : wo >= barr
  }

  // Bornes de la période visible.
  const [debut, fin, titrePeriode] = useMemo<[Date, Date, string]>(() => {
    if (mode === 'hebdo') {
      const d = lundi(ancre)
      const f = addJours(d, 6)
      const t = `${d.getDate()} ${MOIS[d.getMonth()]} – ${f.getDate()} ${MOIS[f.getMonth()]}`
      return [d, f, t]
    }
    const d = new Date(ancre.getFullYear(), ancre.getMonth(), 1)
    const f = new Date(ancre.getFullYear(), ancre.getMonth() + 1, 0)
    return [d, f, `${MOIS[d.getMonth()]} ${d.getFullYear()}`]
  }, [ancre, mode])

  const dInt = J(debut)
  const fInt = J(fin)
  const enVue = useMemo(() => events.filter((e) => e.date >= dInt && e.date <= fInt), [events, dInt, fInt])

  const matche = (e: Ev): boolean => {
    if (filtre === 'maturite') return e.maturite
    if (filtre === 'autocall') return estAutocallProbable(e)
    if (filtre === 'coupon') return e.coupon
    return true
  }
  const compte = (f: Filtre) =>
    enVue.filter((e) => (f === 'maturite' ? e.maturite : f === 'autocall' ? estAutocallProbable(e) : f === 'coupon' ? e.coupon : true)).length

  const affiches = useMemo(
    () => enVue.filter(matche).sort((a, b) => a.date.localeCompare(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enVue, filtre, courant],
  )

  // Sélection produit pour le synopsis (auto : 1er événement visible).
  useEffect(() => {
    if (affiches.length && !affiches.some((e) => e.product.id === selId)) setSelId(affiches[0].product.id)
  }, [affiches, selId])
  const sel = selId ? products.find((p) => p.id === selId) ?? null : null
  const selAug = useAugmentedProduct(sel)

  // Couleur / icône d'un événement.
  function aspect(e: Ev): { cls: string; icone: string; titre: string } {
    const passe = e.date < today
    if (e.maturite) return { cls: 'bg-amber-50 border-amber-300', icone: '⚑', titre: 'Maturité' }
    if (estAutocallProbable(e)) return { cls: 'bg-emerald-50 border-emerald-300', icone: '↑', titre: 'Autocall probable' }
    if (e.coupon) return { cls: 'bg-sky-50 border-sky-200', icone: '✓', titre: 'Paiement de coupon' }
    return { cls: passe ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200', icone: '🕑', titre: 'Observation' }
  }

  function Carte({ e }: { e: Ev }) {
    const a = aspect(e)
    const wo = courant[e.product.isin]
    return (
      <button
        onClick={() => setSelId(e.product.id)}
        className={`w-full text-left rounded-md border px-2 py-1.5 hover:ring-1 hover:ring-cmf-blue/40 ${a.cls} ${
          selId === e.product.id ? 'ring-1 ring-cmf-blue' : ''
        }`}
        title={`${e.product.nom} · ${a.titre}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-slate-700 truncate">
            {formatMontant(e.product.nominal, e.product.devise)}
          </span>
          <span className="text-[10px]" title={a.titre}>{a.icone}</span>
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          {shortU(e.product)}
          {typeof wo === 'number' && <span className="tabular-nums"> ({wo.toFixed(2)}%)</span>}
        </div>
      </button>
    )
  }

  // Colonnes (hebdo = lun→ven ; mensuel = grille de semaines).
  const joursHebdo = Array.from({ length: 5 }, (_, i) => addJours(debut, i))
  const parDate = useMemo(() => {
    const m = new Map<string, Ev[]>()
    for (const e of affiches) {
      // week-end → rattaché au vendredi en vue hebdo
      let key = e.date
      if (mode === 'hebdo') {
        const dd = new Date(e.date)
        const j = (dd.getDay() + 6) % 7
        if (j > 4) key = J(addJours(dd, -(j - 4)))
      }
      ;(m.get(key) ?? m.set(key, []).get(key)!).push(e)
    }
    return m
  }, [affiches, mode])

  // Grille mensuelle : semaines (lignes) × lun→dim.
  const semainesMois = useMemo(() => {
    if (mode !== 'mensuel') return []
    const out: Date[][] = []
    let cur = lundi(debut)
    const stop = addJours(fin, 7)
    while (cur < stop) {
      out.push(Array.from({ length: 7 }, (_, i) => addJours(cur, i)))
      cur = addJours(cur, 7)
    }
    return out
  }, [mode, debut, fin])

  const FILTRES: { k: Filtre; label: string; icone: string }[] = [
    { k: 'toutes', label: 'Toutes les observations', icone: '◉' },
    { k: 'maturite', label: 'Arrivant à maturité', icone: '⚑' },
    { k: 'autocall', label: 'Autocall probable', icone: '↑' },
    { k: 'coupon', label: 'Paiement de coupon', icone: '✓' },
  ]

  const goPrev = () => setAncre((a) => (mode === 'hebdo' ? addJours(a, -7) : addMois(a, -1)))
  const goNext = () => setAncre((a) => (mode === 'hebdo' ? addJours(a, 7) : addMois(a, 1)))
  const goToday = () => setAncre(mode === 'hebdo' ? lundi(new Date()) : new Date())

  return (
    <div className="flex flex-col h-[calc(100vh_-_9rem)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <h1 className="text-2xl font-bold text-cmf-navy">Calendrier des observations</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1 py-0.5">
            <button onClick={goPrev} className="px-2 py-1 text-slate-500 hover:text-cmf-navy" title="Période précédente">‹</button>
            <span className="min-w-[150px] text-center text-sm font-medium text-slate-700">{titrePeriode}</span>
            <button onClick={goNext} className="px-2 py-1 text-slate-500 hover:text-cmf-navy" title="Période suivante">›</button>
          </div>
          <button onClick={goToday} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Aujourd&apos;hui</button>
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
            <button onClick={() => setMode('hebdo')} className={`px-3 py-1.5 ${mode === 'hebdo' ? 'bg-cmf-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Hebdomadaire</button>
            <button onClick={() => setMode('mensuel')} className={`px-3 py-1.5 ${mode === 'mensuel' ? 'bg-cmf-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Mensuel</button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        {/* Calendrier (rail filtres + jours) */}
        <div className="card flex-1 min-w-0 flex overflow-hidden">
          {/* Rail de filtres */}
          <aside className="w-[180px] shrink-0 border-r border-slate-100 p-3 flex flex-col gap-2 overflow-y-auto">
            {FILTRES.map((f) => (
              <button
                key={f.k}
                onClick={() => setFiltre(f.k)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  filtre === f.k ? 'border-cmf-blue bg-cmf-blue/5' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={filtre === f.k ? 'text-cmf-blue' : 'text-slate-400'}>{f.icone}</span>
                  <span className="text-2xl font-bold text-cmf-navy tabular-nums">{compte(f.k)}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5 leading-tight">{f.label}</div>
              </button>
            ))}
          </aside>

          {/* Jours */}
          <div className="flex-1 min-w-0 overflow-auto p-2">
            {mode === 'hebdo' ? (
              <div className="grid grid-cols-5 gap-2 h-full">
                {joursHebdo.map((d) => {
                  const evs = parDate.get(J(d)) ?? []
                  const estAuj = J(d) === today
                  return (
                    <div key={J(d)} className="flex flex-col min-w-0">
                      <div className={`flex items-center justify-between rounded-t-md px-2 py-1.5 text-xs font-medium ${estAuj ? 'bg-cmf-blue text-white' : 'bg-slate-700 text-white'}`}>
                        <span>{labelJour(d)}</span>
                        <span className="rounded bg-white/20 px-1.5 text-[10px]">{evs.length}</span>
                      </div>
                      <div className="flex-1 rounded-b-md bg-slate-50/60 p-1.5 flex flex-col gap-1.5 overflow-y-auto min-h-[120px]">
                        {evs.map((e, i) => <Carte key={`${e.product.id}-${e.obs.n}-${i}`} e={e} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-slate-400 px-1">
                  {JOURS.map((j) => <div key={j} className="text-center">{j}</div>)}
                </div>
                {semainesMois.map((sem, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {sem.map((d) => {
                      const evs = (parDate.get(J(d)) ?? [])
                      const horsMois = d.getMonth() !== debut.getMonth()
                      const estAuj = J(d) === today
                      return (
                        <div key={J(d)} className={`rounded border min-h-[78px] p-1 ${horsMois ? 'bg-slate-50/40 border-slate-100' : 'bg-white border-slate-200'}`}>
                          <div className={`text-[10px] mb-0.5 ${estAuj ? 'font-bold text-cmf-blue' : horsMois ? 'text-slate-300' : 'text-slate-500'}`}>{d.getDate()}</div>
                          <div className="flex flex-col gap-0.5">
                            {evs.slice(0, 3).map((e, i) => {
                              const a = aspect(e)
                              return (
                                <button key={i} onClick={() => setSelId(e.product.id)} title={`${e.product.nom} · ${a.titre}`}
                                  className={`truncate rounded px-1 text-[9px] border ${a.cls} ${selId === e.product.id ? 'ring-1 ring-cmf-blue' : ''}`}>
                                  {a.icone} {shortU(e.product)}
                                </button>
                              )
                            })}
                            {evs.length > 3 && <span className="text-[9px] text-slate-400 px-1">+{evs.length - 3}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Synopsis produit */}
        <div className="w-[380px] shrink-0 overflow-y-auto">
          {selAug ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Synopsis produit</h2>
                <button onClick={() => setOpenDetail(true)} className="text-xs text-cmf-blue hover:underline">Détail ↗</button>
              </div>
              <ProductSynopsis product={selAug} />
            </div>
          ) : (
            <div className="card p-6 text-center text-sm text-slate-400">
              Clique une observation pour afficher le synopsis du produit.
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-2 shrink-0">
        {enVue.length} observation{enVue.length > 1 ? 's' : ''} sur la période · navigation libre (passé / futur).
        Autocall probable = worst-of courant (Yahoo) vs barrière de rappel ; indices propriétaires / taux non cotés → exclus du calcul.
      </p>

      <Modal open={openDetail && !!selAug} onClose={() => setOpenDetail(false)} title={sel ? `${sel.nom} · ${sel.isin}` : ''}>
        {selAug && (
          <div className="flex flex-col gap-3">
            <ProductSynopsis product={selAug} />
            <ProductReconstruction product={selAug} />
          </div>
        )}
      </Modal>
    </div>
  )
}
