'use client'

import type { Product } from '@/lib/types'
import { issuerCode } from '@/lib/termsheets'
import { couponsEncaissesPct } from '@/lib/lifecycle'

// Reporting client mensuel (format CMF) — imprimable en PDF via le navigateur
// OU rendu en PDF côté serveur (route /print + scripts/reporting_clients.mjs).
// Reproduit la « Valorisation au … » + ajoute, par produit, les niveaux des
// sous-jacents en % du strike (worst-of mis en avant). Données : positions du
// client + niveaux courants (Yahoo) déjà calculés côté portefeuille.
//
// La FEUILLE de reporting est isolée dans <ReportSheet/> pour servir de source
// unique aux deux rendus (aperçu modal ici + export PDF headless).
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
const dureeYears = (p: Product): number | null => {
  const a = new Date(p.dateConstatationInitiale || p.dateEmission).getTime()
  const b = new Date(p.dateEcheance).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(1, Math.round((b - a) / (365.25 * 86_400_000)))
}
// Récap compact sous le nom : « 5Y | Phoenix | PDI 50 | B. coupon 40 | Dégressif ».
const recapParts = (p: Product): string[] => {
  const parts: string[] = []
  const y = dureeYears(p)
  if (y) parts.push(`${y}Y`)
  if (p.productType) parts.push(p.productType)
  const t = p.terms
  if (t?.kind === 'autocall') {
    if (typeof t.protectionPct === 'number') parts.push(`PDI ${t.protectionPct}`)
    if (typeof t.barriereCouponPct === 'number') parts.push(`B. coupon ${t.barriereCouponPct}`)
    if (t.degressif) parts.push('Dégressif')
    if (t.effetMemoire) parts.push('Mémoire')
  } else if (typeof p.pdiPct === 'number') {
    parts.push(`PDI ${p.pdiPct}`)
  }
  return parts
}
const eur0 = (n?: number) => (typeof n === 'number' ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—')
const val = (p: Product) => (typeof p.prixMarche === 'number' ? p.prixMarche.toFixed(2).replace('.', ',') : '—')

// ── Feuille de reporting (en-tête CMF + table + pied de page) ────────────────
// withId : pose l'ancre #client-report (ciblée par les règles @media print) —
// vrai pour un rendu unique, faux quand plusieurs feuilles cohabitent sur la
// même page (l'id doit rester unique), auquel cas la classe .report-sheet suffit.
export function ReportSheet({
  client,
  rows,
  perfMap,
  withId = true,
  date = new Date().toLocaleDateString('fr-FR'),
}: {
  client: string
  rows: { p: Product; montant?: number }[]
  perfMap: Record<string, Record<string, number>>
  withId?: boolean
  date?: string
}) {
  return (
    <div
      id={withId ? 'client-report' : undefined}
      className={`report-sheet bg-white p-8 ${withId ? 'shadow-lg' : ''}`}
    >
      {/* En-tête CMF */}
      <div className="mb-5 flex items-stretch gap-3">
        <img src="/cmf-logo.png" alt="CMF — Capital Management France" className="h-20 w-20 rounded" />

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
            // Coupons déjà encaissés (% du nominal) : le produit reçu est déjà
            // augmenté des niveaux constatés, donc valeur cohérente avec la fiche.
            const coupons = couponsEncaissesPct(p)
            return (
              <tr key={p.isin} className="border-b border-slate-200 align-top">
                <td className="px-2 py-2">
                  <div className="font-bold text-slate-800">{p.isin}</div>
                  <div className="text-slate-700">{p.description ?? p.nom}</div>
                  {(() => {
                    const r = recapParts(p)
                    return r.length > 0 ? (
                      <div className="text-[10px] font-medium text-cmf-navy">{r.join(' | ')}</div>
                    ) : null
                  })()}
                  {(() => {
                    // Sous-jacents (equity / indice) avec un niveau connu, en % du strike.
                    // Le déterminant (worst-of) est mis en gras.
                    const shown = sj.filter(
                      (s): s is { nom: string; pct: number } => typeof s.pct === 'number',
                    )
                    if (shown.length === 0) return null
                    const wo =
                      p.basket === 'worst_of' && shown.length > 1
                        ? Math.min(...shown.map((s) => s.pct))
                        : null
                    return (
                      <div className="mt-0.5 text-[10px] leading-snug text-slate-500">
                        {shown.map((s, i) => (
                          <span
                            key={i}
                            className={wo !== null && s.pct === wo ? 'font-semibold text-slate-700' : ''}
                          >
                            {i > 0 ? ' · ' : ''}
                            {s.nom} {s.pct.toFixed(0)} %
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </td>
                <td className="px-2 py-2 font-medium text-slate-700">{issuerCode(p.emetteur)}</td>
                <td className="px-2 py-2 text-slate-700">{p.devise}</td>
                <td className="px-2 py-2 text-slate-700">{dfr(p.dateEmission)}</td>
                <td className="px-2 py-2 text-slate-700">{dureeAns(p)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-700">{eur0(montant)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-800">
                  <div className="font-semibold">{val(p)}</div>
                  {typeof coupons === 'number' && coupons > 0 && (
                    <div className="text-[10px] font-normal text-slate-500">
                      Coupons versés +{coupons.toFixed(2).replace('.', ',')} %
                    </div>
                  )}
                </td>
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

      <div className="mt-6 rounded bg-cmf-navy px-5 py-2 text-center text-[9px] leading-snug text-white">
        Source : Bloomberg / Yahoo. Niveaux des sous-jacents en % du strike (cours / niveau initial). Les données
        sont fournies à chaque destinataire à titre d&apos;information.
      </div>
    </div>
  )
}

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
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-200/80 p-4 print:static print:z-auto print:overflow-visible print:bg-transparent print:p-0">
      <div className="mx-auto max-w-4xl print:mx-0 print:max-w-none">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <button onClick={() => window.print()} className="rounded-md bg-cmf-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            ⬇ Imprimer / Enregistrer en PDF
          </button>
          <button onClick={onClose} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
        </div>

        <ReportSheet client={client} rows={rows} perfMap={perfMap} />
      </div>
    </div>
  )
}
