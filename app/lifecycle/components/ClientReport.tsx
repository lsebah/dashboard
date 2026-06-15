'use client'

import type { Product } from '@/lib/types'
import { issuerCode } from '@/lib/termsheets'

// Reporting client mensuel (format CMF) — imprimable en PDF via le navigateur.
// Reproduit la « Valorisation au … » + ajoute, par produit, les niveaux des
// sous-jacents en % du strike (worst-of mis en avant). Données : positions du
// client + niveaux courants (Yahoo) déjà calculés côté portefeuille.
const dfr = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}
const dureeAns = (p: Product) => {
  const a = new Date(p.dateConstatationInitiale || p.dateEmission).getTime()
  const b = new Date(p.dateEcheance).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return '—'
  return `${Math.max(1, Math.round((b - a) / (365.25 * 86_400_000)))} Ans`
}
const eur0 = (n?: number) => (typeof n === 'number' ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—')
const val = (p: Product) => (typeof p.prixMarche === 'number' ? p.prixMarche.toFixed(2).replace('.', ',') : '—')

export default function ClientReport({
  client,
  rows,
  perfMap,
  onClose,
}: {
  client: string
  rows: { p: Product; montant?: number }[]
  perfMap: Record<string, Record<string, number>>
  onClose: () => void
}) {
  const date = new Date().toLocaleDateString('fr-FR')
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-200/80 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-md bg-cmf-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            ⬇ Imprimer / Enregistrer en PDF
          </button>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
        </div>

        <div id="client-report" className="bg-white p-8 shadow-lg">
          {/* En-tête CMF */}
          <div className="mb-5 flex items-stretch gap-3">
            <div className="flex items-center justify-center rounded bg-cmf-navy px-4">
              <span className="text-2xl font-extrabold tracking-tight text-white">CMF</span>
            </div>
            <div className="flex flex-1 flex-col justify-center rounded bg-cmf-navy px-5 py-3 text-white">
              <div className="text-xl font-bold tracking-tight">{client}</div>
              <div className="text-lg font-semibold">Valorisation au {date}</div>
            </div>
          </div>

          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-cmf-navy text-white">
                <th className="px-2 py-1.5 text-left font-semibold">ISIN + Description</th>
                <th className="px-2 py-1.5 text-left font-semibold">Émetteur</th>
                <th className="px-2 py-1.5 text-left font-semibold">Devise</th>
                <th className="px-2 py-1.5 text-left font-semibold">Émission</th>
                <th className="px-2 py-1.5 text-left font-semibold">Maturité</th>
                <th className="px-2 py-1.5 text-right font-semibold">Notionnel</th>
                <th className="px-2 py-1.5 text-right font-semibold">Valorisation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, montant }) => {
                const pm = perfMap[p.isin] ?? {}
                const sj = p.sousJacents.map((u) => ({ nom: u.nom, pct: pm[u.nom] as number | undefined }))
                const lvls = sj.filter((s) => typeof s.pct === 'number').map((s) => s.pct as number)
                const worst = lvls.length ? Math.min(...lvls) : null
                return (
                  <tr key={p.isin} className="border-b border-slate-200 align-top">
                    <td className="px-2 py-2">
                      <div className="font-bold text-slate-800">{p.isin}</div>
                      <div className="text-slate-700">{p.description ?? p.nom}</div>
                      {sj.length > 0 && (
                        <div className="mt-0.5 text-[10px] leading-snug text-slate-500">
                          Sous-jacents (% du strike) :{' '}
                          {sj.map((s, i) => (
                            <span key={i} className={typeof s.pct === 'number' && s.pct === worst ? 'font-semibold text-slate-700' : ''}>
                              {i > 0 ? ' · ' : ''}
                              {s.nom} {typeof s.pct === 'number' ? `${s.pct.toFixed(0)} %` : 'n/c'}
                            </span>
                          ))}
                          {typeof worst === 'number' && <span className="text-slate-400"> — worst {worst.toFixed(0)} %</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 font-medium text-slate-700">{issuerCode(p.emetteur)}</td>
                    <td className="px-2 py-2 text-slate-700">{p.devise}</td>
                    <td className="px-2 py-2 text-slate-700">{dfr(p.dateEmission)}</td>
                    <td className="px-2 py-2 text-slate-700">{dureeAns(p)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{eur0(montant)}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-800">{val(p)}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-slate-400">
                    Aucune position pour ce client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="mt-6 text-center text-[10px] text-slate-400">
            Source : Bloomberg / Yahoo. Niveaux des sous-jacents en % du strike (cours / niveau initial). Les données
            sont fournies à chaque destinataire à titre d&apos;information.
          </p>
        </div>
      </div>
    </div>
  )
}
