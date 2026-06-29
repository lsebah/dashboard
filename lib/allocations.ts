'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Allocations clients, statuts forcés et renommages — persistés côté serveur
//  (KV) quand il est configuré → mémorisés sur TOUS les appareils ; sinon dans
//  le navigateur uniquement. localStorage sert de cache instantané. Même schéma
//  anti-perte que les commissions : la saisie locale prime, jamais écrasée.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import type { ClientAlloc, ProductStatus } from './types'
import { loadSlot, saveSlot, type Slot } from './commissions-sync'

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

// Écrit une map (navigateur + serveur KV, fire-and-forget avec réessais).
function persist(key: string, slot: Slot, value: Record<string, unknown>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / mode privé : on ignore */
  }
  void saveSlot(slot, value)
}

// Fusionne le serveur (autres appareils) avec le navigateur (saisies locales qui
// PRIMENT), relit le localStorage AU MOMENT de la fusion pour ne pas écraser une
// saisie faite entre le montage et la réponse KV, puis repousse la fusion.
function hydrateMerge<T extends Record<string, unknown>>(
  key: string,
  slot: Slot,
  apply: (merged: T) => void,
) {
  void loadSlot<T>(slot).then(({ configured, value }) => {
    if (!configured) return
    const server = value && typeof value === 'object' ? value : ({} as T)
    let local: T = {} as T
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) local = JSON.parse(raw) as T
    } catch {
      /* ignore */
    }
    const merged = { ...server, ...local } as T
    apply(merged)
    try {
      window.localStorage.setItem(key, JSON.stringify(merged))
    } catch {
      /* ignore */
    }
    if (JSON.stringify(merged) !== JSON.stringify(server)) void saveSlot(slot, merged)
  })
}

export function useAllocations() {
  const [map, setMap] = useState<AllocMap>({})
  const [statut, setStatutMap] = useState<StatutMap>({})
  const [noms, setNomsMap] = useState<NomMap>({})

  // Chargement : cache navigateur (instantané) puis serveur (fusion anti-perte).
  useEffect(() => {
    setMap(read())
    setStatutMap(readJson<StatutMap>(KEY_STATUT))
    setNomsMap(readJson<NomMap>(KEY_NOM))
    hydrateMerge<AllocMap>(KEY, 'alloc', setMap)
    hydrateMerge<StatutMap>(KEY_STATUT, 'statut', setStatutMap)
    hydrateMerge<NomMap>(KEY_NOM, 'noms', setNomsMap)
  }, [])

  const setClients = useCallback((isin: string, allocs: ClientAlloc[]) => {
    setMap((prev) => {
      const next = { ...prev }
      if (allocs.length === 0) delete next[isin]
      else next[isin] = allocs
      persist(KEY, 'alloc', next)
      return next
    })
  }, [])

  // Force (ou efface, si undefined) le statut d'un produit.
  const setStatut = useCallback((isin: string, s: ProductStatus | undefined) => {
    setStatutMap((prev) => {
      const next = { ...prev }
      if (!s) delete next[isin]
      else next[isin] = s
      persist(KEY_STATUT, 'statut', next)
      return next
    })
  }, [])

  // Renomme (ou réinitialise si vide) le nom d'affichage d'un produit.
  const setNom = useCallback((isin: string, nom: string) => {
    setNomsMap((prev) => {
      const next = { ...prev }
      const v = nom.trim()
      if (!v) delete next[isin]
      else next[isin] = v
      persist(KEY_NOM, 'noms', next)
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
    void saveSlot('alloc', next) // serveur (tous appareils)
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
