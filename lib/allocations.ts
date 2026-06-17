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
/** isin → nom d'affichage forcé localement (renommage manuel du produit). */
export type NomMap = Record<string, string>

const KEY = 'cmf.lifecycle.allocations.v1'
const KEY_STATUT = 'cmf.lifecycle.statut.v1'
const KEY_NOM = 'cmf.lifecycle.noms.v1'

function read(): AllocMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AllocMap) : {}
  } catch {
    return {}
  }
}

function readJson<T>(key: string): T {
  if (typeof window === 'undefined') return {} as T
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : ({} as T)
  } catch {
    return {} as T
  }
}

export function useAllocations() {
  const [map, setMap] = useState<AllocMap>({})
  const [statut, setStatutMap] = useState<StatutMap>({})
  const [noms, setNomsMap] = useState<NomMap>({})

  // Chargement initial (au montage uniquement).
  useEffect(() => {
    setMap(read())
    setStatutMap(readJson<StatutMap>(KEY_STATUT))
    setNomsMap(readJson<NomMap>(KEY_NOM))
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

  // Renomme (ou réinitialise si vide) le nom d'affichage d'un produit, localement.
  const setNom = useCallback((isin: string, nom: string) => {
    setNomsMap((prev) => {
      const next = { ...prev }
      const v = nom.trim()
      if (!v) delete next[isin]
      else next[isin] = v
      try {
        window.localStorage.setItem(KEY_NOM, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { map, setClients, statut, setStatut, noms, setNom }
}

/** Écrit les allocations d'un ISIN hors hook (utilisé par « Nouveau trade »). */
export function setLocalAllocations(isin: string, allocs: ClientAlloc[]) {
  if (typeof window === 'undefined') return
  try {
    const next = { ...read() }
    if (allocs.length === 0) delete next[isin]
    else next[isin] = allocs
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
  } catch {
    /* ignore */
  }
}

/** Liste triée et dédupliquée de tous les clients connus (allocations ∪ seed). */
export function tousLesClients(map: AllocMap, seed: string[] = []): string[] {
  const set = new Set<string>(seed)
  for (const allocs of Object.values(map)) for (const a of allocs) set.add(a.client)
  return Array.from(set).sort()
}
