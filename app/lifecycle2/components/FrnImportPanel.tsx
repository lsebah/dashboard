'use client'

import { useState } from 'react'
import Modal from '@/app/lifecycle/components/Modal'
import { parseRun } from '@/lib/frn/parser'
import { ISSUERS } from '@/lib/frn/issuers'
import type { Currency, CallType, FrnQuote } from '@/lib/frn/types'

interface EditRow {
  maturityYears: string
  coupon: string
  uf: string
  sensitivity: string
  callType: CallType
  callDetail: string
}

const emptyRow = (): EditRow => ({ maturityYears: '', coupon: '', uf: '', sensitivity: '', callType: 'NC', callDetail: 'NC1' })

export default function FrnImportPanel({
  open,
  onClose,
  onSave,
  defaultCurrency,
}: {
  open: boolean
  onClose: () => void
  onSave: (quotes: FrnQuote[]) => void
  defaultCurrency: Currency
}) {
  const [text, setText] = useState('')
  const [issuer, setIssuer] = useState('')
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<EditRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const analyze = () => {
    const r = parseRun(text)
    if (r.issuer) setIssuer(r.issuer)
    if (r.currency) setCurrency(r.currency)
    setWarnings(r.warnings)
    setRows(
      r.rows.map((p) => ({
        maturityYears: p.maturityYears != null ? String(p.maturityYears) : '',
        coupon: p.coupon != null ? String(p.coupon) : '',
        uf: p.uf != null ? String(p.uf) : '',
        sensitivity: p.sensitivity != null ? String(p.sensitivity) : '',
        callType: p.callType,
        callDetail: p.callDetail ?? 'NC1',
      })),
    )
  }

  const patch = (i: number, k: keyof EditRow, v: string) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [k]: v } : r)))

  const save = () => {
    const num = (s: string) => parseFloat(s.replace(',', '.'))
    const quotes: FrnQuote[] = rows
      .filter((r) => r.maturityYears && r.coupon)
      .map((r) => {
        const callType = r.callType
        const maturityYears = Math.round(num(r.maturityYears))
        return {
          id: `${issuer}-${currency}-${callType}-${maturityYears}`,
          issuer,
          currency,
          callType,
          callDetail: callType === 'CALLABLE' ? r.callDetail || 'NC1' : undefined,
          maturityYears,
          coupon: num(r.coupon),
          uf: r.uf ? num(r.uf) : 0,
          sensitivity: r.sensitivity ? num(r.sensitivity) : null,
          baseReoffer: 100,
          runDate,
          source: `import ${issuer} ${runDate}`,
        }
      })
    if (quotes.length && issuer) {
      onSave(quotes)
      setText('')
      setRows([])
      setWarnings([])
      onClose()
    } else {
      setWarnings(['Sélectionne un émetteur et au moins une ligne valide (maturité + coupon).'])
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importer un run FRN">
      <div className="flex flex-col gap-3">
        <div>
          <div className="field-label mb-1">Coller le texte brut de l’email émetteur</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Ex.&#10;BNP EUR Non Call&#10;5Y  cpn 3.02%  UF 0.30%  sensi 4.6&#10;7Y  cpn 3.21%  UF 0.35%  sensi 6.2&#10;10Y cpn 3.44%  UF 0.45%  sensi 8.4"
            className="input font-mono text-[12px]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={analyze} className="rounded-md bg-cmf-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0b1d36]">
              Analyser
            </button>
            <button onClick={() => setRows((r) => [...r, emptyRow()])} className="text-sm text-cmf-blue hover:underline">
              + Ligne manuelle
            </button>
          </div>
        </div>

        {warnings.length > 0 && (
          <ul className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-700">
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        )}

        {/* Émetteur / devise / date du run */}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="field-label">Émetteur</span>
            <select value={issuer} onChange={(e) => setIssuer(e.target.value)} className="input mt-1">
              <option value="">— Sélectionner —</option>
              {ISSUERS.map((i) => (
                <option key={i.name} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Devise</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input mt-1">
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Date du run</span>
            <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} className="input mt-1" />
          </label>
        </div>

        {/* Prévisualisation éditable */}
        {rows.length > 0 && (
          <div className="overflow-auto rounded-md border border-slate-200">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {['Maturité (Y)', 'Type', 'Coupon %', 'UF %', 'Sensi', ''].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-1 py-1"><input value={r.maturityYears} onChange={(e) => patch(i, 'maturityYears', e.target.value)} className="input w-16" /></td>
                    <td className="px-1 py-1">
                      <select value={r.callType} onChange={(e) => patch(i, 'callType', e.target.value)} className="input w-28">
                        <option value="NC">Non Call</option>
                        <option value="CALLABLE">Callable (NC1)</option>
                      </select>
                    </td>
                    <td className="px-1 py-1"><input value={r.coupon} onChange={(e) => patch(i, 'coupon', e.target.value)} className="input w-20" /></td>
                    <td className="px-1 py-1"><input value={r.uf} onChange={(e) => patch(i, 'uf', e.target.value)} className="input w-20" /></td>
                    <td className="px-1 py-1"><input value={r.sensitivity} onChange={(e) => patch(i, 'sensitivity', e.target.value)} placeholder="—" className="input w-20" /></td>
                    <td className="px-1 py-1 text-right">
                      <button onClick={() => setRows((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500" aria-label="Supprimer">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={save} className="rounded-md bg-cmf-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Enregistrer le run
          </button>
        </div>
      </div>
    </Modal>
  )
}
