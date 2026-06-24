'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Couche d'accès aux prix FRN. Seed versionné (data/frn-quotes.json) + saisies
//  persistées côté serveur (KV) quand il est configuré → mémorisées sur TOUS les
//  appareils ; sinon dans le navigateur. À chaque (re)lecture, le run LE PLUS
//  RÉCENT par couple (émetteur, devise, type, maturité) écrase les précédents.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import seedJson from '@/data/frn-quotes.json'
import type { FrnQuote } from './types'
import { loadSlot, saveSlot } from '@/lib/commissions-sync'

export const SEED = seedJson as FrnQuote[]

const KEY = 'cmf.frn.quotes.local.v1'

/** Clé d'unicité d'un prix : un nouveau run du même couple écrase l'ancien.
 *  Annuel et IN FINE sont distincts (un produit peut être coté dans les deux). */
export const quoteKey = (
  q: Pick<FrnQuote, 'issuer' | 'currency' | 'callType' | 'maturityYears' | 'inFine'>,
): string => `${q.issuer}|${q.currency}|${q.callType}|${q.maturityYears}|${q.inFine ? 'IF' : 'A'}`

/** Fusionne plusieurs listes en gardant le run le plus récent (runDate) par clé. */
export function mergeLatest(...lists: FrnQuote[][]): FrnQuote[] {
  const m = new Map<string, FrnQuote>()
  for (const list of lists)
    for (const q of list) {
      const k = quoteKey(q)
      const cur = m.get(k)
      if (!cur || (q.runDate ?? '') >= (cur.runDate ?? '')) m.set(k, q)
    }
  return Array.from(m.values())
}

function readLocal(): FrnQuote[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
function writeLocal(list: FrnQuote[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function useFrnStore() {
  const [local, setLocal] = useState<FrnQuote[]>([])
  useEffect(() => {
    setLocal(readLocal())
    // Serveur (KV) sans rien perdre : fusion par run le plus récent, en relisant
    // le localStorage au moment de la fusion, puis repush de la fusion.
    void loadSlot<FrnQuote[]>('frn').then(({ configured, value }) => {
      if (!configured) return
      const server = Array.isArray(value) ? value : []
      const merged = mergeLatest(server, readLocal())
      setLocal(merged)
      writeLocal(merged)
      if (JSON.stringify(merged) !== JSON.stringify(server)) void saveSlot('frn', merged)
    })
    const on = (e: StorageEvent) => {
      if (e.key === KEY) setLocal(readLocal())
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  // Vue effective : seed + local, run le plus récent par clé (local récent gagne).
  const quotes = useMemo(() => mergeLatest(SEED, local), [local])

  /** Upsert d'un lot de runs : conserve le plus récent par clé. */
  const upsert = (qs: FrnQuote[]) => {
    setLocal((prev) => {
      const next = mergeLatest(prev, qs)
      writeLocal(next)
      void saveSlot('frn', next)
      return next
    })
  }
  const remove = (key: string) => {
    setLocal((prev) => {
      const next = prev.filter((q) => quoteKey(q) !== key)
      writeLocal(next)
      void saveSlot('frn', next)
      return next
    })
  }
  const reset = () => {
    setLocal([])
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    void saveSlot('frn', [])
  }

  return { quotes, local, upsert, remove, reset }
}
