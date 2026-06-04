'use client'

import { useMemo, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
//  Masque de saisie d'un produit (v1).
//  Couvre l'enveloppe commune + les sous-jacents (répétables) + le mécanisme
//  autocall. Produit un objet `Product` (aperçu JSON exportable / copiable).
//  Persistance locale (localStorage) en attendant la base de données.
//  → À aligner sur le formulaire "Nouvelle cotation" de vizibility.
// ─────────────────────────────────────────────────────────────────────────

interface UnderlyingForm {
  nom: string
  bloomberg: string
  niveauInitial: string
}

const ASSET_CLASSES = ['equity', 'rates', 'credit', 'commodity', 'fx', 'hybrid']
const FAMILIES = [
  'autocall',
  'reverse_convertible',
  'capital_protected',
  'participation',
  'credit_linked',
  'rates_structured',
  'other',
]
const FREQUENCIES = ['mensuel', 'trimestriel', 'semestriel', 'annuel', 'in_fine', 'autre']
const BASKETS = ['single', 'worst_of', 'best_of', 'equipondere', 'panier']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-4">
      <legend className="px-1 text-sm font-semibold text-cmf-navy">{title}</legend>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export default function NouveauProduit() {
  const [f, setF] = useState({
    nom: '',
    isin: '',
    emetteur: '',
    garant: '',
    assetClass: 'equity',
    family: 'autocall',
    eusipa: '',
    devise: 'EUR',
    nominal: '',
    valeurNominale: '1000',
    prixEmission: '100',
    dateConstatationInitiale: '',
    dateEmission: '',
    dateConstatationFinale: '',
    dateEcheance: '',
    frequence: 'trimestriel',
    basket: 'single',
    sens: 'standard',
    effetMemoire: false,
    degressif: false,
    airbag: false,
    oxygene: false,
    couponPa: '',
    barriereCouponPct: '',
    barriereRappelPct: '100',
    protectionPct: '',
    protectionStyle: 'europeenne',
    bonusFinalPct: '',
  })
  const [sousJacents, setSousJacents] = useState<UnderlyingForm[]>([
    { nom: '', bloomberg: '', niveauInitial: '' },
  ])
  const [saved, setSaved] = useState(false)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setF((prev) => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s))

  const product = useMemo(() => {
    return {
      id: f.isin || crypto.randomUUID(),
      nom: f.nom,
      isin: f.isin,
      emetteur: f.emetteur,
      garant: f.garant || undefined,
      assetClass: f.assetClass,
      family: f.family,
      eusipa: f.eusipa || undefined,
      devise: f.devise,
      nominal: num(f.nominal) ?? 0,
      valeurNominale: num(f.valeurNominale),
      prixEmission: num(f.prixEmission),
      dateConstatationInitiale: f.dateConstatationInitiale,
      dateEmission: f.dateEmission,
      dateConstatationFinale: f.dateConstatationFinale,
      dateEcheance: f.dateEcheance,
      frequence: f.frequence,
      basket: f.basket,
      sousJacents: sousJacents
        .filter((u) => u.nom.trim() !== '')
        .map((u) => ({
          nom: u.nom,
          bloomberg: u.bloomberg || undefined,
          niveauInitial: num(u.niveauInitial),
        })),
      terms:
        f.family === 'autocall'
          ? {
              kind: 'autocall',
              sens: f.sens,
              effetMemoire: f.effetMemoire,
              degressif: f.degressif || undefined,
              airbag: f.airbag || undefined,
              oxygene: f.oxygene || undefined,
              couponPa: num(f.couponPa),
              barriereCouponPct: num(f.barriereCouponPct),
              barriereRappelPct: num(f.barriereRappelPct),
              protectionPct: num(f.protectionPct) ?? 0,
              protectionStyle: f.protectionStyle,
              bonusFinalPct: num(f.bonusFinalPct),
            }
          : { kind: f.family },
      observations: [], // → généré depuis fréquence + dates (étape suivante)
    }
  }, [f, sousJacents])

  const json = JSON.stringify(product, null, 2)

  const save = () => {
    try {
      const key = 'lifecycle.produits'
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      existing.push(product)
      localStorage.setItem(key, JSON.stringify(existing))
      setSaved(true)
    } catch {
      /* noop */
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-cmf-navy">Nouveau produit</h1>
        <a href="/" className="text-sm text-cmf-blue hover:underline">
          ← Retour au portefeuille
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Identification">
            <Field label="Nom du produit">
              <input className="input" value={f.nom} onChange={set('nom')} />
            </Field>
            <Field label="ISIN">
              <input className="input font-mono" value={f.isin} onChange={set('isin')} />
            </Field>
            <Field label="Émetteur">
              <input className="input" value={f.emetteur} onChange={set('emetteur')} />
            </Field>
            <Field label="Garant">
              <input className="input" value={f.garant} onChange={set('garant')} />
            </Field>
            <Field label="Classe d'actif">
              <select className="input" value={f.assetClass} onChange={set('assetClass')}>
                {ASSET_CLASSES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Famille">
              <select className="input" value={f.family} onChange={set('family')}>
                {FAMILIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Code EUSIPA / SSPA">
              <input className="input" value={f.eusipa} onChange={set('eusipa')} />
            </Field>
          </Section>

          <Section title="Économie & dates">
            <Field label="Devise">
              <input className="input" value={f.devise} onChange={set('devise')} />
            </Field>
            <Field label="Nominal">
              <input className="input" type="number" value={f.nominal} onChange={set('nominal')} />
            </Field>
            <Field label="Valeur nominale (dénomination)">
              <input className="input" type="number" value={f.valeurNominale} onChange={set('valeurNominale')} />
            </Field>
            <Field label="Prix d'émission (%)">
              <input className="input" type="number" value={f.prixEmission} onChange={set('prixEmission')} />
            </Field>
            <Field label="Constatation initiale">
              <input className="input" type="date" value={f.dateConstatationInitiale} onChange={set('dateConstatationInitiale')} />
            </Field>
            <Field label="Émission">
              <input className="input" type="date" value={f.dateEmission} onChange={set('dateEmission')} />
            </Field>
            <Field label="Constatation finale">
              <input className="input" type="date" value={f.dateConstatationFinale} onChange={set('dateConstatationFinale')} />
            </Field>
            <Field label="Échéance">
              <input className="input" type="date" value={f.dateEcheance} onChange={set('dateEcheance')} />
            </Field>
            <Field label="Fréquence d'observation">
              <select className="input" value={f.frequence} onChange={set('frequence')}>
                {FREQUENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Type de panier">
              <select className="input" value={f.basket} onChange={set('basket')}>
                {BASKETS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Sous-jacents">
            <div className="sm:col-span-2 space-y-2">
              {sousJacents.map((u, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input col-span-5"
                    placeholder="Nom"
                    value={u.nom}
                    onChange={(e) => {
                      const v = [...sousJacents]
                      v[i] = { ...v[i], nom: e.target.value }
                      setSousJacents(v)
                    }}
                  />
                  <input
                    className="input col-span-4 font-mono"
                    placeholder="Ticker Bloomberg"
                    value={u.bloomberg}
                    onChange={(e) => {
                      const v = [...sousJacents]
                      v[i] = { ...v[i], bloomberg: e.target.value }
                      setSousJacents(v)
                    }}
                  />
                  <input
                    className="input col-span-2"
                    placeholder="Niveau init."
                    value={u.niveauInitial}
                    onChange={(e) => {
                      const v = [...sousJacents]
                      v[i] = { ...v[i], niveauInitial: e.target.value }
                      setSousJacents(v)
                    }}
                  />
                  <button
                    type="button"
                    className="col-span-1 text-slate-400 hover:text-red-500"
                    onClick={() => setSousJacents(sousJacents.filter((_, j) => j !== i))}
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-cmf-blue hover:underline"
                onClick={() => setSousJacents([...sousJacents, { nom: '', bloomberg: '', niveauInitial: '' }])}
              >
                + Ajouter un sous-jacent
              </button>
            </div>
          </Section>

          {f.family === 'autocall' && (
            <Section title="Mécanisme — Autocall">
              <Field label="Sens">
                <select className="input" value={f.sens} onChange={set('sens')}>
                  <option value="standard">standard</option>
                  <option value="inverse">inverse</option>
                </select>
              </Field>
              <Field label="Coupon p.a. (%)">
                <input className="input" type="number" value={f.couponPa} onChange={set('couponPa')} />
              </Field>
              <Field label="Barrière de coupon (%)">
                <input className="input" type="number" value={f.barriereCouponPct} onChange={set('barriereCouponPct')} />
              </Field>
              <Field label="Barrière de rappel (%)">
                <input className="input" type="number" value={f.barriereRappelPct} onChange={set('barriereRappelPct')} />
              </Field>
              <Field label="Protection capital (%)">
                <input className="input" type="number" value={f.protectionPct} onChange={set('protectionPct')} />
              </Field>
              <Field label="Style de barrière">
                <select className="input" value={f.protectionStyle} onChange={set('protectionStyle')}>
                  <option value="europeenne">européenne (KIE)</option>
                  <option value="americaine">américaine (KIA)</option>
                </select>
              </Field>
              <Field label="Bonus final (%)">
                <input className="input" type="number" value={f.bonusFinalPct} onChange={set('bonusFinalPct')} />
              </Field>
              <div className="sm:col-span-2 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.effetMemoire} onChange={set('effetMemoire')} /> Effet mémoire
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.degressif} onChange={set('degressif')} /> Dégressif
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.airbag} onChange={set('airbag')} /> Airbag
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={f.oxygene} onChange={set('oxygene')} /> Oxygène
                </label>
              </div>
            </Section>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-cmf-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Enregistrer
            </button>
            {saved && <span className="text-sm text-emerald-600">Enregistré localement ✓</span>}
          </div>
        </div>

        {/* Aperçu JSON */}
        <div className="lg:col-span-1">
          <div className="card p-4 sticky top-4">
            <div className="text-sm font-semibold text-cmf-navy mb-2">Aperçu (objet produit)</div>
            <pre className="text-[11px] leading-relaxed bg-slate-50 rounded-md p-3 overflow-auto max-h-[70vh] text-slate-700">
              {json}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
