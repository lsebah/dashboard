'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import NouveauTrade from '@/app/lifecycle/components/NouveauTrade'

const TABS: { name: string; href: string }[] = [
  { name: 'Synthèse', href: '/lifecycle2' },
  { name: 'Portefeuille', href: '/lifecycle2/portefeuille' },
  { name: 'Calendrier', href: '/lifecycle2/calendrier' },
  { name: 'Décrément', href: '/lifecycle2/decrement' },
  { name: 'FRN', href: '/lifecycle2/frn' },
  { name: 'iTraxx', href: '/lifecycle2/itraxx' },
  { name: 'Commissions', href: '/lifecycle2/commissions' },
  { name: 'Bloomberg', href: '/lifecycle2/bloomberg' },
  { name: 'Client', href: '/lifecycle2/client' },
]

/** Barre de navigation horizontale (style fonction-terminal) — accent orange. */
export default function Lifecycle2Nav() {
  const path = usePathname()
  const [showTrade, setShowTrade] = useState(false)
  return (
    <nav className="-mb-px flex items-center gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = t.href === '/lifecycle2' ? path === '/lifecycle2' : path.startsWith(t.href)
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active
                ? 'border-cmf-navy text-cmf-navy'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {t.name}
          </a>
        )
      })}
      <button
        onClick={() => setShowTrade(true)}
        className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
      >
        Nouveau trade
      </button>
      {showTrade && <NouveauTrade onClose={() => setShowTrade(false)} />}
    </nav>
  )
}
