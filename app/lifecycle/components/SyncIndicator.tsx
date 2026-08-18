'use client'

import { useEffect, useState } from 'react'
import { subscribeSync, getSyncStatus, type SyncStatus } from '@/lib/sync-status'

// Témoin de synchronisation serveur dans l'en-tête. « Enregistré » s'efface
// après 2,5 s ; « Échec » et « navigateur seul » restent visibles jusqu'au
// prochain succès serveur — ce sont les deux cas où une saisie peut se perdre
// ou rester invisible ailleurs, jamais un état à faire disparaître tout seul.
// Rien seulement au repos, avant toute écriture (`idle`).
export default function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus().status)

  useEffect(() => {
    const unsub = subscribeSync((s) => setStatus(s))
    return unsub
  }, [])

  // Masque automatiquement l'état « ok » au bout de 2,5 s.
  useEffect(() => {
    if (status !== 'ok') return
    const id = setTimeout(() => setStatus((s) => (s === 'ok' ? 'idle' : s)), 2500)
    return () => clearTimeout(id)
  }, [status])

  if (status === 'idle') return null

  const map: Record<Exclude<SyncStatus, 'idle'>, { txt: string; cls: string }> = {
    saving: { txt: '↻ Sauvegarde…', cls: 'text-slate-300' },
    ok: { txt: '✓ Enregistré', cls: 'text-emerald-300' },
    error: { txt: '⚠ Sauvegarde échouée', cls: 'text-red-300' },
    local: { txt: '⚠ Navigateur uniquement', cls: 'text-amber-300' },
  }
  const v = map[status]
  const titre =
    status === 'error'
      ? 'La sauvegarde serveur a échoué — ta saisie reste dans ce navigateur.'
      : status === 'local'
        ? "Pas de serveur partagé configuré (KV) — cette saisie reste dans CE navigateur, invisible ailleurs et perdue si tu vides le cache. Vérifie la configuration KV côté Vercel."
        : 'Synchronisation serveur'
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium ${v.cls}`}
      title={titre}
      aria-live="polite"
    >
      {v.txt}
    </span>
  )
}
