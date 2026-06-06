'use client'

import { useState } from 'react'
import type { ClientAlloc } from '@/lib/allocations'
import { formatMontant } from '@/lib/lifecycle'

/** Affectation de clients à un produit (saisie locale, non versionnée). */
export default function ClientAssign({
  allocs,
  devise,
  onChange,
}: {
  allocs: ClientAlloc[]
  devise: string
  onChange: (next: ClientAlloc[]) => void
}) {
  const [client, setClient] = useState('')
  const [montant, setMontant] = useState('')

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

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-cmf-navy text-sm">Allocation client</h3>
        <span className="text-[10px] text-slate-400">local — non versionné</span>
      </div>

      {allocs.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {allocs.map((a) => (
            <li
              key={a.client}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2 py-1 text-xs"
            >
              <span className="font-medium text-slate-700">{a.client}</span>
              {typeof a.montant === 'number' && (
                <span className="text-slate-500 tabular-nums">
                  {formatMontant(a.montant, devise)}
                </span>
              )}
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
