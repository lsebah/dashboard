// Espace CLIENT — destiné aux investisseurs & prospects (suivi, découverte,
// contact). Thème clair, rassurant (inspiration Revolut / BNP Banque Privée).
// Coquille premium : l'espace est livré en profondeur à la prochaine itération
// (le 1er livrable porte sur le terminal CMF).

const FEATURES: { titre: string; items: string[]; icone: string; accent: string }[] = [
  {
    titre: 'Suivi de portefeuille',
    icone: '📈',
    accent: 'from-sky-500 to-blue-600',
    items: ['Valorisation en temps réel', 'P/L & performance historique', 'Produits détenus', 'Historique des opérations'],
  },
  {
    titre: 'Mes documents',
    icone: '📄',
    accent: 'from-emerald-500 to-teal-600',
    items: ['Relevés & reportings', 'Termsheets & DICI', 'Avis d’opéré', 'Téléchargement sécurisé'],
  },
  {
    titre: 'Découverte produits',
    icone: '✨',
    accent: 'from-violet-500 to-indigo-600',
    items: ['Solutions d’investissement', 'Fiches produits détaillées', 'Simulateurs de rendement', 'Documents à télécharger'],
  },
  {
    titre: 'Contact & rendez-vous',
    icone: '🤝',
    accent: 'from-amber-500 to-orange-600',
    items: ['Formulaire premium', 'Prise de rendez-vous', 'Échange avec un conseiller', 'Envoi de documents'],
  },
]

export default function ClientSpacePage() {
  return (
    <div className="lc2-rise overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 text-slate-900 shadow-2xl">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-8 py-12 text-white sm:px-12">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-blue-200 ring-1 ring-inset ring-white/15">
            Espace investisseur
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            Votre patrimoine structuré,
            <br className="hidden sm:block" /> clair et accessible.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-blue-100/80">
            Suivez vos investissements, accédez à vos documents et échangez avec votre conseiller dans
            un espace simple, rassurant et sécurisé.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="mailto:office@cmf.finance?subject=Demande%20de%20rendez-vous%20%E2%80%94%20Espace%20Client"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow transition hover:bg-blue-50"
            >
              Demander un rendez-vous
            </a>
            <a
              href="/lifecycle2"
              className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Voir le terminal CMF
            </a>
          </div>
        </div>
      </div>

      {/* Aperçu des fonctionnalités */}
      <div className="px-8 py-10 sm:px-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Ce que vous trouverez ici</h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-700">
            En cours de construction
          </span>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.titre}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-lg shadow`}
              >
                {f.icone}
              </div>
              <h3 className="font-semibold text-slate-800">{f.titre}</h3>
              <ul className="mt-2 space-y-1.5 text-[13px] text-slate-500">
                {f.items.map((it) => (
                  <li key={it} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-blue-500">›</span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[13px] text-slate-400">
          L’espace Client sera livré à la prochaine itération. Le terminal de gestion{' '}
          <a href="/lifecycle2" className="font-medium text-blue-600 hover:underline">
            CMF
          </a>{' '}
          est déjà opérationnel.
        </p>
      </div>
    </div>
  )
}
