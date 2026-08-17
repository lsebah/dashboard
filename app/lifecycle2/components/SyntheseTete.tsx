'use client'

// ─────────────────────────────────────────────────────────────────────────
//  Tête de la Synthèse — ce qu'on regarde AVANT le reste.
//
//    1. les indices du run quotidien : où est le marché ce matin ;
//    2. les produits dont le rappel est probable sous 30 jours : ce qui va
//       bouger dans le livre, et le nominal que ça remet en jeu.
//
//  Les deux blocs se chargent indépendamment : un marché indisponible ne doit
//  pas masquer la liste des rappels, qui est la partie actionnable.
// ─────────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import { Panel } from './charts'
import { bilanRappels, nominalParDevise } from '@/lib/autocall-proche'
import { dateFr } from '@/lib/dates'
import { pourcent, pourcentSigne } from '@/lib/pourcentage'
import Modal from '@/app/lifecycle/components/Modal'
import ProductSynopsis from '@/app/lifecycle/components/ProductSynopsis'
import { useAugmentedProduct } from '@/lib/useProductLevels'

interface MarketItem {
  group: string
  name: string
  symbol: string
  unit: string
  price: number | null
  change: number | null
  changePct: number | null
  marketState: string
}

const eur0 = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
const niveauFmt = (it: MarketItem): string => {
  if (it.price == null) return '—'
  if (it.group === 'Change') return it.price.toFixed(4)
  if (it.unit === '%') return pourcent(it.price, 2)
  return it.price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}
const signeClasse = (n: number | null) =>
  n == null ? 'text-slate-400' : n >= 0 ? 'text-emerald-600' : 'text-red-600'

