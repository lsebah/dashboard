'use client'

import { useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import { computeDataHealth, type HealthItem } from '@/lib/data-health'

// Couleur d'une section selon sa criticité (vert si vide).
function tone(n: number, critique: boolean): string {
  if (n === 0) return 'border-emerald-200 bg-emerald-50'
  return critique ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
}

function Section({
  titre,
  desc,
  items,
  critique = false,
}: {
  titre: string
  desc: string
  items: HealthItem[]
  critique?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-lg border ${tone(items.length, critique)}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        disabled={items.length === 0}
      >
        <div>
          <div className="font-semibold text-cmf-navy">{titre}</div>
          <div className="text-[12px] text-slate-500">{desc}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`tabular-nums text-2xl font-bold ${items.length === 0 ? 'text-emerald-600' : critique ? 'text-red-600' : 'text-amber-600'}`}>
            {items.length}
          </span>
          {items.length > 0 && <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>}
        </div>
      </button>
      {open && items.length > 0 && (
        <div className="border-t border-white/60 max-h-[340px] overflow-auto">
          <table className="w-full text-[12px]">
            <tbody>
              {items.map((it) => (
                <tr key={it.isin} className="border-b border-white/60 last:border-0">
                  <td className="px-4 py-1.5 font-mono whitespace-nowrap">{it.isin}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">{it.type}</td>
                  <td className="px-2 py-1.5 max-w-[360px] truncate" title={it.nom}>{it.nom}</td>
                  <td className="px-4 py-1.5 whitespace-nowrap text-slate-400">{it.detail ?? it.statut ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Tableau de bord « santé des données » : trous du portefeuille en temps réel. */
export default function DataHealthView({ products }: { products: Product[] }) {
  const h = useMemo(() => computeDataHealth(products), [products])
  const complet =
    h.sansCoupon.length + h.sansTS.length + h.airbagSansNiveau.length + h.deviseSuspecte.length + h.typeNonIdentifie.length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cmf-navy">Santé des données</h1>
          <p className="text-sm text-slate-500 mt-1">
            {h.total} produits analysés · {complet === 0 ? 'aucun trou détecté ✓' : `${complet} points à compléter`}.
            Recalcul automatique à chaque chargement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section
          titre="Coupon manquant"
          desc="Athéna / Phoenix sans coupon p.a. — à décoder depuis la TS (aucune valeur inventée)."
          items={h.sansCoupon}
          critique
        />
        <Section
          titre="Termsheet absente"
          desc="Aucun PDF local, URL produit ou entrée d'index ne résout la TS."
          items={h.sansTS}
        />
        <Section
          titre="Niveau d'airbag non décodé"
          desc="Produit airbag dont la barrière de protection (PDI) manque → affiché « N/A »."
          items={h.airbagSansNiveau}
          critique
        />
        <Section
          titre="Devise incohérente"
          desc="Devise ≠ EUR alors que le libellé mentionne « EUR » — saisie à vérifier."
          items={h.deviseSuspecte}
        />
        <Section
          titre="Type non identifié"
          desc="Aucun type déductible du nom ni de la définition."
          items={h.typeNonIdentifie}
        />
      </div>

      <p className="text-[11px] text-slate-400">
        Les coupons manquants concernent surtout des produits non décodés (présents au feed, sans
        termes/calendrier). Leur complétion passe par la lecture des term sheets — jamais par une
        estimation.
      </p>
    </div>
  )
}
