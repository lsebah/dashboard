// ─────────────────────────────────────────────────────────────────────────
//  État de synchronisation serveur (KV), partagé par toute l'app. saveSlot
//  rapporte chaque écriture ; un témoin dans l'en-tête l'affiche (« enregistré »
//  / « échec »). « configured:false » (KV absent) n'est PAS une erreur : repli
//  navigateur silencieux.
// ─────────────────────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'saving' | 'ok' | 'error'

let status: SyncStatus = 'idle'
let at = 0
const subs = new Set<(s: SyncStatus, at: number) => void>()

export function reportSync(s: SyncStatus): void {
  status = s
  at = typeof Date !== 'undefined' ? Date.now() : 0
  subs.forEach((f) => f(status, at))
}

export function subscribeSync(cb: (s: SyncStatus, at: number) => void): () => void {
  subs.add(cb)
  return () => {
    subs.delete(cb)
  }
}

export function getSyncStatus(): { status: SyncStatus; at: number } {
  return { status, at }
}
