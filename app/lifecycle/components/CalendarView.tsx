'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Product, Observation } from '@/lib/types'
import { formatDateFr, formatPct } from '@/lib/lifecycle'
import { useAugmentedProduct } from '@/lib/useProductLevels'
import ProductSynopsis from './ProductSynopsis'
import ProductReconstruction from './ProductReconstruction'
import Modal from './Modal'

interface Ligne {
  product: Product
  obs: Observation
}

// Probabilité d'autocall : niveau COURANT du worst-of vs barrière de rappel.
function proba(
  worstOf: number | null | undefined,
  barrier: number | undefined,
  actif: boolean,
): { label: string; cls: string } {
  if (!actif) return { label: 'Non-call', cls: 'bg-slate-100 text-slate-400' }
  if (typeof worstOf !== 'number') return { label: '—', cls: 'text-slate-300' }
  if (typeof barrier !== 'number') return { label: '—', cls: 'text-slate-300' }
  if (worstOf >= barrier) return { label: 'Probable', cls: 'bg-emerald-100 text-emerald-700' }
  if (worstOf >= barrier - 5) return { label: 'Proche', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'Peu probable', cls: 'bg-slate-100 text-slate-500' }
}

function comptes(p: Product): string {
  const a = p.allocations?.map((x) => x.client) ?? p.clients ?? []
  return a.length ? a.join(', ') : '—'
}

function prixCell(p: Product): { text: string; cls: string } {
  if (typeof p.prixMarche !== 'number') return { text: '—', cls: 'text-slate-300' }
  const cls =
    p.prixMarche > 100 ? 'text-emerald-600' : p.prixMarche < 100 ? 'text-red-600' : 'text-slate-900'
  return { text: p.prixMarche.toFixed(2), cls }
}

export default function CalendarView({ products }: { products: Product[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const [openId, setOpenId] = useState<string | null>(null)
  const [courant, setCourant] = useState<Record<string, number | null>>({})

  // Observations à venir (calendrier décodé), triées par date.
  const lignes = useMemo<Ligne[]>(() => {
    const out: Ligne[] = []
    for (const p of products)
      for (const o of p.observations ?? [])
        if (o.dateObservation >= today) out.push({ product: p, obs: o })
    out.sort((a, b) => a.obs.dateObservation.localeCompare(b.obs.dateObservation))
    return out
  }, [products, today])

  const affichees = lignes.slice(0, 120)

  // Niveaux courants (worst-of) des produits affichés — un seul appel batché.
  useEffect(() => {
    const isins = Array.from(new Set(affichees.map((l) => l.product.isin)))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const opened = openId ? products.find((p) => p.id === openId) ?? null : null
  const openedAug = useAugmentedProduct(opened)

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cmf-navy">Calendrier des observations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Probabilité d'autocall = niveau courant du worst-of vs barrière de rappel. Clique une
            ligne pour ouvrir le produit avec les niveaux des sous-jacents.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Probable</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Proche</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Peu probable</span>
        </div>
      </div>

      <div className="card overflow-auto max-h-[calc(100vh-14rem)]">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Produit</th>
              <th className="text-left px-3 py-2 font-medium">ISIN</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-right px-3 py-2 font-medium">B. rappel</th>
              <th className="text-right px-3 py-2 font-medium">Coupon</th>
              <th className="text-right px-3 py-2 font-medium">Prix</th>
              <th className="text-left px-3 py-2 font-medium">Compte client</th>
              <th className="text-center px-3 py-2 font-medium">Autocall ?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {affichees.map((l, i) => {
              const actif = l.obs.autocallActif !== false
              const wo = courant[l.product.isin]
              const pr = proba(wo, l.obs.niveauRappelPct, actif)
              const px = prixCell(l.product)
              return (
                <tr
                  key={`${l.product.id}-${l.obs.n}-${i}`}
                  onClick={() => setOpenId(l.product.id)}
                  className="cursor-pointer hover:bg-orange-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-700">
                    {formatDateFr(l.obs.dateObservation)}
                  </td>
                  <td className="px-3 py-2 max-w-[280px] truncate" title={l.product.nom}>
                    {l.product.nom}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {l.product.isin}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {l.product.productType ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {actif ? formatPct(l.obs.niveauRappelPct, 2) : <span className="text-slate-400">non-call</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPct(l.obs.couponPct, 3)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${px.cls}`}>{px.text}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{comptes(l.product)}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${pr.cls}`}>
                      {pr.label}
                      {typeof wo === 'number' && (
                        <span className="ml-1 tabular-nums opacity-70">{wo.toFixed(0)}%</span>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        {lignes.length} observations à venir · {affichees.length} premières affichées. Les niveaux
        courants proviennent de Yahoo (indices propriétaires / taux : « — », à compléter via la page
        Bloomberg).
      </p>

      <Modal open={!!opened} onClose={() => setOpenId(null)} title={opened ? `${opened.nom} · ${opened.isin}` : ''}>
        {openedAug && (
          <div className="flex flex-col gap-3">
            <ProductSynopsis product={openedAug} />
            <ProductReconstruction product={openedAug} />
          </div>
        )}
      </Modal>
    </div>
  )
}
