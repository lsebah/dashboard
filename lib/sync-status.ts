// ─────────────────────────────────────────────────────────────────────────
//  État de synchronisation serveur (KV), partagé par toute l'app. saveSlot
//  rapporte chaque écriture ; un témoin dans l'en-tête l'affiche (« enregistré »
//  / « échec »). « configured:false » (KV absent) n'est pas une erreur réseau,
//  mais ce n'est PAS anodin non plus : la saisie reste alors piégée dans CE
//  navigateur, invisible sur un autre poste ou après un vidage de cache — c'est
//  précisément le défaut qui a fait « disparaître » les tickets ARCHE le
//  17-18/08/2026. `local` porte ce cas, distinct de `idle` (jamais rien
//  enregistré) : le témoin doit rester visible tant qu'aucune sauvegarde
//  serveur n'a réussi, pas s'effacer comme une confirmation ordinaire.
// ─────────────────────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'saving' | 'ok' | 'error' | 'local'

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
