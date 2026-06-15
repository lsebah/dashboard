'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Couche d'accès aux prix FRN. Phase 1 : seed versionné (data/frn-quotes.json)
//  + saisies locales (localStorage, NON versionnées). À chaque (re)lecture, le
//  run LE PLUS RÉCENT par couple (émetteur, devise, type, maturité) écrase les
//  précédents. Abstraction prête à migrer vers KV/DB (phase 2).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import seedJson from '@/data/frn-quotes.json'
import type { FrnQuote } from './types'

export const SEED = seedJson as FrnQuote[]

const KEY = 'cmf.frn.quotes.local.v1'

/** Clé d'unicité d'un prix : un nouveau run du même couple écrase l'ancien. */
export const quoteKey = (q: Pick<FrnQuote, 'issuer' | 'currency' | 'callType' | 'maturityYears'>): string =>
  `${q.issuer}|${q.currency}|${q.callType}|${q.maturityYears}`

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
      return next
    })
  }
  const remove = (key: string) => {
    setLocal((prev) => {
      const next = prev.filter((q) => quoteKey(q) !== key)
      writeLocal(next)
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
  }

  return { quotes, local, upsert, remove, reset }
}
