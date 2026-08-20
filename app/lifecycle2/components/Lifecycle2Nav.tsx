'use client'

import { usePathname } from 'next/navigation'
import { SECTIONS, estActif, sectionActive } from '@/lib/lifecycle-nav'

/**
 * Navigation en DEUX niveaux — sections, puis sous-onglets. La structure vit
 * dans lib/lifecycle-nav.ts (données pures, testées) ; ici, seul l'affichage.
 * La section active est celle qui contient la page courante : aucun état n'est
 * stocké, l'URL fait foi.
 */
export default function Lifecycle2Nav() {
  const path = usePathname()
  const section = sectionActive(path)

  return (
    <div className="flex flex-col">
      {/* Niveau 1 — sections */}
      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Sections">
        {SECTIONS.map((s) => {
          const actif = s.cle === section.cle
          return (
            <a
              key={s.cle}
              href={s.onglets[0].href}
              aria-current={actif ? 'true' : undefined}
              className={`whitespace-nowrap rounded-t px-3 py-1.5 text-[13px] font-semibold tracking-wide transition-colors ${
                actif
                  ? 'bg-cmf-navy text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {s.nom}
            </a>
          )
        })}
      </nav>

      {/* Niveau 2 — sous-onglets de la section active */}
      <nav className="-mb-px flex items-center gap-1 overflow-x-auto" aria-label={section.nom}>
        {section.onglets.map((o) => {
          const actif = estActif(o.href, path)
          const classe = `whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
            actif
              ? 'border-cmf-navy text-cmf-navy'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`
          return o.externe ? (
            <a
              key={o.href}
              href={o.href}
              target="_blank"
              rel="noopener noreferrer"
              className={classe}
              title="Ouvre Vizibility (Risk Analytics) dans un nouvel onglet"
            >
              {o.name} ↗
            </a>
          ) : (
            <a
              key={o.href}
              href={o.href}
              aria-current={actif ? 'page' : undefined}
              className={classe}
            >
              {o.name}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
