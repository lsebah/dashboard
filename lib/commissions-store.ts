'use client'

import { useEffect, useState } from 'react'
import { loadSlot, saveSlot } from './commissions-sync'

// Surcharges locales des commissions : UF / Rétro saisis à la main (en %,
// décimal) et marquage « facturé » manuel (si la facture a été envoyée par un
// autre canal). Clé = identifiant stable d'une ligne. Persistées côté serveur
// (KV) quand il est configuré → mémorisées sur tous les appareils ; sinon dans
// le navigateur uniquement. localStorage sert de cache instantané dans les deux
// cas.
export interface CommissionOverride {
  uf?: number // upfront total (décimal, 0.06 = 6 %)
  retro?: number // rétrocession (décimal)
  fait?: boolean // facturé/envoyé manuellement (autre canal)
  facture?: string // n° de facture saisi à la main
  credited?: string // date d'encaissement (ISO) saisie à la main
}

const KEY = 'cmf.commissions.ov.v1'

export function useCommissionsStore() {
  const [ov, setOv] = useState<Record<string, CommissionOverride>>({})
  // null = inconnu, true = sauvegarde serveur active, false = navigateur seul.
  const [serverSync, setServerSync] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    // 1) Hydrate immédiatement depuis le cache navigateur (instantané).
    let local: Record<string, CommissionOverride> = {}
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) local = JSON.parse(raw)
    } catch {
      /* ignore */
    }
    if (Object.keys(local).length) setOv(local)
    // 2) Le serveur fait foi s'il est configuré.
    loadSlot<Record<string, CommissionOverride>>('ov').then(({ configured, value }) => {
      if (cancelled) return
      setServerSync(configured)
      if (!configured) return
      if (value && Object.keys(value).length) {
        setOv(value)
        try {
          localStorage.setItem(KEY, JSON.stringify(value))
        } catch {
          /* ignore */
        }
      } else if (Object.keys(local).length) {
        // Première synchro : pousse le cache navigateur existant vers le serveur.
        saveSlot('ov', local)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = (next: Record<string, CommissionOverride>) => {
    setOv(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    void saveSlot('ov', next) // serveur (fire-and-forget)
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

  const reset = () => {
    setOv({})
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    void saveSlot('ov', {})
  }

  return { ov, patch, reset, serverSync }
}
