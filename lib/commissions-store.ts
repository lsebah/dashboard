'use client'

import { useEffect, useState } from 'react'

// Surcharges locales (non versionnées) des commissions : UF / Rétro saisis à la
// main (en %, décimal) et marquage « facturé » manuel (si la facture a été
// envoyée par un autre canal). Clé = identifiant stable d'une ligne.
export interface CommissionOverride {
  uf?: number // upfront total (décimal, 0.06 = 6 %)
  retro?: number // rétrocession (décimal)
  fait?: boolean // facturé/envoyé manuellement (autre canal)
  credited?: string // date d'encaissement (ISO) saisie à la main
}

const KEY = 'cmf.commissions.ov.v1'

export function useCommissionsStore() {
  const [ov, setOv] = useState<Record<string, CommissionOverride>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setOv(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const persist = (next: Record<string, CommissionOverride>) => {
    setOv(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const patch = (key: string, p: Partial<CommissionOverride>) => {
    const cur = { ...(ov[key] ?? {}), ...p }
    // nettoie les clés undefined
    for (const k of Object.keys(cur) as (keyof CommissionOverride)[])
      if (cur[k] === undefined) delete cur[k]
    const next = { ...ov, [key]: cur }
    if (Object.keys(cur).length === 0) delete next[key]
    persist(next)
  }

  return { ov, patch }
}
