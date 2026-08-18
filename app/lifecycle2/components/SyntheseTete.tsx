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
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Product } from '@/lib/types'
import { Panel, ACCENT } from './charts'
import { bilanRappels, nominalParDevise } from '@/lib/autocall-proche'
import { dateFr } from '@/lib/dates'
import { pourcent, ESPACE_FINE } from '@/lib/pourcentage'
import Modal from '@/app/lifecycle/components/Modal'
import ProductSynopsis from '@/app/lifecycle/components/ProductSynopsis'
import { useAugmentedProduct } from '@/lib/useProductLevels'
import { useAllocations } from '@/lib/allocations'

interface MarketItem {
  group: string
  name: string
  symbol: string
  unit: string
  price: number | null
  change: number | null
  changePct: number | null
  marketState: string
  /** Provenance des taux qui n'ont pas de cotation Yahoo (CMS10, OAT10). */
  source?: 'stooq' | 'bloomberg'
}

const eur0 = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })

/** Change, volatilité, commodités retenus en Synthèse (cf. `divers` plus bas). */
const DIVERS_SYMBOLES = new Set(['EURUSD=X', '^VIX', 'GC=F', 'CL=F'])

/**
 * Niveau lisible d'un instrument « divers » — décimales adaptées à sa nature :
 * un cours de change se lit à 4 décimales, un indice de volatilité à 2, une
 * commodité en gros chiffres ronds. Toujours en virgule française.
 */
function niveauDivers(it: MarketItem): string {
  if (it.price == null) return '—'
  if (it.symbol === 'EURUSD=X') return it.price.toFixed(4).replace('.', ',')
  if (it.symbol === '^VIX') return it.price.toFixed(2).replace('.', ',')
  // Commodités ($) : gros chiffres ronds au-delà de 1000 (or), deux décimales
  // en dessous (WTI) — même seuil que le reste du site.
  const decimales = it.price >= 1000 ? 0 : 2
  return `${it.price.toLocaleString('fr-FR', { maximumFractionDigits: decimales, minimumFractionDigits: decimales })}${ESPACE_FINE}$`
}

/**
 * Box de marché — même habillage que StatCard (barre d'accent navy, libellé en
 * petites capitales slate-500) mais compacte : plusieurs par ligne, comme dans
 * la maquette. Le CONTENU diffère volontairement entre un indice et un taux :
 *   • un INDICE n'affiche PAS son niveau — un point d'indice ne se lit pas
 *     hors contexte —, seulement sa variation, colorée ;
 *   • un TAUX affiche son NIVEAU — c'est lui la donnée utile — et sa variation
 *     seulement quand la source la fournit (jamais pour CMS10/OAT10, qui n'ont
 *     pas de clôture de veille).
 */
function MarcheBox({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="lc2-kpi lc2-rise relative overflow-hidden px-3 py-2.5" title={title}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: ACCENT }} />
      <div className="lc2-label truncate">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/** Variation colorée — même code que le delta de StatCard (▲/▼, emerald/red-700). */
function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-sm font-bold text-slate-300">—</span>
  const up = pct >= 0
  return (
    <span className={`text-sm font-bold tabular-nums ${up ? 'text-emerald-700' : 'text-red-700'}`}>
      {up ? '▲' : '▼'} {pourcent(Math.abs(pct), 2)}
    </span>
  )
}