export default function SyntheseTete({ products }: { products: Product[] }) {
  // Fiche produit ouverte depuis la liste des rappels.
  const [ouvert, setOuvert] = useState<Product | null>(null)
  const augmente = useAugmentedProduct(ouvert)
  const parIsin = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.isin, p)
    return m
  }, [products])

  const [marches, setMarches] = useState<MarketItem[] | null>(null)
  const [niveaux, setNiveaux] = useState<Record<string, number | null> | null>(null)
  // Niveaux CONSTATÉS aux observations passées, par ISIN — sans eux, un produit
  // rappelé il y a deux mois s'affiche encore comme « rappel probable ».
  const [constates, setConstates] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    let annule = false
    // Même source que l'onglet Bloomberg (/api/lifecycle/markets) : un seul
    // jeu de niveaux pour tout le site, filtré ici sur les indices.
    fetch('/api/lifecycle/markets', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const items: MarketItem[] = Array.isArray(j?.items) ? j.items : []
        if (!annule) setMarches(items.filter((i) => i.group === 'Indices'))
      })
      .catch(() => {
        // Marché indisponible : le bloc le dit, il n'affiche pas de faux niveau.
        if (!annule) setMarches([])
      })
    // Niveaux courants de TOUS les produits en une requête (worst-of agrégé
    // selon le type de panier, côté serveur).
    fetch('/api/lifecycle/courant', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (annule) return
        const c = (j?.courant ?? {}) as Record<
          string,
          { worstOf: number | null; niveaux?: Record<string, number> }
        >
        const m: Record<string, number | null> = {}
        const n: Record<string, Record<string, number>> = {}
        for (const isin of Object.keys(c)) {
          m[isin] = c[isin]?.worstOf ?? null
          if (c[isin]?.niveaux) n[isin] = c[isin].niveaux as Record<string, number>
        }
        setNiveaux(m)
        setConstates(n)
      })
      .catch(() => {
        if (!annule) setNiveaux({})
      })
    return () => {
      annule = true
    }
  }, [])

  const bilan = useMemo(
    () => (niveaux ? bilanRappels(products, niveaux, constates, new Date(), 30) : null),
    [products, niveaux, constates],
  )
  // Une seule ligne de temps : passé et à venir dans le même tableau, séparés
  // par un repère « aujourd'hui ». Les deux moitiés partagent les mêmes colonnes.
  const lignes = useMemo(() => {
    if (!bilan) return []
    const passe = bilan.passes.map((c) => ({
      isin: c.isin,
      nom: c.nom,
      date: c.date,
      jours: c.joursDepuis,
      futur: false,
      niveau: c.niveau,
      barriere: c.barriere,
      marge: Math.round((c.niveau - c.barriere) * 100) / 100,
      nominal: c.nominal,
      devise: c.devise,
      clients: c.clients,
      inverse: false,
      etat: c.acte ? 'Rappelé' : 'Rappelé · à confirmer',
      etatCls: c.acte ? 'bg-slate-100 text-slate-700' : 'bg-violet-100 text-violet-700',
    }))
    const futur = bilan.probables.map((a) => ({
      isin: a.isin,
      nom: a.nom,
      date: a.dateObservation,
      jours: a.joursRestants,
      futur: true,
      niveau: a.niveau,
      barriere: a.barriere,
      marge: a.marge,
      nominal: a.nominal,
      devise: a.devise,
      clients: a.clients,
      inverse: a.inverse,
      etat: 'Probable',
      etatCls: 'bg-emerald-100 text-emerald-800',
    }))
    // Chronologique : le plus ancien en haut, l'à-venir en bas. Le passé récent
    // et l'imminent se retrouvent ainsi de part et d'autre du repère.
    return [...passe.reverse(), ...futur]
  }, [bilan])
  const indexAujourdHui = bilan?.passes.length ?? 0
  const exposition = useMemo(
    () => (bilan ? nominalParDevise(bilan.probables) : {}),
    [bilan],
  )
  const devises = (l: { nominal: number; devise: string }[]) =>
    Object.entries(nominalParDevise(l))
      .map(([d, n]) => `${eur0(n)} ${d}`)
      .join(' · ')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* ── 1. Indices ────────────────────────────────────────────────── */}
      <Panel title="Indices" sub="run quotidien · niveaux de clôture ou temps réel">
        {marches === null ? (
          <p className="py-6 text-center text-[13px] text-slate-400">Chargement des niveaux…</p>
        ) : marches.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">
            Niveaux indisponibles — aucun chiffre n&apos;est affiché plutôt qu&apos;un chiffre périmé.
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-slate-100">
              {marches.map((it) => (
                <tr key={it.symbol}>
                  <td className="py-1.5 pr-2 text-slate-600">{it.name}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">
                    {niveauFmt(it)}
                  </td>
                  <td className={`w-20 py-1.5 pl-2 text-right tabular-nums whitespace-nowrap ${signeClasse(it.changePct)}`}>
                    {it.changePct == null ? '—' : pourcentSigne(it.changePct, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* ── 2. Rappels : 30 jours passés + 30 jours à venir, une seule ligne
             de temps. Deux onglets auraient obligé à cliquer pour comparer ce
             qui vient de tomber et ce qui va tomber — or c'est justement la
             comparaison qui informe. ─────────────────────────────────────── */}
      <Panel
        title="Rappels — 30 jours de part et d'autre"
        sub="ce qui vient d'être rappelé, et ce qui va probablement l'être"
        className="lg:col-span-2"
        right={
          bilan ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {bilan.passes.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {bilan.passes.length} rappelé{bilan.passes.length > 1 ? 's' : ''} · {devises(bilan.passes)}
                </span>
              )}
              {bilan.probables.length > 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  {bilan.probables.length} probable{bilan.probables.length > 1 ? 's' : ''} · {devises(bilan.probables)}
                </span>
              )}
            </span>
          ) : undefined
        }
      >
        {bilan === null ? (
          <p className="py-6 text-center text-[13px] text-slate-400">Calcul des niveaux courants…</p>
        ) : lignes.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">
            Aucun rappel dans les 30 jours passés, aucun probable dans les 30 à venir.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-2 font-medium">Observation</th>
                  <th className="py-1.5 pr-2 font-medium">ISIN</th>
                  <th className="py-1.5 pr-2 font-medium">Produit</th>
                  <th className="py-1.5 pr-2 font-medium">Client</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Niveau</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Barrière</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Écart</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Nominal</th>
                  <th className="py-1.5 font-medium">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignes.map((l, i) => (
                  <Fragment key={`${l.isin}|${l.date}`}>
                    {/* Repère : la frontière entre l'acquis et l'estimé. */}
                    {i === indexAujourdHui && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={9} className="py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          — aujourd&apos;hui —
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => setOuvert(parIsin.get(l.isin) ?? null)}
                      className={`cursor-pointer ${l.futur ? 'hover:bg-emerald-50/40' : 'hover:bg-slate-50'}`}
                      title="Ouvrir la fiche produit"
                    >
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {dateFr(l.date)}
                        <span className="ml-1.5 text-[11px] text-slate-400">
                          {l.jours === 0 ? 'auj.' : l.futur ? `J−${l.jours}` : `J+${l.jours}`}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 font-mono text-[12px] whitespace-nowrap">{l.isin}</td>
                      <td className="max-w-[220px] truncate py-1.5 pr-2 text-slate-600" title={l.nom}>
                        {l.nom}
                        {l.inverse && (
                          <span
                            className="ml-1.5 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-medium text-violet-700"
                            title="Autocall inverse — le rappel se déclenche à la baisse"
                          >
                            inverse
                          </span>
                        )}
                      </td>
                      <td
                        className="max-w-[140px] truncate py-1.5 pr-2 text-slate-600"
                        title={l.clients.length ? l.clients.join(' · ') : undefined}
                      >
                        {l.clients.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : l.clients.length === 1 ? (
                          l.clients[0]
                        ) : (
                          <>
                            {l.clients[0]}
                            <span className="ml-1 text-[11px] text-slate-400">+{l.clients.length - 1}</span>
                          </>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums font-medium whitespace-nowrap">
                        {pourcent(l.niveau, 2)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap text-slate-500">
                        {pourcent(l.barriere, 2)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap font-semibold text-emerald-700">
                        +{l.marge.toFixed(2).replace('.', ',')} pt
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">
                        {eur0(l.nominal)} {l.devise}
                      </td>
                      <td className="py-1.5 whitespace-nowrap">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${l.etatCls}`}>{l.etat}</span>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">
              Passé : barrière franchie à une observation constatée. À venir : estimation au niveau
              courant du panier — une observation peut encore être démentie d&apos;ici là.
            </p>
          </div>
        )}

        {/* Anomalie qui ne se périme pas : rappel déclenché, produit non marqué. */}
        {bilan && bilan.aConfirmer.length > 0 && (
          <div className="mt-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-900">
            <strong>{bilan.aConfirmer.length} rappel(s) constaté(s) non actés</strong> — la barrière a été
            franchie, le produit n&apos;est pas encore marqué « rappelé » au portefeuille.
            <ul className="mt-1 space-y-0.5">
              {bilan.aConfirmer.map((c) => (
                <li key={c.isin}>
                  <button
                    onClick={() => setOuvert(parIsin.get(c.isin) ?? null)}
                    className="underline decoration-dotted hover:text-violet-700"
                  >
                    {dateFr(c.date)} · {c.isin} · {c.nom}
                  </button>{' '}
                  — {pourcent(c.niveau, 2)} vs {pourcent(c.barriere, 2)} · {eur0(c.nominal)} {c.devise}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Périmètre : ce que la liste n'a PAS pu trancher. Sans cette ligne, un
            produit invisible passe pour un produit calme. */}
        {bilan && (bilan.nonEvalues.length > 0 || bilan.nbNonCall > 0) && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            Périmètre :{' '}
            {bilan.nbNonCall > 0 && (
              <>
                <strong>{bilan.nbNonCall}</strong> produit(s) observés mais en période de non-call (rappel
                impossible){bilan.nonEvalues.length > 0 ? ' · ' : '.'}
              </>
            )}
            {bilan.nonEvalues.length > 0 && (
              <>
                <strong>{bilan.nonEvalues.length}</strong> non évalué(s) :{' '}
                {bilan.nonEvalues.map((x, i) => (
                  <span key={x.isin}>
                    {i > 0 && ', '}
                    <button
                      onClick={() => setOuvert(parIsin.get(x.isin) ?? null)}
                      className="underline decoration-dotted hover:text-slate-800"
                      title={`${x.nom} — observation le ${dateFr(x.dateObservation)}`}
                    >
                      {x.isin}
                    </button>
                    <span className="text-slate-400"> ({x.motif})</span>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        )}
      </Panel>

      {/* Fiche produit — mêmes composants que le Portefeuille, niveaux live. */}
      <Modal open={!!ouvert} onClose={() => setOuvert(null)} title={ouvert?.nom} wide>
        {augmente ? (
          <div className="rounded-lg bg-white p-4 shadow-xl">
            <ProductSynopsis product={augmente} />
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 text-center text-[13px] text-slate-400 shadow-xl">
            Chargement de la fiche…
          </div>
        )}
      </Modal>
    </div>
  )
}
