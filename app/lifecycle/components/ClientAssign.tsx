'use client'

import { useState } from 'react'
import type { ClientAlloc } from '@/lib/allocations'
import type { ProductStatus } from '@/lib/types'
import { parseTermsheetName } from '@/lib/termsheets'

const STATUTS: { value: ProductStatus; label: string; cls: string }[] = [
  { value: 'vivant', label: 'Vivant', cls: 'bg-emerald-600' },
  { value: 'vendu', label: 'Vendu', cls: 'bg-blue-600' },
  { value: 'rappele', label: 'Rappelé', cls: 'bg-violet-600' },
  { value: 'echu', label: 'Échu', cls: 'bg-slate-500' },
]

/** Affectation de clients à un produit (saisie locale, non versionnée). */
export default function ClientAssign({
  allocs,
  devise,
  onChange,
  statut,
  onStatut,
  nom,
  onNom,
  tsCible,
  tsActuel,
}: {
  allocs: ClientAlloc[]
  devise: string
  onChange: (next: ClientAlloc[]) => void
  statut?: ProductStatus
  onStatut?: (s: ProductStatus) => void
  nom?: string
  onNom?: (s: string) => void
  tsCible?: string
  tsActuel?: string
}) {
  const [client, setClient] = useState('')
  const [montant, setMontant] = useState('')
  const [nomDraft, setNomDraft] = useState(nom ?? '')
  const [copie, setCopie] = useState(false)

  const add = () => {
    const c = client.trim()
    if (!c) return
    const m = Number(montant.replace(/[^\d.]/g, ''))
    const next = [
      ...allocs.filter((a) => a.client !== c),
      { client: c, montant: Number.isFinite(m) && m > 0 ? m : undefined },
    ]
    onChange(next)
    setClient('')
    setMontant('')
  }

  const remove = (c: string) => onChange(allocs.filter((a) => a.client !== c))

  // Ajuste le montant investi d'un compte existant (saisie locale).
  const adjust = (c: string, raw: string) => {
    const m = Number(raw.replace(/[^\d.,]/g, '').replace(',', '.'))
    onChange(
      allocs.map((a) =>
        a.client === c ? { ...a, montant: Number.isFinite(m) && m > 0 ? m : undefined } : a,
      ),
    )
  }
  const cur = statut ?? 'vivant'

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-cmf-navy text-sm">Allocation client</h3>
        <span className="text-[11px] text-slate-400">synchronisé (tous appareils)</span>
      </div>

      {/* Renommage manuel du produit (nom d'affichage, local) */}
      {onNom && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="field-label">Nom affiché</label>
            <input
              className="input"
              value={nomDraft}
              onChange={(e) => setNomDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onNom(nomDraft)}
              placeholder="Renommer le produit…"
            />
          </div>
          <button
            onClick={() => onNom(nomDraft)}
            className="rounded-md bg-cmf-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            title="Renommer (local)"
          >
            Renommer
          </button>
        </div>
      )}

      {/* Statut : vendre / rappelé / vivant (forçage local) */}
      {onStatut && (
        <div className="flex items-center gap-2">
          <span className="field-label">Statut</span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
            {STATUTS.map((s) => (
              <button
                key={s.value}
                onClick={() => onStatut(s.value)}
                className={`px-2.5 py-1 transition-colors ${
                  cur === s.value ? `${s.cls} text-white` : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title={`Marquer « ${s.label} »`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {allocs.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {allocs.map((a) => (
            <li
              key={a.client}
              className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs"
            >
              <span className="font-medium text-slate-700 flex-1 truncate" title={a.client}>
                {a.client}
              </span>
              {/* Montant éditable par compte (commit à la sortie / Entrée). Le key
                  inclut le montant ⇒ l'input se réinitialise si la valeur change ailleurs. */}
              <input
                key={`${a.client}:${a.montant ?? ''}`}
                defaultValue={typeof a.montant === 'number' ? a.montant : ''}
                inputMode="numeric"
                placeholder="montant"
                className="input w-28 py-0.5 text-right tabular-nums"
                title={`Montant investi (${devise})`}
                onBlur={(e) => adjust(a.client, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
              />
              <span className="text-slate-400">{devise}</span>
              <button
                onClick={() => remove(a.client)}
                className="text-slate-400 hover:text-red-600"
                title="Retirer"
                aria-label={`Retirer ${a.client}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">Aucun client affecté pour l&apos;instant.</p>
      )}

      {/* Nom de fichier TS à la nomenclature (copier pour renommer sur OneDrive).
          Masqué dès que le fichier réel respecte déjà la convention : un fichier
          conforme ne doit plus proposer de renommage, même si le nom canonique
          régénéré diffère d'un libellé près. */}
      {tsCible && !(tsActuel && parseTermsheetName(tsActuel).conforme) && (
        <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-[12px]">
          <div className="field-label mb-0.5">Nom TS cible (nomenclature)</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-slate-700" title={tsCible}>{tsCible}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(tsCible).then(() => {
                  setCopie(true)
                  setTimeout(() => setCopie(false), 1500)
                })
              }}
              className="shrink-0 rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-600 hover:bg-slate-100"
            >
              {copie ? 'Copié ✓' : 'Copier'}
            </button>
          </div>
          {tsActuel && (
            <div className="mt-1 text-amber-600">Fichier actuel : {tsActuel} — à renommer</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="field-label">Client</label>
          <input
            className="input"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="ex. APPN - 05277"
          />
        </div>
        <div className="w-32">
          <label className="field-label">Montant ({devise})</label>
          <input
            className="input tabular-nums"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="optionnel"
            inputMode="numeric"
          />
        </div>
        <button
          onClick={add}
          className="rounded-md bg-cmf-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Ajouter
        </button>
      </div>
    </div>
  )
}
