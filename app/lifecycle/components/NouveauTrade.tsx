'use client'

import { useMemo, useState } from 'react'
import type { Frequency, Product } from '@/lib/types'
import { canonicalTermsheetName, issuerCode } from '@/lib/termsheets'
import { addLocalProduct } from '@/lib/local-products'
import { setLocalAllocations } from '@/lib/allocations'

// Modale « Nouveau trade » : saisie d'un trade (TS à renommer + déposer dans le
// dossier Termsheets), répartition multi-clients, commissions (UF / Rétro)
// calculées en direct, puis génération de l'email à Gabrielle + des données à
// ajouter au feed / aux commissions. L'envoi de l'email et le dépôt OneDrive
// seront automatisés via Microsoft Graph (à brancher).
interface Alloc {
  client: string
  montant: string
  uf: string
  retro: string
}

const FREQS: { v: Frequency; label: string }[] = [
  { v: 'mensuel', label: 'Mensuel' },
  { v: 'trimestriel', label: 'Trimestriel' },
  { v: 'semestriel', label: 'Semestriel' },
  { v: 'annuel', label: 'Annuel' },
  { v: 'in_fine', label: 'In Fine' },
]

const num = (s: string) => {
  const v = parseFloat((s || '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}
const eur = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

export default function NouveauTrade({ onClose }: { onClose: () => void }) {
  const [isin, setIsin] = useState('')
  const [emetteur, setEmetteur] = useState('')
  const [devise, setDevise] = useState('EUR')
  const [nom, setNom] = useState('')
  const [dateEmission, setDateEmission] = useState('')
  const [duree, setDuree] = useState('')
  const [frequence, setFrequence] = useState<Frequency>('trimestriel')
  const [tsFile, setTsFile] = useState<string>('')
  const [allocs, setAllocs] = useState<Alloc[]>([{ client: '', montant: '', uf: '', retro: '' }])
  const [gabrielle, setGabrielle] = useState('')
  const [copied, setCopied] = useState('')

  const setA = (i: number, k: keyof Alloc, v: string) =>
    setAllocs((a) => a.map((row, j) => (j === i ? { ...row, [k]: v } : row)))
  const addA = () => setAllocs((a) => [...a, { client: '', montant: '', uf: '', retro: '' }])
  const delA = (i: number) => setAllocs((a) => (a.length > 1 ? a.filter((_, j) => j !== i) : a))

  const rows = allocs.map((a) => {
    const montant = num(a.montant)
    const ufPct = num(a.uf) / 100
    const retroPct = num(a.retro) / 100
    const comTotal = montant * ufPct
    const comClient = montant * retroPct
    const comCmf = comTotal - comClient
    return { client: a.client, montant, ufStr: a.uf, retroStr: a.retro, ufPct, retroPct, comTotal, comClient, comCmf }
  })
  const tot = rows.reduce(
    (s, r) => ({
      montant: s.montant + r.montant,
      comTotal: s.comTotal + r.comTotal,
      comClient: s.comClient + r.comClient,
      comCmf: s.comCmf + r.comCmf,
    }),
    { montant: 0, comTotal: 0, comClient: 0, comCmf: 0 },
  )

  // Nom de fichier TS canonique : à utiliser pour renommer la TS avant dépôt dans
  // le dossier Termsheets (convention YYMMDD_<durée>Y_<nom>_<fréq>_<ISIN>_<ÉMET>).
  const tsName = useMemo(() => {
    if (!isin || !dateEmission || !nom || !emetteur || !duree) return ''
    return canonicalTermsheetName({
      dateEmission,
      dureeAnnees: Math.max(1, Math.round(num(duree))),
      nom,
      frequence,
      isin: isin.trim().toUpperCase(),
      emetteur: issuerCode(emetteur),
    })
  }, [isin, dateEmission, nom, emetteur, duree, frequence])

  const emailText = useMemo(() => {
    const L: string[] = []
    L.push(`Objet : Nouveau trade ${isin || '—'} — ${emetteur || '—'}`)
    L.push('')
    L.push('Bonjour Gabrielle,')
    L.push('')
    L.push('Nouveau trade à enregistrer :')
    L.push(`- ISIN : ${isin || '—'}`)
    L.push(`- Émetteur : ${emetteur || '—'}`)
    L.push(`- Produit : ${nom || '—'}`)
    L.push(`- Devise : ${devise}`)
    if (dateEmission) L.push(`- Date d'émission : ${dateEmission}`)
    L.push(`- Nominal total : ${eur(tot.montant)} ${devise}`)
    L.push('')
    L.push('Répartition par client & commissions :')
    for (const r of rows) {
      L.push(
        `• ${r.client || '—'} — ${eur(r.montant)} ${devise} | UF ${r.ufStr || '0'} % (${eur(r.comTotal)}) | ` +
          `Rétro ${r.retroStr || '0'} % (${eur(r.comClient)}) | Net CMF ${eur(r.comCmf)}`,
      )
    }
    L.push('')
    L.push(
      `Total : nominal ${eur(tot.montant)} ${devise} | UF ${eur(tot.comTotal)} | ` +
        `Rétro client ${eur(tot.comClient)} | Net CMF ${eur(tot.comCmf)}`,
    )
    if (tsName) {
      L.push('')
      L.push(`Termsheet : ${tsName}`)
    }
    L.push('')
    L.push('Bien à toi,')
    L.push('Laurent')
    return L.join('\n')
  }, [isin, emetteur, nom, devise, dateEmission, rows, tot, tsName])

  // Données prêtes à intégrer (feed.json + commissions.json) — à me transmettre.
  const dataJson = useMemo(() => {
    const code = issuerCode(emetteur)
    const feed = rows.map((r) => ({
      isin: isin.trim().toUpperCase(),
      client: r.client,
      devise,
      amount: r.montant,
      description: nom,
    }))
    const commissions = rows.map((r) => ({
      isin: isin.trim().toUpperCase(),
      issue: dateEmission || null,
      client: r.client,
      emetteur: code,
      description: nom,
      devise,
      nominal: r.montant,
      ufPct: Math.round(r.ufPct * 1e6) / 1e6,
      comCmf: Math.round(r.comCmf * 100) / 100,
      retroPct: Math.round(r.retroPct * 1e6) / 1e6,
      comClient: Math.round(r.comClient * 100) / 100,
      comTotal: Math.round(r.comTotal * 100) / 100,
      net: Math.round(r.comCmf * 100) / 100,
    }))
    return JSON.stringify({ feed, commissions, termsheet: tsName || null }, null, 2)
  }, [isin, emetteur, nom, devise, dateEmission, rows, tsName])

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      /* presse-papier indisponible */
    }
  }

  // Sauve le trade en local (localStorage) → il apparaît aussitôt au portefeuille
  // avec son/ses compte(s). Le décodage fin de la TS se fait ensuite.
  const save = () => {
    const code = isin.trim().toUpperCase()
    if (!code) {
      alert('Renseigne au moins l’ISIN avant de sauver.')
      return
    }
    const years = Math.max(1, Math.round(num(duree) || 1))
    let ech = ''
    if (dateEmission) {
      const d = new Date(dateEmission)
      d.setFullYear(d.getFullYear() + years)
      ech = d.toISOString().slice(0, 10)
    }
    const allocations = rows
      .filter((r) => r.client.trim())
      .map((r) => ({ client: r.client.trim(), montant: r.montant }))
    const product: Product = {
      id: code,
      nom: nom || code,
      isin: code,
      emetteur: emetteur || '—',
      assetClass: 'equity',
      family: 'autocall',
      devise,
      nominal: tot.montant || 0,
      dateConstatationInitiale: dateEmission || '',
      dateEmission: dateEmission || '',
      dateConstatationFinale: ech,
      dateEcheance: ech,
      frequence,
      sousJacents: [],
      basket: 'single',
      statut: 'vivant',
      rr: 'LS',
      productType: 'Trade',
      description: nom || code,
      clients: allocations.map((a) => a.client),
      allocations,
    }
    addLocalProduct(product)
    setLocalAllocations(code, allocations)
    onClose()
  }

  // Ouvre un brouillon dans le nouvel Outlook (objet + corps pré-remplis).
  const sendOutlook = () => {
    const subject = `Nouveau trade ${isin || ''} — ${emetteur || ''}`.trim()
    const url =
      'https://outlook.office.com/mail/deeplink/compose' +
      `?to=${encodeURIComponent(gabrielle)}` +
      `&subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(emailText)}`
    window.open(url, '_blank', 'noopener')
  }

  const inputCls = 'input w-full'
  const cell = 'border border-slate-200 px-1.5 py-1'

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-900/40 p-4">
      <div className="mx-auto max-w-3xl rounded-lg bg-white shadow-xl">
        {/* En-tête */}
        <div className="flex items-center justify-between rounded-t-lg bg-orange-500 px-5 py-3 text-white">
          <h2 className="text-lg font-semibold">Nouveau trade</h2>
          <button onClick={onClose} className="rounded px-2 py-0.5 text-white/90 hover:bg-white/20" title="Fermer">
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Termsheet */}
          <div>
            <label className="field-label">Termsheet (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setTsFile(e.target.files?.[0]?.name ?? '')}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-orange-700 hover:file:bg-orange-200"
            />
            {tsFile && <div className="mt-1 text-[11px] text-slate-500">Fichier choisi : {tsFile}</div>}
            {tsName ? (
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="text-slate-500">À renommer en :</span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{tsName}</code>
                <button onClick={() => copy('ts', tsName)} className="text-cmf-blue hover:underline">
                  copier
                </button>
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">
                Complète ISIN, émetteur, nom, date d&apos;émission, durée et fréquence pour générer le nom de fichier.
              </div>
            )}
          </div>

          {/* Champs du trade */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="field-label">ISIN</label>
              <input value={isin} onChange={(e) => setIsin(e.target.value)} className={inputCls} placeholder="XS…" />
            </div>
            <div>
              <label className="field-label">Émetteur</label>
              <input value={emetteur} onChange={(e) => setEmetteur(e.target.value)} className={inputCls} placeholder="BNP, Goldman Sachs…" />
            </div>
            <div>
              <label className="field-label">Devise</label>
              <input value={devise} onChange={(e) => setDevise(e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="field-label">Produit (description)</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputCls} placeholder="Phoenix Mémoire worst-of …" />
            </div>
            <div>
              <label className="field-label">Date d&apos;émission</label>
              <input type="date" value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="field-label">Durée (ans)</label>
              <input value={duree} onChange={(e) => setDuree(e.target.value)} inputMode="numeric" className={inputCls} placeholder="5" />
            </div>
            <div>
              <label className="field-label">Fréquence</label>
              <select value={frequence} onChange={(e) => setFrequence(e.target.value as Frequency)} className={inputCls}>
                {FREQS.map((f) => (
                  <option key={f.v} value={f.v}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Répartition clients + commissions */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="field-label">Répartition par client &amp; commissions</label>
              <button onClick={addA} className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-200">
                + Ajouter un client
              </button>
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead className="text-slate-500">
                <tr>
                  <th className={`${cell} text-left`}>Client</th>
                  <th className={`${cell} text-right`}>Montant</th>
                  <th className={`${cell} text-right`}>UF %</th>
                  <th className={`${cell} text-right`}>Rétro %</th>
                  <th className={`${cell} text-right`}>Com. CMF</th>
                  <th className={cell}></th>
                </tr>
              </thead>
              <tbody>
                {allocs.map((a, i) => (
                  <tr key={i}>
                    <td className={cell}>
                      <input value={a.client} onChange={(e) => setA(i, 'client', e.target.value)} className="w-full bg-transparent outline-none" placeholder="NOM - 00000" />
                    </td>
                    <td className={cell}>
                      <input value={a.montant} onChange={(e) => setA(i, 'montant', e.target.value)} inputMode="numeric" className="w-full bg-transparent text-right tabular-nums outline-none" placeholder="200000" />
                    </td>
                    <td className={cell}>
                      <input value={a.uf} onChange={(e) => setA(i, 'uf', e.target.value)} inputMode="decimal" className="w-16 bg-transparent text-right tabular-nums outline-none" placeholder="5" />
                    </td>
                    <td className={cell}>
                      <input value={a.retro} onChange={(e) => setA(i, 'retro', e.target.value)} inputMode="decimal" className="w-16 bg-transparent text-right tabular-nums outline-none" placeholder="2" />
                    </td>
                    <td className={`${cell} text-right tabular-nums text-slate-700`}>{eur(rows[i].comCmf)}</td>
                    <td className={`${cell} text-center`}>
                      {allocs.length > 1 && (
                        <button onClick={() => delA(i)} className="text-slate-400 hover:text-red-600" title="Retirer ce client">
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-medium text-slate-700">
                <tr>
                  <td className={`${cell} text-right`}>Total</td>
                  <td className={`${cell} text-right tabular-nums`}>{eur(tot.montant)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{eur(tot.comTotal)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{eur(tot.comClient)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{eur(tot.comCmf)}</td>
                  <td className={cell}></td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-1 text-[10px] text-slate-400">
              Com. totale = Montant × UF · Rétro client = Montant × Rétro · Com. CMF (net) = UF − Rétro.
            </p>
          </div>

          {/* Email Gabrielle */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="field-label">Email à Gabrielle (trade + commissions)</label>
              <div className="flex items-center gap-2">
                <input
                  value={gabrielle}
                  onChange={(e) => setGabrielle(e.target.value)}
                  placeholder="gabrielle@cmf.finance"
                  className="input h-7 w-48 text-xs"
                />
                <button onClick={sendOutlook} className="rounded-md bg-cmf-blue px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
                  Envoyer via Outlook
                </button>
              </div>
            </div>
            <textarea readOnly value={emailText} rows={10} className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-snug text-slate-700" />
            <p className="mt-1 text-[10px] text-slate-400">
              Ouvre un brouillon dans le nouvel Outlook (objet + corps pré-remplis). Pense à joindre la termsheet :
              un lien de composition ne peut pas attacher le PDF automatiquement.
            </p>
          </div>

          {/* Données à intégrer */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="field-label">Données à intégrer (feed + commissions)</label>
              <button onClick={() => copy('json', dataJson)} className="rounded-md border border-slate-300 px-2.5 py-0.5 text-xs text-slate-700 hover:bg-slate-50">
                {copied === 'json' ? '✓ Copié' : 'Copier le JSON'}
              </button>
            </div>
            <textarea readOnly value={dataJson} rows={8} className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] leading-snug text-slate-700" />
            <p className="mt-1 text-[10px] text-slate-400">
              En attendant l&apos;automatisation : renomme la TS comme indiqué, dépose-la dans le dossier Termsheets,
              copie-moi ce JSON (je l&apos;ajoute au portefeuille et je décode la TS) et envoie l&apos;email à Gabrielle.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 rounded-b-lg border-t border-slate-200 px-5 py-3">
          <button onClick={save} className="rounded-md bg-cmf-navy px-5 py-1.5 text-sm font-semibold text-white hover:bg-[#0b1d36]">
            Sauver
          </button>
        </div>
      </div>
    </div>
  )
}
