import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lifecycle CMF — Suivi des produits structurés',
  description:
    'Suivi du cycle de vie des produits structurés (prix, calendrier des observations, allocation client) — Capital Management France',
}

const tabs = [
  { name: 'Portefeuille', href: '/lifecycle' },
  { name: 'Calendrier', href: '/lifecycle/calendrier' },
  { name: 'Nouveau produit', href: '/lifecycle/produits/nouveau' },
]

// Layout imbriqué : pas de <html>/<body> (fournis par le layout racine).
// Un conteneur en thème clair recouvre le fond sombre du Dashboard.
export default function LifecycleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-cmf-navy text-white">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-300 hover:text-white transition-colors" title="Retour au Dashboard">
              ←
            </a>
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
    </div>
  )
}
