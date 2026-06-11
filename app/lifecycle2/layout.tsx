import type { Metadata } from 'next'
import SpaceTabs from './components/SpaceTabs'

export const metadata: Metadata = {
  title: 'LIFECYCLE 2 — Terminal CMF',
  description:
    'Plateforme de gestion et de suivi des produits structurés — Capital Management France. Espace CMF (terminal financier) & espace Client.',
}

export default function Lifecycle2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lc2-root min-h-screen text-slate-200">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1700px] px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <a
                href="/"
                title="Retour au Dashboard"
                className="text-slate-500 transition-colors hover:text-white"
              >
                ←
              </a>
              <div className="flex items-baseline gap-2">
                <span className="bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-xl font-black tracking-[0.18em] text-transparent">
                  LIFECYCLE
                </span>
                <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[11px] font-bold text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
                  2
                </span>
              </div>
              <span className="hidden text-[11px] uppercase tracking-[0.2em] text-slate-600 md:inline">
                Capital Management France
              </span>
            </div>
            <SpaceTabs />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1700px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
