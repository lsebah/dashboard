'use client'

import { useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import { useNotifications } from '@/lib/use-notifications'
import { notifTypeLabel, type NotifType } from '@/lib/notifications'
import { formatDateFr } from '@/lib/lifecycle'

const TYPE_STYLE: Record<NotifType, string> = {
  rappel: 'bg-violet-100 text-violet-700',
  maturite: 'bg-amber-100 text-amber-700',
  maturite_proche: 'bg-amber-50 text-amber-600',
  coupon: 'bg-sky-100 text-sky-700',
  donnees: 'bg-slate-100 text-slate-600',
}

type Filtre = 'tous' | 'rappel' | 'maturite' | 'coupon' | 'donnees'
const FILTRES: { k: Filtre; label: string }[] = [
  { k: 'tous', label: 'Toutes' },
  { k: 'rappel', label: 'Rappels' },
  { k: 'maturite', label: 'Maturités' },
  { k: 'coupon', label: 'Coupons' },
  { k: 'donnees', label: 'Données' },
]
const matchFiltre = (t: NotifType, f: Filtre) =>
  f === 'tous' || (f === 'maturite' ? t === 'maturite' || t === 'maturite_proche' : t === f)

export default function NotificationsView({ products }: { products: Product[] }) {
  const { notifs, unread, markRead, markAllRead, archive, unarchive } = useNotifications(products)
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [q, setQ] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return notifs.filter(
      (n) =>
        (showArchived ? n.archived : !n.archived) &&
        matchFiltre(n.type, filtre) &&
        (!needle || `${n.isin} ${n.nom} ${n.client ?? ''}`.toLowerCase().includes(needle)),
    )
  }, [notifs, filtre, q, showArchived])

  const compte = (f: Filtre) => notifs.filter((n) => !n.archived && matchFiltre(n.type, f)).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cmf-navy">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unread} non lue{unread > 1 ? 's' : ''} · {notifs.filter((n) => !n.archived).length} active(s).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (ISIN, produit, client)…" className="input w-[260px]" />
          <button onClick={markAllRead} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
            Tout marquer lu
          </button>
          <button
            onClick={() => setShowArchived((s) => !s)}
            className={`rounded-md border px-3 py-1.5 text-xs ${showArchived ? 'border-cmf-blue bg-cmf-blue/10 text-cmf-navy' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {showArchived ? 'Archives' : 'Actives'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTRES.map((f) => (
          <button
            key={f.k}
            onClick={() => setFiltre(f.k)}
            className={`rounded-full border px-2.5 py-1 text-xs ${filtre === f.k ? 'border-cmf-blue bg-cmf-blue/10 text-cmf-navy' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            {f.label}{f.k !== 'tous' ? ` (${compte(f.k)})` : ''}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">Aucune notification.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((n) => (
              <li key={n.id} className={`flex items-center gap-3 px-4 py-2.5 ${n.read ? 'bg-white' : 'bg-blue-50/40'}`}>
                {!n.read && !n.archived && <span className="w-2 h-2 rounded-full bg-cmf-blue shrink-0" title="Non lue" />}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_STYLE[n.type]}`}>{notifTypeLabel(n.type)}</span>
                <span className="shrink-0 w-[92px] text-[12px] text-slate-500 tabular-nums">{formatDateFr(n.date)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-slate-800" title={n.nom}>{n.nom}</div>
                  <div className="truncate text-[11px] text-slate-500">
                    {n.isin !== '—' && <span className="font-mono">{n.isin}</span>}
                    {n.client && <span> · {n.client}</span>}
                    {n.statut && <span> · {n.statut}</span>}
                    {n.niveauPct != null && <span> · niveau {n.niveauPct}%</span>}
                    {n.couponPct != null && <span> · coupon {n.couponPct}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[12px]">
                  <a href={n.lien} className="text-cmf-blue hover:underline">Ouvrir</a>
                  {!n.read && <button onClick={() => markRead(n.id)} className="text-slate-400 hover:text-emerald-600" title="Marquer comme lu">✓</button>}
                  {n.archived ? (
                    <button onClick={() => unarchive(n.id)} className="text-slate-400 hover:text-cmf-blue" title="Désarchiver">↩</button>
                  ) : (
                    <button onClick={() => archive(n.id)} className="text-slate-400 hover:text-slate-700" title="Archiver">🗄</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        Les rappels déclenchent un email automatique vers L.sebah@cmf.finance (une fois par événement).
        L'envoi nécessite la clé d'API mail configurée ; sinon la notification reste visible ici.
      </p>
    </div>
  )
}
