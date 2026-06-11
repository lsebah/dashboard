'use client'

import { usePathname } from 'next/navigation'

const TABS = [
  { name: 'CMF', href: '/lifecycle2', desc: 'Gestion & suivi' },
  { name: 'Client', href: '/lifecycle2/client', desc: 'Espace investisseur' },
]

/** Bascule premium entre les deux espaces (CMF / Client). */
export default function SpaceTabs() {
  const path = usePathname()
  return (
    <nav className="flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-sm">
      {TABS.map((t) => {
        const active = t.href === '/lifecycle2' ? path === '/lifecycle2' : path.startsWith(t.href)
        return (
          <a
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            title={t.desc}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              active ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            {t.name}
          </a>
        )
      })}
    </nav>
  )
}
