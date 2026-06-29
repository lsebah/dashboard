'use client'
// ─────────────────────────────────────────────────────────────────────────
//  Centre de notifications : dérive les notifications de l'état des produits,
//  persiste l'état (lues / archivées / emailées) côté serveur (KV) avec repli
//  navigateur, et déclenche l'email de rappel UNE SEULE FOIS par événement.
//  Le même flux crée donc la notification (base KV) + l'affiche (onglet) +
//  l'envoie (email), sans doublon.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import type { Product } from './types'
import { deriveNotifications, rappelEmail, type Notif } from './notifications'
import { loadSlot, saveSlot } from './commissions-sync'

export interface NotifState {
  read: string[]
  archived: string[]
  emailed: string[]
}
export interface EnrichedNotif extends Notif {
  read: boolean
  archived: boolean
}

const KEY = 'cmf.lifecycle.notifs.v1'
const EMPTY: NotifState = { read: [], archived: [], emailed: [] }

function readLocal(): NotifState {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as Partial<NotifState>) : {}
    return { read: v.read ?? [], archived: v.archived ?? [], emailed: v.emailed ?? [] }
  } catch {
    return EMPTY
  }
}
// Union des ensembles (lues/archivées/emailées ne font que croître → anti-perte).
function mergeState(a: NotifState, b: NotifState): NotifState {
  const u = (x: string[], y: string[]) => Array.from(new Set([...x, ...y]))
  return { read: u(a.read, b.read), archived: u(a.archived, b.archived), emailed: u(a.emailed, b.emailed) }
}
function persist(s: NotifState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
  void saveSlot('notifs', s)
}

export function useNotifications(products: Product[]) {
  const notifs = useMemo(() => deriveNotifications(products), [products])
  const [state, setState] = useState<NotifState>(EMPTY)

  useEffect(() => {
    const local = readLocal()
    setState(local)
    void loadSlot<NotifState>('notifs').then(({ configured, value }) => {
      const merged = configured && value ? mergeState({ ...EMPTY, ...value }, readLocal()) : readLocal()
      // Email de rappel : uniquement les rappels RÉCENTS (≤ 30 j) non encore
      // emailés → évite un envoi massif au premier chargement (rappels
      // historiques). Dédup via `emailed`.
      const RECENT_MS = 30 * 86_400_000
      const tNow = Date.now()
      const recent = (iso: string) => {
        const t = new Date(iso).getTime()
        return !Number.isNaN(t) && t <= tNow && tNow - t <= RECENT_MS
      }
      const aEmailer = notifs.filter((n) => n.type === 'rappel' && recent(n.date) && !merged.emailed.includes(n.id))
      if (aEmailer.length) {
        merged.emailed = Array.from(new Set([...merged.emailed, ...aEmailer.map((n) => n.id)]))
        for (const n of aEmailer) {
          const { subject, body } = rappelEmail(n)
          void fetch('/api/notifications/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, text: body }),
          }).catch(() => {})
        }
      }
      setState(merged)
      persist(merged)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifs])

  const enriched: EnrichedNotif[] = useMemo(
    () => notifs.map((n) => ({ ...n, read: state.read.includes(n.id), archived: state.archived.includes(n.id) })),
    [notifs, state],
  )
  const unread = enriched.filter((n) => !n.read && !n.archived).length

  const update = (next: NotifState) => {
    setState(next)
    persist(next)
  }
  const markRead = (id: string) => update({ ...state, read: Array.from(new Set([...state.read, id])) })
  const markAllRead = () => update({ ...state, read: Array.from(new Set([...state.read, ...notifs.map((n) => n.id)])) })
  const archive = (id: string) =>
    update({
      ...state,
      archived: Array.from(new Set([...state.archived, id])),
      read: Array.from(new Set([...state.read, id])),
    })
  const unarchive = (id: string) => update({ ...state, archived: state.archived.filter((x) => x !== id) })

  return { notifs: enriched, unread, markRead, markAllRead, archive, unarchive }
}
