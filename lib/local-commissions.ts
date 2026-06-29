'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Commissions créées localement (depuis l'import d'une TS / « Nouveau
//  trade »). Persistées côté serveur (KV) quand il est configuré → mémorisées
//  sur tous les appareils ; sinon dans le navigateur uniquement. localStorage
//  sert de cache instantané. Fusionnées dans l'onglet Commissions pour un suivi
//  instantané + historique de facturation.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import type { CommissionLigne } from './commissions'
import { loadSlot, saveSlot } from './commissions-sync'

export type FactureStatut = 'en_attente' | 'envoyee' | 'confirmee' | 'payee'

export const STATUT_LABEL: Record<FactureStatut, string> = {
  en_attente: 'En attente',
  envoyee: 'Envoyée',
  confirmee: 'Confirmée',
  payee: 'Payée',
}

export interface HistoEntry {
  action: string
  date: string // horodatage lisible
  user: string
}

export interface LocalCommission extends CommissionLigne {
  statutFacture: FactureStatut
  genereLe?: string | null
  envoyeLe?: string | null
  histo: HistoEntry[]
}

const KEY = 'cmf.lifecycle.commissions.local.v1'

function read(): LocalCommission[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
function write(list: LocalCommission[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}
// Notifie les AUTRES composants montés (même onglet) — l'événement natif
// « storage » ne se déclenche que dans les autres onglets.
function notify() {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
  } catch {
    /* ignore */
  }
}

const sameRow = (a: LocalCommission, isin: string, client: string | null) =>
  a.isin === isin && a.client === client

export function useLocalCommissions() {
  const [list, setList] = useState<LocalCommission[]>([])
  const hydrated = useRef(false)
  // Ref toujours à jour avec le dernier `list` — utilisé dans le callback async
  // du chargement KV pour éviter d'écraser les modifications faites entre le
  // mount et la réponse serveur (closure stale sinon).
  const listRef = useRef<LocalCommission[]>([])

  useEffect(() => {
    listRef.current = list
  }, [list])

  // Chargement : cache navigateur (instantané) puis serveur (fait foi s'il est
  // configuré). Après hydratation, chaque changement de `list` est persisté.
  useEffect(() => {
    const local = read()
    if (local.length) {
      listRef.current = local
      setList(local)
    }
    loadSlot<LocalCommission[]>('local').then(({ configured, value }) => {
      if (configured) {
        // Fusion serveur + navigateur (les saisies locales priment) : on n'écrase
        // JAMAIS une commission créée/modifiée ici qui ne serait pas encore
        // remontée au serveur. On utilise listRef.current (pas la capture initiale)
        // pour inclure toute modification faite avant la réponse KV.
        const server = Array.isArray(value) ? value : []
        const byKey = new Map<string, LocalCommission>()
        for (const c of server) byKey.set(`${c.isin}|${c.client ?? ''}`, c)
        for (const c of listRef.current) byKey.set(`${c.isin}|${c.client ?? ''}`, c)
        setList(Array.from(byKey.values()))
      }
      hydrated.current = true
    })
    const on = (e: StorageEvent) => {
      if (e.key === KEY) setList(read())
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  // Persiste tout changement (cache navigateur + serveur), une fois hydraté.
  useEffect(() => {
    if (!hydrated.current) return
    write(list)
    void saveSlot('local', list)
  }, [list])

  // Méthodes « pures » (updater fonctionnel) → robustes aux appels successifs.
  const upsert = (c: LocalCommission) => {
    setList((prev) => {
      const i = prev.findIndex((x) => sameRow(x, c.isin, c.client))
      return i >= 0 ? prev.map((x, j) => (j === i ? c : x)) : [...prev, c]
    })
  }
  const remove = (isin: string, client: string | null) => {
    setList((prev) => prev.filter((x) => !sameRow(x, isin, client)))
  }
  // Remplace une ligne (gère le renommage ISIN/client en un seul passage).
  const replace = (oldIsin: string, oldClient: string | null, next: LocalCommission) => {
    setList((prev) => {
      const cleaned = prev.filter((x) => !sameRow(x, oldIsin, oldClient))
      const i = cleaned.findIndex((x) => sameRow(x, next.isin, next.client))
      return i >= 0 ? cleaned.map((x, j) => (j === i ? next : x)) : [...cleaned, next]
    })
  }
  return { list, upsert, remove, replace }
}

// ── Helpers hors hook (utilisés par « Nouveau trade ») ─────────────────────

/** Ajoute (ou remplace par ISIN + client) une ou plusieurs commissions locales. */
export function addLocalCommissions(lignes: LocalCommission[]) {
  if (typeof window === 'undefined' || lignes.length === 0) return
  try {
    const arr = read()
    for (const c of lignes) {
      const i = arr.findIndex((x) => sameRow(x, c.isin, c.client))
      if (i >= 0) arr[i] = c
      else arr.push(c)
    }
    write(arr)
    notify()
    void saveSlot('local', arr)
  } catch {
    /* ignore */
  }
}

/** Supprime une commission locale (ISIN + client). */
export function removeLocalCommission(isin: string, client: string | null) {
  if (typeof window === 'undefined') return
  try {
    const arr = read().filter((x) => !sameRow(x, isin, client))
    write(arr)
    notify()
    void saveSlot('local', arr)
  } catch {
    /* ignore */
  }
}
