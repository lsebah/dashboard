'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Produits augmentés des niveaux worst-of CONSTATÉS aux observations passées
//  (Yahoo, via /api/lifecycle/courant) + de la surcouche prix (Bloomberg/KV).
//  Sert à ce que la détection de rappel (rappelConstate) et le suivi des
//  coupons opèrent sur des données LIVE — partagé par la nav (badge cloche)
//  et le centre de notifications, pour qu'un rappel détecté déclenche bien la
//  notification + l'email, sans dépendre de la page Portefeuille.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import type { Product } from './types'
import { augmentProduct } from './client-report'

export function useLiveProducts(products: Product[]): Product[] {
  const [niveauxMap, setNiveauxMap] = useState<Record<string, Record<string, number>>>({})
  const [priceMap, setPriceMap] = useState<Record<string, number>>({})

  // ISINs avec sous-jacents (les seuls que /api/lifecycle/courant calcule).
  const isins = useMemo(
    () => products.filter((p) => p.sousJacents?.length).map((p) => p.isin),
    [products],
  )
  const isinsKey = isins.join(',')

  useEffect(() => {
    if (!isinsKey) return
    let annule = false
    fetch(`/api/lifecycle/courant?isins=${encodeURIComponent(isinsKey)}`)
      .then((r) => r.json())
      .then((d) => {
        if (annule) return
        const nm: Record<string, Record<string, number>> = {}
        for (const [isin, c] of Object.entries(d?.courant ?? {})) {
          const niveaux = (c as { niveaux?: Record<string, number> })?.niveaux
          if (niveaux && Object.keys(niveaux).length) nm[isin] = niveaux
        }
        setNiveauxMap(nm)
      })
      .catch(() => {})
    return () => {
      annule = true
    }
  }, [isinsKey])

  // Surcouche prix (KV) — comme le portefeuille, pour cohérence du P&L/notifs.
  useEffect(() => {
    let annule = false
    fetch('/api/prices')
      .then((r) => r.json())
      .then((d) => {
        if (!annule && d?.prices) setPriceMap(d.prices)
      })
      .catch(() => {})
    return () => {
      annule = true
    }
  }, [])

  return useMemo(
    () => products.map((p) => augmentProduct(p, { perfMap: {}, niveauxMap, priceMap })),
    [products, niveauxMap, priceMap],
  )
}
