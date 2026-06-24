'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Synchronisation serveur (KV) des modifications de commissions. Le stockage
//  navigateur (localStorage) reste le cache instantané ; le serveur fait foi au
//  chargement et mémorise chaque changement pour tous les appareils. Tout est
//  tolérant aux pannes : en l'absence de KV, on retombe sur le navigateur.
// ─────────────────────────────────────────────────────────────────────────

export type Slot = 'ov' | 'local' | 'alloc' | 'statut' | 'noms'

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

/**
 * Écrit un slot côté serveur (fire-and-forget côté appelant). Réessaie jusqu'à
 * 3 fois avec un court backoff : un échec réseau ponctuel ne doit pas faire
 * perdre une saisie (date de paiement, n° de facture…).
 */
export async function saveSlot(slot: Slot, value: unknown): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/commissions/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, value }),
      })
      if (res.ok) {
        const j = (await res.json()) as { ok?: boolean }
        if (j.ok) return true
      }
    } catch {
      /* on réessaie */
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
  }
  return false
}
