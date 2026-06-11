'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Produits créés localement via le masque « Nouveau produit » (localStorage,
//  NON versionnés). Fusionnés dans le portefeuille pour une mise à jour
//  instantanée, sans faire entrer ces brouillons dans le dépôt git.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import type { Product } from './types'

const KEY = 'lifecycle.produits'

function read(): Product[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return []
    // Garde-fou : on n'accepte que des objets exploitables (ISIN + nom).
    return arr.filter(
      (p): p is Product =>
        !!p && typeof p.isin === 'string' && p.isin !== '' && typeof p.nom === 'string',
    )
  } catch {
    return []
  }
}

/** Produits locaux (brouillons) — relus au montage et sur événement storage. */
export function useLocalProducts(): Product[] {
  const [list, setList] = useState<Product[]>([])
  useEffect(() => {
    setList(read())
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setList(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return list
}

/** Supprime un produit local par ISIN. */
export function removeLocalProduct(isin: string) {
  if (typeof window === 'undefined') return
  try {
    const arr = read().filter((p) => p.isin !== isin)
    window.localStorage.setItem(KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}
