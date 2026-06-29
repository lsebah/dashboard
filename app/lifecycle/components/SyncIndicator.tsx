'use client'

import { useEffect, useState } from 'react'
import { subscribeSync, getSyncStatus, type SyncStatus } from '@/lib/sync-status'

// Témoin de synchronisation serveur dans l'en-tête. « Enregistré » s'efface
// après 2,5 s ; « Échec » reste visible jusqu'au prochain succès. Rien quand
// le KV est absent (repli navigateur silencieux) ou au repos.
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
  }
  const v = map[status]
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium ${v.cls}`}
      title={status === 'error' ? 'La sauvegarde serveur a échoué — vos saisies restent dans le navigateur.' : 'Synchronisation serveur'}
      aria-live="polite"
    >
      {v.txt}
    </span>
  )
}
