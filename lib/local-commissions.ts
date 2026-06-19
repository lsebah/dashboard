'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Commissions créées localement (depuis l'import d'une TS / « Nouveau
//  trade »). localStorage, NON versionnées. Fusionnées dans l'onglet
//  Commissions pour un suivi instantané + historique de facturation.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import type { CommissionLigne } from './commissions'

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
// « storage » ne se déclenche que dans les autres onglets. À n'appeler que
// hors d'un updater React (le hook met déjà son state à jour lui-même).
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
  useEffect(() => {
    setList(read())
    const on = (e: StorageEvent) => {
      if (e.key === KEY) setList(read())
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  const upsert = (c: LocalCommission) => {
    setList((prev) => {
      const i = prev.findIndex((x) => sameRow(x, c.isin, c.client))
      const next = i >= 0 ? prev.map((x, j) => (j === i ? c : x)) : [...prev, c]
      write(next)
      return next
    })
  }
  const remove = (isin: string, client: string | null) => {
    setList((prev) => {
      const next = prev.filter((x) => !sameRow(x, isin, client))
      write(next)
      return next
    })
  }
  return { list, upsert, remove }
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
  } catch {
    /* ignore */
  }
}

/** Supprime une commission locale (ISIN + client). */
export function removeLocalCommission(isin: string, client: string | null) {
  if (typeof window === 'undefined') return
  try {
    write(read().filter((x) => !sameRow(x, isin, client)))
    notify()
  } catch {
    /* ignore */
  }
}