export default function SyntheseTete({ products }: { products: Product[] }) {
  // Statuts forcés (rappelé / vendu…) : la page les LIT — sinon un produit marqué
  // ailleurs continuerait d'apparaître ici comme vivant — et les ÉCRIT.
  const { statut: statutMap, setStatut } = useAllocations()
  const produits = useMemo(
    () => products.map((p) => (statutMap[p.isin] ? { ...p, statut: statutMap[p.isin] } : p)),
    [products, statutMap],
  )

  /**
   * Acte le rappel : statut « rappelé » + notification à L.sebah@cmf.finance.
   * Même geste et même endpoint idempotent que dans le Portefeuille — recliquer
   * n'envoie pas un second email.
   */
  const marquerRappele = (isin: string) => {
    setStatut(isin, 'rappele')
    void fetch('/api/notifications/rappel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isin }),
    }).catch(() => {})
  }

  // Fiche produit ouverte depuis la liste des rappels.
  const [ouvert, setOuvert] = useState<Product | null>(null)
  const augmente = useAugmentedProduct(ouvert)
  const parIsin = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of produits) m.set(p.isin, p)
    return m
  }, [produits])

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
        if (!annule) setMarches(items)
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

  const indices = useMemo(() => marches?.filter((i) => i.group === 'Indices') ?? [], [marches])
  const taux = useMemo(
    () =>
      marches?.filter(
        (i) => (i.group === 'Taux souverains US' && i.name === 'US 10Y') || i.group === 'Taux EUR',
      ) ?? [],
    [marches],
  )
  // Change, volatilité, commodités : quatre instruments précis (pas les groupes
  // entiers — cinq paires de change ou quatre commodités auraient noyé le
  // tableau). Contrairement à un indice, leur NIVEAU se lit seul : un cours
  // EUR/USD ou un prix de l'or ont un sens hors contexte.
  const divers = useMemo(
    () => marches?.filter((i) => DIVERS_SYMBOLES.has(i.symbol)) ?? [],
    [marches],
  )

  const bilan = useMemo(
    () => (niveaux ? bilanRappels(produits, niveaux, constates, new Date(), 30) : null),
    [produits, niveaux, constates],
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
      aActer: !c.acte,
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
      // Un rappel probable n'est pas encore un fait : rien à acter.
      aActer: false,
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
    <div className="flex flex-col gap-4">
      {/* ── 1. Marchés — indices (variation seule) puis taux (niveau), en
             BOX comme sur la page d'accueil, mais dans le code couleur de
             Lifecycle (fond blanc, barre d'accent navy) et non le thème sombre
             de l'accueil. Pleine largeur : le Rappels passe dessous. ────── */}
      <Panel title="Marchés" sub="indices & taux · run quotidien">
        {marches === null ? (
          <p className="py-6 text-center text-[13px] text-slate-400">Chargement des niveaux…</p>
        ) : indices.length === 0 && taux.length === 0 && divers.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">
            Niveaux indisponibles — aucun chiffre n&apos;est affiché plutôt qu&apos;un chiffre périmé.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {indices.map((it) => (
              <MarcheBox key={it.symbol} label={it.name}>
                <Delta pct={it.changePct} />
              </MarcheBox>
            ))}
            {taux.map((t) => (
              <MarcheBox
                key={t.symbol}
                label={t.name}
                title={t.source ? `Source : ${t.source}` : undefined}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {t.price == null ? '—' : pourcent(t.price, 2)}
                  </span>
                  {t.changePct != null && (
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        t.changePct >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {t.changePct >= 0 ? '▲' : '▼'} {pourcent(Math.abs(t.changePct), 2)}
                    </span>
                  )}
                </div>
              </MarcheBox>
            ))}
            {/* Change, volatilité, commodités : niveau ET variation, comme les
                taux — ce sont des nombres qui se lisent seuls, contrairement à
                un point d'indice. */}
            {divers.map((it) => (
              <MarcheBox key={it.symbol} label={it.name}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {niveauDivers(it)}
                  </span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      it.changePct == null
                        ? 'text-slate-400'
                        : it.changePct >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                    }`}
                  >
                    {it.changePct == null
                      ? '—'
                      : `${it.changePct >= 0 ? '▲' : '▼'} ${pourcent(Math.abs(it.changePct), 2)}`}
                  </span>
                </div>
              </MarcheBox>
            ))}
          </div>
        )}
      </Panel>

      {/* ── 2. Rappels : 30 jours passés + 30 jours à venir, une seule ligne
             de temps. Deux onglets auraient obligé à cliquer pour comparer ce
             qui vient de tomber et ce qui va tomber — or c'est justement la
             comparaison qui informe. Pleine largeur, sous les marchés. ──── */}
      <Panel
        title="Rappels — 30 jours de part et d'autre"
        sub="ce qui vient d'être rappelé, et ce qui va probablement l'être"
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
                        {l.aActer ? (
                          // Le clic sur la ligne ouvre la fiche : on arrête la
                          // propagation, sinon acter ouvrirait aussi la modale.
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              marquerRappele(l.isin)
                            }}
                            className="rounded border border-violet-300 bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-200"
                            title="Marquer ce produit « rappelé » au portefeuille et notifier L.sebah@cmf.finance"
                          >
                            ✓ Acter le rappel
                          </button>
                        ) : (
                          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${l.etatCls}`}>{l.etat}</span>
                        )}
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
                  — {pourcent(c.niveau, 2)} vs {pourcent(c.barriere, 2)} · {eur0(c.nominal)} {c.devise}{' '}
                  <button
                    onClick={() => marquerRappele(c.isin)}
                    className="ml-1 rounded border border-violet-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-100"
                    title="Marquer « rappelé » au portefeuille et notifier L.sebah@cmf.finance"
                  >
                    ✓ Acter
                  </button>
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
