'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Produits créés localement via le masque « Nouveau produit ». Persistés côté
//  serveur (KV) quand il est configuré → mémorisés sur TOUS les appareils ;
//  sinon dans le navigateur uniquement. localStorage sert de cache instantané.
//  Même schéma anti-perte que les commissions (la saisie locale prime).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import type { Product } from './types'
import { loadSlot, saveSlot } from './commissions-sync'

const KEY = 'lifecycle.produits'

// Fusion serveur + navigateur par ISIN : les brouillons locaux priment.
function mergeByIsin(server: Product[], local: Product[]): Product[] {
  const byIsin = new Map<string, Product>()
  for (const p of server) if (p?.isin) byIsin.set(p.isin, p)
  for (const p of local) if (p?.isin) byIsin.set(p.isin, p)
  return Array.from(byIsin.values())
}

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

/** Produits locaux (brouillons) — cache navigateur puis fusion serveur (KV). */
export function useLocalProducts(): Product[] {
  const [list, setList] = useState<Product[]>([])
  useEffect(() => {
    setList(read())
    // Serveur (fait foi s'il est configuré) sans écraser les brouillons locaux :
    // on relit le localStorage au moment de la fusion (anti-perte) puis on
    // repousse la fusion pour la mémoriser sur tous les appareils.
    void loadSlot<Product[]>('products').then(({ configured, value }) => {
      if (!configured) return
      const server = Array.isArray(value) ? value : []
      const merged = mergeByIsin(server, read())
      setList(merged)
      try {
        window.localStorage.setItem(KEY, JSON.stringify(merged))
      } catch {
        /* ignore */
      }
      if (JSON.stringify(merged) !== JSON.stringify(server)) void saveSlot('products', merged)
    })
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
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    void saveSlot('products', arr) // serveur (tous appareils)
  } catch {
    /* ignore */
  }
}

/** Ajoute (ou remplace par ISIN) un produit local — utilisé par « Nouveau trade ». */
export function addLocalProduct(p: Product) {
  if (typeof window === 'undefined') return
  try {
    const arr = read().filter((x) => x.isin !== p.isin)
    arr.push(p)
    window.localStorage.setItem(KEY, JSON.stringify(arr))
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    void saveSlot('products', arr) // serveur (tous appareils)
  } catch {
    /* ignore */
  }
}
