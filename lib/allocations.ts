'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Allocations clients — stockées dans le navigateur (localStorage), JAMAIS
//  versionnées. Permet d'affecter un (ou plusieurs) client + montant à chaque
//  produit, sans faire entrer l'identité des clients dans le dépôt git.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import type { ClientAlloc, ProductStatus } from './types'

export type { ClientAlloc }

/** isin → liste d'allocations clients. */
export type AllocMap = Record<string, ClientAlloc[]>
/** isin → statut forcé localement (vendu / rappelé / vivant…). */
export type StatutMap = Record<string, ProductStatus>

const KEY = 'cmf.lifecycle.allocations.v1'
const KEY_STATUT = 'cmf.lifecycle.statut.v1'

function read(): AllocMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AllocMap) : {}
  } catch {
    return {}
  }
}

function readStatut(): StatutMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY_STATUT)
    return raw ? (JSON.parse(raw) as StatutMap) : {}
  } catch {
    return {}
  }
}

export function useAllocations() {
  const [map, setMap] = useState<AllocMap>({})
  const [statut, setStatutMap] = useState<StatutMap>({})

  // Chargement initial (au montage uniquement).
  useEffect(() => {
    setMap(read())
    setStatutMap(readStatut())
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

  // Force (ou efface, si undefined) le statut d'un produit, localement.
  const setStatut = useCallback((isin: string, s: ProductStatus | undefined) => {
    setStatutMap((prev) => {
      const next = { ...prev }
      if (!s) delete next[isin]
      else next[isin] = s
      try {
        window.localStorage.setItem(KEY_STATUT, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { map, setClients, statut, setStatut }
}

/** Liste triée et dédupliquée de tous les clients connus (allocations ∪ seed). */
export function tousLesClients(map: AllocMap, seed: string[] = []): string[] {
  const set = new Set<string>(seed)
  for (const allocs of Object.values(map)) for (const a of allocs) set.add(a.client)
  return Array.from(set).sort()
}
