import type { Metadata } from 'next'
import Lifecycle2Nav from './components/Lifecycle2Nav'

export const metadata: Metadata = {
  title: 'LIFECYCLE 2 — Terminal CMF',
  description:
    'Plateforme de gestion et de suivi des produits structurés — Capital Management France. Terminal financier premium (synthèse, portefeuille, calendrier, comparatif, commissions, Bloomberg).',
}

export default function Lifecycle2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lc2-root min-h-screen text-slate-800">
      <header className="sticky top-0 z-30 border-b border-[#e2e6ec] bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1700px] px-4 sm:px-6">
          {/* Ligne 1 — marque */}
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <a href="/" title="Retour au Dashboard" className="text-slate-400 transition-colors hover:text-slate-700">
                ←
              </a>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold tracking-[0.22em] text-cmf-navy">LIFECYCLE</span>
                <span className="rounded-sm bg-cmf-navy px-1.5 py-0.5 text-[11px] font-bold text-white">2</span>
              </div>
              <span className="hidden text-[11px] uppercase tracking-[0.2em] text-slate-400 md:inline">
                Capital Management France
              </span>
            </div>
            <span className="hidden items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-cmf-navy" />
              Terminal
            </span>
          </div>
          {/* Ligne 2 — navigation */}
          <Lifecycle2Nav />
        </div>
      </header>
      <main className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  )
}
