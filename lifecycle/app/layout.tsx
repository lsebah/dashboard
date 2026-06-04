import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lifecycle CMF — Suivi des produits structurés',
  description:
    'Suivi du cycle de vie des produits structurés (prix, calendrier des observations, allocation client) — Capital Management France',
}

const tabs = [
  { name: 'Portefeuille', href: '/' },
  { name: 'Calendrier', href: '/calendrier' },
  { name: 'Nouveau produit', href: '/produits/nouveau' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        <header className="bg-cmf-navy text-white">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold tracking-tight">CMF</span>
              <span className="text-xs text-slate-300 uppercase tracking-widest">
                Lifecycle
              </span>
            </div>
            <nav className="flex items-center gap-6 text-sm">
              {tabs.map((t) => (
                <a
                  key={t.href}
                  href={t.href}
                  className="text-slate-200 hover:text-white transition-colors"
                >
                  {t.name}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  )
}
