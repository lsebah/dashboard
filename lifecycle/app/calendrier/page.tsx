import { products } from '@/lib/products'
import { formatDateFr, formatPct } from '@/lib/lifecycle'

interface Ligne {
  date: string
  isin: string
  nom: string
  type: string
  niveauRappel?: number
  coupon?: number
  actif: boolean
}

export default function CalendrierPage() {
  const today = new Date().toISOString().slice(0, 10)

  const lignes: Ligne[] = products
    .flatMap((p) =>
      p.observations
        .filter((o) => o.dateObservation >= today)
        .map((o) => ({
          date: o.dateObservation,
          isin: p.isin,
          nom: p.nom,
          type:
            o.autocallActif === false
              ? 'Coupon (rappel non-actif)'
              : 'Rappel + coupon',
          niveauRappel: o.niveauRappelPct,
          coupon: o.couponPct,
          actif: o.autocallActif !== false,
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <h1 className="text-2xl font-bold text-cmf-navy mb-4">
        Calendrier des observations
      </h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Produit</th>
              <th className="text-left px-4 py-2 font-medium">ISIN</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-right px-4 py-2 font-medium">Niveau rappel</th>
              <th className="text-right px-4 py-2 font-medium">Coupon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lignes.slice(0, 100).map((l, i) => (
              <tr key={i} className={l.actif ? '' : 'text-slate-400'}>
                <td className="px-4 py-2 whitespace-nowrap font-medium text-slate-700">
                  {formatDateFr(l.date)}
                </td>
                <td className="px-4 py-2">{l.nom}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{l.isin}</td>
                <td className="px-4 py-2">{l.type}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPct(l.niveauRappel, 2)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPct(l.coupon, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        {lignes.length} observations à venir · 100 premières affichées.
      </p>
    </div>
  )
}
