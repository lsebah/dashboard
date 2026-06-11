'use client'

import { usePathname } from 'next/navigation'

const TABS: { name: string; href: string }[] = [
  { name: 'Synthèse', href: '/lifecycle2' },
  { name: 'Portefeuille', href: '/lifecycle2/portefeuille' },
  { name: 'Calendrier', href: '/lifecycle2/calendrier' },
  { name: 'Comparatif', href: '/lifecycle2/comparatif' },
  { name: 'Commissions', href: '/lifecycle2/commissions' },
  { name: 'Bloomberg', href: '/lifecycle2/bloomberg' },
  { name: 'Nouveau produit', href: '/lifecycle2/produits/nouveau' },
  { name: 'Client', href: '/lifecycle2/client' },
]

/** Barre de navigation horizontale (style fonction-terminal) — accent orange. */
export default function Lifecycle2Nav() {
  const path = usePathname()
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
    </nav>
  )
}
