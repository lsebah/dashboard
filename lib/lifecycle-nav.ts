// ─────────────────────────────────────────────────────────────────────────
//  STRUCTURE DE NAVIGATION DE LIFECYCLE — sections et sous-onglets.
//
//  Treize onglets sur une seule ligne, c'était une liste, pas une navigation :
//  rien ne disait ce qui allait avec quoi. Le découpage demandé par Laurent
//  (20/08/2026) regroupe par métier — ce qu'on suit (CMF), ce qu'on price
//  (Pricing), ce qu'on surveille (Runs), et l'outillage (Outils).
//
//  Données PURES, hors du composant : un test peut ainsi vérifier qu'aucune
//  page de l'app n'est orpheline de la navigation. Une page livrée sans
//  entrée de menu n'existe pas pour celui qui l'utilise.
// ─────────────────────────────────────────────────────────────────────────

export interface OngletNav {
  name: string
  href: string
  /** Lien hors Lifecycle : nouvel onglet, et signalé visuellement. */
  externe?: boolean
}

export interface SectionNav {
  cle: string
  nom: string
  onglets: OngletNav[]
}

export const SECTIONS: SectionNav[] = [
  {
    cle: 'cmf',
    nom: 'CMF',
    onglets: [
      { name: 'Synthèse', href: '/lifecycle2' },
      { name: 'Portefeuille', href: '/lifecycle2/portefeuille' },
      { name: 'Deal Done', href: '/lifecycle2/deal-done' },
      { name: 'Calendrier', href: '/lifecycle2/calendrier' },
      { name: 'Commissions', href: '/lifecycle2/commissions' },
    ],
  },
  {
    cle: 'pricing',
    nom: 'Pricing',
    onglets: [
      { name: 'RFQ', href: '/lifecycle2/rfq' },
      {
        name: 'Vizibility',
        href: 'https://cmf-extranet.com/dashboard/risk-analytics',
        externe: true,
      },
    ],
  },
  {
    cle: 'runs',
    nom: 'Runs',
    onglets: [
      { name: 'Décrément', href: '/lifecycle2/decrement' },
      { name: 'FRN', href: '/lifecycle2/frn' },
      { name: 'iTraxx', href: '/lifecycle2/itraxx' },
      // Le radar est un run de marché, pas un outil de pricing : il se lit
      // au même rythme que les décréments et les FRN (Laurent, 20/08/2026).
      { name: 'Radar de vol', href: '/lifecycle2/volatilite' },
    ],
  },
  {
    cle: 'outils',
    nom: 'Outils',
    onglets: [
      { name: 'Bloomberg', href: '/lifecycle2/bloomberg' },
      { name: 'Client', href: '/lifecycle2/client' },
      { name: 'Maintenance', href: '/lifecycle2/maintenance' },
    ],
  },
]

/** Un onglet est actif si l'URL courante lui correspond. */
export function estActif(href: string, path: string): boolean {
  if (href.startsWith('http')) return false
  // La Synthèse est la racine : `startsWith` la rendrait active partout.
  return href === '/lifecycle2' ? path === '/lifecycle2' : path.startsWith(href)
}

/** Section contenant la page courante ; CMF par défaut (la Synthèse y vit). */
export function sectionActive(path: string): SectionNav {
  return SECTIONS.find((s) => s.onglets.some((o) => estActif(o.href, path))) ?? SECTIONS[0]
}

/** Toutes les routes internes citées par la navigation. */
export function routesNav(): string[] {
  return SECTIONS.flatMap((s) => s.onglets.filter((o) => !o.externe).map((o) => o.href))
}
