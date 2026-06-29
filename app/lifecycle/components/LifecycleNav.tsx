'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import NouveauTrade from './NouveauTrade'
import { products } from '@/lib/products'
import { useNotifications } from '@/lib/use-notifications'
import { useLiveProducts } from '@/lib/use-live-products'

const tabs = [
  { name: 'Portefeuille', href: '/lifecycle' },
  { name: 'Calendrier', href: '/lifecycle/calendrier' },
  { name: 'Décrément', href: '/lifecycle/comparatif' },
  { name: 'Commissions', href: '/lifecycle/commissions' },
  { name: 'Bloomberg', href: '/lifecycle/bloomberg' },
  { name: 'Santé données', href: '/lifecycle/sante' },
]

/** Onglet courant mis en évidence (gras + soulignement) selon l'URL. */
export default function LifecycleNav() {
  const path = usePathname()
  const [showTrade, setShowTrade] = useState(false)
  // Produits augmentés des niveaux live → le badge compte aussi les rappels
  // détectés via Yahoo (et déclenche l'email), pas seulement les statuts figés.
  const live = useLiveProducts(products)
  const { unread } = useNotifications(live)
  const notifActive = path.startsWith('/lifecycle/notifications')
  return (
    <nav className="flex items-center gap-6 text-sm">
      {tabs.map((t) => {
        const active = t.href === '/lifecycle' ? path === '/lifecycle' : path.startsWith(t.href)
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`transition-colors border-b-2 pb-0.5 ${
              active
                ? 'text-white font-semibold border-cmf-blue'
                : 'text-slate-300 hover:text-white border-transparent'
            }`}
          >
            {t.name}
          </a>
        )
      })}
      {/* Notifications avec badge « non lues » (cloche). */}
      <a
        href="/lifecycle/notifications"
        aria-current={notifActive ? 'page' : undefined}
        className={`relative inline-flex items-center gap-1 transition-colors border-b-2 pb-0.5 ${
          notifActive ? 'text-white font-semibold border-cmf-blue' : 'text-slate-300 hover:text-white border-transparent'
        }`}
        title="Notifications"
      >
        <span aria-hidden>🔔</span>
        <span>Notifications</span>
        {unread > 0 && (
          <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </a>
      {/* « Nouveau trade » ouvre le pop-up de saisie (remplace l'ancienne page). */}
      <button
        onClick={() => setShowTrade(true)}
        className="border-b-2 border-transparent pb-0.5 text-slate-300 transition-colors hover:text-white"
      >
        Nouveau trade
      </button>
      {showTrade && <NouveauTrade onClose={() => setShowTrade(false)} />}
    </nav>
  )
}
