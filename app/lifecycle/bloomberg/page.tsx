import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'
import { formatDateFr } from '@/lib/lifecycle'

export const metadata = { title: 'Bloomberg — niveaux à extraire' }

interface Ligne {
  isin: string
  produit: string
  classe: string
  dateStrike: string
  sousJacent: string
  bloomberg: string
  formule: string
}

// Indice/sous-jacent à la fois absent de Yahoo (yahooSymbol === null) → à extraire
// manuellement (Bloomberg). On ignore les actions cotées (déjà couvertes par Yahoo).
function formuleStrike(p: (typeof products)[number]): string {
  const t = p.terms
  if (t?.kind === 'autocall') {
    if (t.strikeMoyen) return 'Moyenne (période de strike)'
    if (t.lookback) return 'Min (look-back)'
  }
  if (t?.kind === 'rates') return 'Fixing du taux'
  if (t?.kind === 'credit') return 'Indice de crédit (spreads)'
  return 'Clôture — à vérifier'
}

function classe(p: (typeof products)[number]): string {
  if (p.assetClass === 'rates') return 'Taux'
  if (p.assetClass === 'credit') return 'Crédit'
  return 'Indice actions'
}

const lignes: Ligne[] = []
for (const p of products) {
  for (const u of p.sousJacents) {
    if (yahooSymbol(u.bloomberg) !== null) continue // déjà couvert par Yahoo
    lignes.push({
      isin: p.isin,
      produit: p.nom,
      classe: classe(p),
      dateStrike: p.dateConstatationInitiale,
      sousJacent: u.nom,
      bloomberg: u.bloomberg ?? '—',
      formule: formuleStrike(p),
    })
  }
}
lignes.sort((a, b) => a.classe.localeCompare(b.classe) || a.isin.localeCompare(b.isin))

export default function BloombergPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-cmf-navy">Niveaux à extraire (Bloomberg)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sous-jacents absents de Yahoo Finance (indices à décrément, taux, crédit) — à alimenter
          par une extraction quotidienne Bloomberg. La 2ᵉ colonne donne la date de strike : à
          confirmer sur Bloomberg (clôture, plus bas, ou moyenne selon la formule du produit).
        </p>
        <p className="text-xs text-slate-400 mt-1">{lignes.length} sous-jacent(s) à extraire</p>
      </div>

      <div className="card overflow-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">ISIN</th>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">
                Date de strike
              </th>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">
                Sous-jacent
              </th>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">
                Code Bloomberg
              </th>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">
                Formule de strike
              </th>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">Classe</th>
              <th className="text-left font-medium px-3 py-2 border-b border-slate-200">Produit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lignes.map((l, i) => (
              <tr key={`${l.isin}-${i}`} className="hover:bg-blue-50/40">
                <td className="px-3 py-2 font-mono whitespace-nowrap">{l.isin}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {formatDateFr(l.dateStrike)}
                  <span className="text-slate-400 ml-1">({l.dateStrike})</span>
                </td>
                <td className="px-3 py-2">{l.sousJacent}</td>
                <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{l.bloomberg}</td>
                <td className="px-3 py-2 text-slate-500">{l.formule}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span
                    className={
                      l.classe === 'Taux'
                        ? 'text-indigo-600'
                        : l.classe === 'Crédit'
                          ? 'text-orange-600'
                          : 'text-slate-600'
                    }
                  >
                    {l.classe}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500 max-w-[280px] truncate" title={l.produit}>
                  {l.produit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
