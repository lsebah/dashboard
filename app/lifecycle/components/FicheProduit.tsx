'use client'
// ─────────────────────────────────────────────────────────────────────────
//  FICHE PRODUIT PARTAGÉE — « je clique sur un ISIN, je vois le produit ».
//
//  Le même geste doit marcher dans Portefeuille, Commissions, Calendrier et
//  Deal Done. Jusqu'ici il n'existait que là où l'onglet avait déjà les
//  produits sous la main : Commissions et Deal Done ne lisent que le registre
//  et leur JSON, et leurs ISIN étaient du texte mort.
//
//  La fiche est chargée à la demande depuis /api/lifecycle/fiche, qui sert
//  lib/fiches.ts — la source unique. Les onglets n'ont donc rien à importer
//  du portefeuille pour rendre un ISIN cliquable.
//
//  `IsinLink` accepte un `onOuvrir` : Portefeuille et Calendrier ont déjà une
//  popup plus riche (assignation client, reconstruction, « marquer rappelé »,
//  prix augmentés). Elles gardent la leur — l'ISIN y a la même apparence et le
//  même geste, sans perdre ce qu'elles savaient faire en plus.
// ─────────────────────────────────────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Product } from '@/lib/types'
import { useAugmentedProduct } from '@/lib/useProductLevels'
import Modal from './Modal'
import ProductSynopsis from './ProductSynopsis'

interface FicheApi {
  isin: string
  connu: boolean
  produit?: Product
  clients: string[]
  dateTraite: string | null
  termsheet?: string
  libelle: string
  commissions: { client: string | null; emetteur: string | null; description: string | null }[]
}

const Ctx = createContext<{ ouvrir: (isin: string) => void }>({ ouvrir: () => {} })

/** Ouvre la fiche d'un ISIN depuis n'importe quel onglet Lifecycle. */
export function useFicheProduit() {
  return useContext(Ctx)
}

const dateFr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')

/** Repli quand l'ISIN est connu du registre mais qu'aucune TS n'a été décodée. */
function FicheMinimale({ f }: { f: FicheApi }) {
  const l = f.commissions[0]
  return (
    <div className="card p-4 text-sm">
      <div className="font-mono text-[13px] text-slate-500">{f.isin}</div>
      <div className="mt-1 text-lg font-semibold text-cmf-navy">{f.libelle}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-slate-500">Émetteur</dt>
        <dd>{l?.emetteur ?? '—'}</dd>
        <dt className="text-slate-500">Traité le</dt>
        <dd>{dateFr(f.dateTraite)}</dd>
        <dt className="text-slate-500">Client(s)</dt>
        <dd>{f.clients.join(', ') || '—'}</dd>
      </dl>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        Ce produit est connu du registre des commissions, mais sa termsheet n’a pas encore été
        décodée : mécanique, barrières et calendrier sont donc absents. Rien n’est reconstitué ici.
      </p>
      {f.termsheet && (
        <a
          href={f.termsheet}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-[13px] text-cmf-blue hover:underline"
        >
          📄 Termsheet ↗
        </a>
      )}
    </div>
  )
}

export function FicheProduitProvider({ children }: { children: React.ReactNode }) {
  const [isin, setIsin] = useState<string | null>(null)
  const [f, setF] = useState<FicheApi | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const ouvrir = useCallback((i: string) => {
    setIsin(i)
    setF(null)
    setErreur(null)
  }, [])
  const fermer = useCallback(() => setIsin(null), [])

  useEffect(() => {
    if (!isin) return
    let vivant = true
    fetch(`/api/lifecycle/fiche?isin=${encodeURIComponent(isin)}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json()
        if (!vivant) return
        if (r.ok) setF(j as FicheApi)
        else setErreur(`Aucune fiche pour ${isin} — ni produit décodé, ni ligne au registre.`)
      })
      .catch(() => vivant && setErreur('Fiche indisponible (réseau).'))
    return () => {
      vivant = false
    }
  }, [isin])

  // La TS du dossier ne figure pas toujours sur le produit lui-même : on la lui
  // rattache pour que le synopsis affiche le lien comme partout ailleurs.
  const produit: Product | null = f?.produit
    ? { ...f.produit, termsheetUrl: f.produit.termsheetUrl ?? f.termsheet }
    : null
  const augmente = useAugmentedProduct(produit)

  return (
    <Ctx.Provider value={{ ouvrir }}>
      {children}
      <Modal
        open={!!isin}
        onClose={fermer}
        title={f ? `${f.libelle} · ${f.isin}` : (isin ?? '')}
      >
        {erreur ? (
          <div className="card p-4 text-sm text-slate-600">{erreur}</div>
        ) : !f ? (
          <div className="card p-4 text-sm text-slate-500">Chargement…</div>
        ) : augmente ? (
          <ProductSynopsis product={augmente} />
        ) : (
          <FicheMinimale f={f} />
        )}
      </Modal>
    </Ctx.Provider>
  )
}

/**
 * ISIN cliquable. Même apparence partout — c'est ce qui rend le geste
 * découvrable : un ISIN souligné en pointillés s'ouvre, où qu'il se trouve.
 */
export function IsinLink({
  isin,
  onOuvrir,
  className = '',
}: {
  isin: string
  /** Popup locale, quand l'onglet en a déjà une plus riche. */
  onOuvrir?: (isin: string) => void
  className?: string
}) {
  const { ouvrir } = useFicheProduit()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        ;(onOuvrir ?? ouvrir)(isin)
      }}
      className={`font-mono underline decoration-dotted underline-offset-2 hover:text-cmf-blue ${className}`}
      title={`Voir la fiche ${isin}`}
    >
      {isin}
    </button>
  )
}
