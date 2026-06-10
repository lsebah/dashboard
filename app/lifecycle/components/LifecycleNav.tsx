'use client'

import { usePathname } from 'next/navigation'

const tabs = [
  { name: 'Portefeuille', href: '/lifecycle' },
  { name: 'Calendrier', href: '/lifecycle/calendrier' },
  { name: 'Comparatif', href: '/lifecycle/comparatif' },
  { name: 'Commissions', href: '/lifecycle/commissions' },
  { name: 'Bloomberg', href: '/lifecycle/bloomberg' },
  { name: 'Nouveau produit', href: '/lifecycle/produits/nouveau' },
]

/** Onglet courant mis en évidence (gras + soulignement) selon l'URL. */
export default function LifecycleNav() {
  const path = usePathname()
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
    </nav>
  )
}
