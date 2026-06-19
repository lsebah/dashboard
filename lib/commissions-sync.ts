'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Synchronisation serveur (KV) des modifications de commissions. Le stockage
//  navigateur (localStorage) reste le cache instantané ; le serveur fait foi au
//  chargement et mémorise chaque changement pour tous les appareils. Tout est
//  tolérant aux pannes : en l'absence de KV, on retombe sur le navigateur.
// ─────────────────────────────────────────────────────────────────────────

export type Slot = 'ov' | 'local'

/** Lit un slot côté serveur. `configured:false` ⇒ KV absent (repli navigateur). */
export async function loadSlot<T>(slot: Slot): Promise<{ configured: boolean; value: T | null }> {
  try {
    const res = await fetch(`/api/commissions/store?slot=${slot}`, { cache: 'no-store' })
    if (!res.ok) return { configured: false, value: null }
    return (await res.json()) as { configured: boolean; value: T | null }
  } catch {
    return { configured: false, value: null }
  }
}

/** Écrit un slot côté serveur (fire-and-forget côté appelant). */
export async function saveSlot(slot: Slot, value: unknown): Promise<boolean> {
  try {
    const res = await fetch('/api/commissions/store', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, value }),
    })
    if (!res.ok) return false
    const j = (await res.json()) as { ok?: boolean }
    return !!j.ok
  } catch {
    return false
  }
}
