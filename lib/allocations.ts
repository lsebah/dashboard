'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Allocations clients — stockées dans le navigateur (localStorage), JAMAIS
//  versionnées. Permet d'affecter un (ou plusieurs) client + montant à chaque
//  produit, sans faire entrer l'identité des clients dans le dépôt git.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import type { ClientAlloc } from './types'

export type { ClientAlloc }

/** isin → liste d'allocations clients. */
export type AllocMap = Record<string, ClientAlloc[]>

const KEY = 'cmf.lifecycle.allocations.v1'

function read(): AllocMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AllocMap) : {}
  } catch {
    return {}
  }
}

export function useAllocations() {
  const [map, setMap] = useState<AllocMap>({})

  // Chargement initial (au montage uniquement).
  useEffect(() => {
    setMap(read())
  }, [])

  const setClients = useCallback((isin: string, allocs: ClientAlloc[]) => {
    setMap((prev) => {
      const next = { ...prev }
      if (allocs.length === 0) delete next[isin]
      else next[isin] = allocs
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* quota / mode privé : on ignore */
      }
      return next
    })
  }, [])

  return { map, setClients }
}

/** Liste triée et dédupliquée de tous les clients connus (allocations ∪ seed). */
export function tousLesClients(map: AllocMap, seed: string[] = []): string[] {
  const set = new Set<string>(seed)
  for (const allocs of Object.values(map)) for (const a of allocs) set.add(a.client)
  return Array.from(set).sort()
}
