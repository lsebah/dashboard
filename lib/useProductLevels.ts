'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Product, Observation } from './types'

interface NiveauxData {
  niveaux: Record<string, number>
  sj: Record<string, number> // nom du sous-jacent → niveau courant en % du strike
}

/**
 * Récupère côté serveur (Yahoo) les niveaux du produit ouvert et les fusionne :
 *  - `niveauConstatePct` sur chaque observation passée (suivi des coupons) ;
 *  - `perf` sur chaque sous-jacent (niveau courant en % du strike − 100).
 * Renvoie le produit augmenté (ou le produit brut tant que la donnée charge).
 */
export function useAugmentedProduct(product: Product | null): Product | null {
  const [data, setData] = useState<NiveauxData | null>(null)

  useEffect(() => {
    setData(null)
    if (!product) return
    let annule = false
    fetch(`/api/lifecycle/niveaux?isin=${encodeURIComponent(product.isin)}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return
        const sj: Record<string, number> = {}
        for (const x of d?.courant?.sj ?? [])
          if (typeof x.pct === 'number') sj[x.nom] = x.pct
        setData({ niveaux: d?.niveaux ?? {}, sj })
      })
      .catch(() => {
        if (!annule) setData({ niveaux: {}, sj: {} })
      })
    return () => {
      annule = true
    }
  }, [product])

  return useMemo<Product | null>(() => {
    if (!product) return null
    if (!data) return product
    const observations: Observation[] | undefined = product.observations?.map((o) =>
      typeof data.niveaux[o.dateObservation] === 'number'
        ? { ...o, niveauConstatePct: data.niveaux[o.dateObservation] }
        : o,
    )
    const sousJacents = product.sousJacents.map((u) =>
      typeof data.sj[u.nom] === 'number'
        ? { ...u, perf: Math.round((data.sj[u.nom] - 100) * 100) / 100 }
        : u,
    )
    return { ...product, observations, sousJacents }
  }, [product, data])
}
