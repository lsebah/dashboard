'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AV_FRANCE,
  formatPourcentage,
  motifBlocage,
  parsePourcentage,
  separerEmails,
  type FicheEffective,
} from '@/lib/clients-fiches'
import { docsDuClient, dossiersOrphelins, type InventaireDocs } from '@/lib/client-docs'

// ─────────────────────────────────────────────────────────────────────────
//  Onglet MAINTENANCE — création et modification des fiches clients.
//  Ce qui est coché ici pilote directement l'agent d'envoi des relevés
//  (scripts/reporting_clients.mjs) : la case « Envoi hebdo / mensuel » EST
//  l'abonnement, il n'y a plus de liste de diffusion cachée dans un workflow.
// ─────────────────────────────────────────────────────────────────────────

/** Champs texte du formulaire (conversion en modèle au moment de l'enregistrement). */
interface Brouillon {
  code: string
  entite: string
  nom: string
  email: string
  tel: string
  adresse: string
  retroIndic: string
  avFrance: string[]
  envoiHebdo: boolean
  envoiMensuel: boolean
}

const versBrouillon = (f: FicheEffective): Brouillon => ({
  code: f.code,
  entite: f.entite ?? '',
  nom: f.nom ?? '',
  email: f.email ?? '',
  tel: f.tel ?? '',
  adresse: f.adresse ?? '',
  retroIndic: formatPourcentage(f.retroIndic),
  avFrance: f.avFrance ?? [],
  envoiHebdo: f.envoiHebdo,
  envoiMensuel: f.envoiMensuel,
})

const brouillonVide = (code: string): Brouillon => ({
  code,
  entite: '',
  nom: '',
  email: '',
  tel: '',
  adresse: '',
  retroIndic: '',
  avFrance: [],
  envoiHebdo: false,
  envoiMensuel: false,
})

const octets = (n?: number): string => {
  if (typeof n !== 'number') return ''
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

import { dateFr } from '@/lib/dates'

const jour = (iso?: string | null): string => dateFr(iso, '')

export default function MaintenanceClients() {
  const [fiches, setFiches] = useState<FicheEffective[]>([])
  const [docs, setDocs] = useState<(InventaireDocs & { synchronise: boolean }) | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)
  const [persistance, setPersistance] = useState<boolean | null>(null)

  const [selection, setSelection] = useState<string | null>(null)
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)
  const [recherche, setRecherche] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)

  // ── Chargement ────────────────────────────────────────────────────────────
  const charger = async () => {
    setChargement(true)
    setErreurChargement(null)
    try {
      const [rf, rd] = await Promise.all([
        fetch('/api/clients/fiches', { cache: 'no-store' }),
        fetch('/api/clients/documents', { cache: 'no-store' }),
      ])
      if (!rf.ok) {
        const j = (await rf.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Fiches indisponibles (HTTP ${rf.status}).`)
      }
      const jf = (await rf.json()) as { configured: boolean; fiches: FicheEffective[] }
      setFiches(jf.fiches)
      setPersistance(jf.configured)
      if (rd.ok) setDocs((await rd.json()) as InventaireDocs & { synchronise: boolean })
    } catch (e) {
      setErreurChargement(e instanceof Error ? e.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void charger()
  }, [])

  const ficheSelectionnee = fiches.find((f) => f.code === selection)

  // Modifications non enregistrées : garde-fou avant de changer de client.
  const modifie = useMemo(() => {
    if (!brouillon) return false
    const ref = ficheSelectionnee ? versBrouillon(ficheSelectionnee) : brouillonVide(brouillon.code)
    return JSON.stringify(ref) !== JSON.stringify(brouillon)
  }, [brouillon, ficheSelectionnee])

  const selectionner = (code: string) => {
    if (modifie && !confirm('Modifications non enregistrées — les abandonner ?')) return
    const f = fiches.find((x) => x.code === code)
    setSelection(code)
    setBrouillon(f ? versBrouillon(f) : brouillonVide(code))
    setMessage(null)
  }

  const nouveau = () => {
    if (modifie && !confirm('Modifications non enregistrées — les abandonner ?')) return
    const code = prompt(
      'Code client — il doit être IDENTIQUE au libellé du portefeuille (ex. « ABACUS - 05268 »).',
    )?.trim()
    if (!code) return
    if (fiches.some((f) => f.code === code)) {
      selectionner(code)
      setMessage({ type: 'erreur', texte: `« ${code} » existe déjà — fiche ouverte.` })
      return
    }
    setSelection(code)
    setBrouillon(brouillonVide(code))
    setMessage(null)
  }

  const patch = (p: Partial<Brouillon>) => setBrouillon((b) => (b ? { ...b, ...p } : b))

  const basculerAv = (a: string) =>
    setBrouillon((b) =>
      b ? { ...b, avFrance: b.avFrance.includes(a) ? b.avFrance.filter((x) => x !== a) : [...b.avFrance, a] } : b,
    )

  // ── Enregistrement ────────────────────────────────────────────────────────
  const enregistrer = async () => {
    if (!brouillon) return
    // La rétro est refusée plutôt qu'arrondie : « 0,5,5 » n'a pas de valeur
    // approchée raisonnable, et cette donnée alimente la facturation.
    const retro = brouillon.retroIndic.trim() ? parsePourcentage(brouillon.retroIndic) : undefined
    if (brouillon.retroIndic.trim() && retro === undefined) {
      setMessage({ type: 'erreur', texte: 'Rétro Indic illisible — attendu un pourcentage entre 0 et 100 (ex. « 0,5 »).' })
      return
    }
    setEnregistrement(true)
    setMessage(null)
    try {
      const res = await fetch('/api/clients/fiches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiche: {
            code: brouillon.code.trim(),
            entite: brouillon.entite,
            nom: brouillon.nom,
            email: brouillon.email,
            tel: brouillon.tel,
            adresse: brouillon.adresse,
            retroIndic: retro,
            avFrance: brouillon.avFrance,
            envoiHebdo: brouillon.envoiHebdo,
            envoiMensuel: brouillon.envoiMensuel,
          },
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? `Enregistrement refusé (HTTP ${res.status}).`)
      await charger()
      setMessage({ type: 'ok', texte: `Fiche « ${brouillon.code} » enregistrée.` })
    } catch (e) {
      setMessage({ type: 'erreur', texte: e instanceof Error ? e.message : 'Enregistrement impossible.' })
    } finally {
      setEnregistrement(false)
    }
  }

  const supprimer = async () => {
    if (!brouillon || !ficheSelectionnee) return
    if (!confirm(`Supprimer la fiche « ${brouillon.code} » ? Le client revient à ses valeurs par défaut.`)) return
    setEnregistrement(true)
    try {
      const res = await fetch(`/api/clients/fiches?code=${encodeURIComponent(brouillon.code)}`, { method: 'DELETE' })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? `Suppression refusée (HTTP ${res.status}).`)
      await charger()
      setSelection(null)
      setBrouillon(null)
      setMessage({ type: 'ok', texte: 'Fiche supprimée.' })
    } catch (e) {
      setMessage({ type: 'erreur', texte: e instanceof Error ? e.message : 'Suppression impossible.' })
    } finally {
      setEnregistrement(false)
    }
  }

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const listeFiltree = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return fiches
    return fiches.filter((f) =>
      [f.code, f.entite, f.nom, f.email].some((v) => (v ?? '').toLowerCase().includes(q)),
    )
  }, [fiches, recherche])

  const bilan = useMemo(() => {
    const hebdo = fiches.filter((f) => f.envoiHebdo)
    const mensuel = fiches.filter((f) => f.envoiMensuel)
    const bloques = fiches.filter((f) => (f.envoiHebdo || f.envoiMensuel) && motifBlocage(f))
    return { hebdo: hebdo.length, mensuel: mensuel.length, bloques }
  }, [fiches])

  const orphelins = useMemo(
    () => (docs ? dossiersOrphelins(fiches.map((f) => f.code), docs) : []),
    [docs, fiches],
  )

  const docsClient = brouillon ? docsDuClient(brouillon.code, docs) : null
  const emailsBrouillon = brouillon ? separerEmails(brouillon.email) : { valides: [], invalides: [] }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (chargement) return <div className="p-8 text-center text-sm text-slate-500">Chargement des fiches clients…</div>

  if (erreurChargement)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-800">Fiches clients indisponibles</h2>
        <p className="mt-1 text-sm text-red-700">{erreurChargement}</p>
        <p className="mt-2 text-[12px] text-red-600">
          Aucune valeur par défaut n’est affichée à la place : cela masquerait les abonnements réellement
          enregistrés. L’agent d’envoi refuse également de partir dans cet état.
        </p>
        <button
          onClick={() => void charger()}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Réessayer
        </button>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      {/* Bandeau de synthèse — qui recevra quoi, et qui ne recevra rien. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px]">
        <span className="font-semibold text-slate-800">{fiches.length} clients</span>
        <span className="text-slate-300">|</span>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Envoi hebdo : {bilan.hebdo}</span>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">Envoi mensuel : {bilan.mensuel}</span>
        {bilan.bloques.length > 0 && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
            ⚠ {bilan.bloques.length} abonné(s) sans adresse exploitable — ne recevront rien
          </span>
        )}
        <span className="ml-auto text-[12px] text-slate-400">
          {persistance === false
            ? 'Stockage non configuré — enregistrement impossible sur cet environnement'
            : 'Les cases d’envoi pilotent directement l’agent de reporting'}
        </span>
      </div>

      {bilan.bloques.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <p className="font-medium">Abonnés qui ne peuvent pas être servis :</p>
          <ul className="mt-1 space-y-0.5">
            {bilan.bloques.map((f) => (
              <li key={f.code}>
                • <button onClick={() => selectionner(f.code)} className="font-medium underline">{f.code}</button>{' '}
                — {motifBlocage(f)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* ── Liste ──────────────────────────────────────────────────────── */}
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher…"
              className="input flex-1"
            />
            <button
              onClick={nouveau}
              className="whitespace-nowrap rounded-md bg-cmf-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0b1d36]"
            >
              + Client
            </button>
          </div>
          <ul className="max-h-[70vh] overflow-auto">
            {listeFiltree.map((f) => {
              const actif = f.code === selection
              const d = docsDuClient(f.code, docs)
              const bloque = (f.envoiHebdo || f.envoiMensuel) && motifBlocage(f)
              return (
                <li key={f.code}>
                  <button
                    onClick={() => selectionner(f.code)}
                    className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[13px] transition-colors ${
                      actif
                        ? 'border-cmf-navy bg-slate-50 font-medium text-slate-900'
                        : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex-1 truncate">
                      {f.code}
                      {f.entite && <span className="block truncate text-[11px] text-slate-400">{f.entite}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold">
                      {f.envoiHebdo && <span className="rounded bg-sky-100 px-1 text-sky-700" title="Envoi hebdomadaire">H</span>}
                      {f.envoiMensuel && <span className="rounded bg-indigo-100 px-1 text-indigo-700" title="Envoi mensuel">M</span>}
                      {bloque && <span className="text-amber-500" title={motifBlocage(f)}>⚠</span>}
                      {docs?.synchronise && (
                        <span className={d.der ? 'text-emerald-500' : 'text-slate-300'} title={d.der ? 'DER présent' : 'DER absent'}>
                          ●
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
            {listeFiltree.length === 0 && (
              <li className="px-3 py-6 text-center text-[13px] text-slate-400">Aucun client.</li>
            )}
          </ul>
        </aside>

        {/* ── Fiche ──────────────────────────────────────────────────────── */}
        {!brouillon ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-12 text-sm text-slate-400">
            Sélectionne un client, ou crée-en un.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {message && (
              <div
                className={`rounded-md px-3 py-2 text-[13px] ${
                  message.type === 'ok'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {message.texte}
              </div>
            )}

            {/* Identité */}
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Identité</h2>
                {ficheSelectionnee?.origine === 'defaut' && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                    Fiche jamais enregistrée — valeurs héritées de l’existant
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="field-label">Code client (libellé portefeuille)</span>
                  <input
                    value={brouillon.code}
                    onChange={(e) => patch({ code: e.target.value })}
                    disabled={!!ficheSelectionnee}
                    className="input mt-1 font-mono disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  {ficheSelectionnee && (
                    <span className="mt-1 block text-[11px] text-slate-400">
                      Non modifiable : ce code fait le lien avec les positions du portefeuille.
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="field-label">Nom entité</span>
                  <input value={brouillon.entite} onChange={(e) => patch({ entite: e.target.value })} className="input mt-1" />
                </label>
                <label className="block">
                  <span className="field-label">Nom client</span>
                  <input value={brouillon.nom} onChange={(e) => patch({ nom: e.target.value })} className="input mt-1" />
                </label>
                <label className="block">
                  <span className="field-label">Email (séparer par « , » si plusieurs)</span>
                  <input value={brouillon.email} onChange={(e) => patch({ email: e.target.value })} className="input mt-1" />
                  {emailsBrouillon.invalides.length > 0 && (
                    <span className="mt-1 block text-[11px] text-amber-700">
                      ⚠ ignorée(s) à l’envoi : {emailsBrouillon.invalides.join(', ')}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="field-label">Téléphone</span>
                  <input value={brouillon.tel} onChange={(e) => patch({ tel: e.target.value })} className="input mt-1" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="field-label">Adresse</span>
                  <textarea
                    value={brouillon.adresse}
                    onChange={(e) => patch({ adresse: e.target.value })}
                    rows={2}
                    className="input mt-1"
                  />
                </label>
              </div>
            </section>

            {/* Documents */}
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-800">Documents</h2>
                <span className="text-[11px] text-slate-400">
                  {docs?.synchronise ? `OneDrive inventorié le ${jour(docs.genere)}` : 'OneDrive jamais inventorié'}
                </span>
              </div>

              {/* DER — l'absence d'inventaire ne doit JAMAIS se lire « DER manquant ». */}
              {!docs?.synchronise ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-500">
                  Inventaire OneDrive jamais exécuté (secrets Graph absents) — la présence du DER est
                  <strong> inconnue</strong>, pas absente.
                </p>
              ) : docsClient?.der ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                  ✓ DER présent —{' '}
                  {docsClient.der.url ? (
                    <a href={docsClient.der.url} target="_blank" rel="noreferrer" className="font-medium underline">
                      {docsClient.der.nom}
                    </a>
                  ) : (
                    <span className="font-medium">{docsClient.der.nom}</span>
                  )}
                  {docsClient.der.modifie && <span className="text-emerald-600"> · {jour(docsClient.der.modifie)}</span>}
                </p>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  ⚠ DER absent {docsClient?.dossier ? `du dossier « ${docsClient.dossier} »` : '— aucun dossier OneDrive rapproché'}
                </p>
              )}

              <div className="mt-3">
                <span className="field-label">Dossier de dépôt</span>
                <code className="mt-1 block truncate rounded bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600">
                  {docsClient?.chemin}
                </code>
              </div>

              <div className="mt-3">
                <span className="field-label">Autres pièces ({docsClient?.autres.length ?? 0})</span>
                {docsClient && docsClient.autres.length > 0 ? (
                  <ul className="mt-1 divide-y divide-slate-100 rounded-md border border-slate-200">
                    {docsClient.autres.map((f) => (
                      <li key={f.nom} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px]">
                        <span className="flex-1 truncate">
                          {f.url ? (
                            <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              {f.nom}
                            </a>
                          ) : (
                            f.nom
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-400">{octets(f.taille)}</span>
                        <span className="shrink-0 tabular-nums text-slate-400">{jour(f.modifie)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] text-slate-400">
                    {docs?.synchronise ? 'Aucune autre pièce dans le dossier.' : '—'}
                  </p>
                )}
              </div>
            </section>

            {/* Commission + AV France */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">Information de commission</h2>
                <label className="block max-w-[220px]">
                  <span className="field-label">Rétro Indic (%)</span>
                  <input
                    value={brouillon.retroIndic}
                    onChange={(e) => patch({ retroIndic: e.target.value })}
                    placeholder="0,5"
                    inputMode="decimal"
                    className="input mt-1"
                  />
                </label>
                <p className="mt-2 text-[11px] text-slate-400">
                  Saisie en pourcent, stockée en décimal — même convention que l’onglet Commissions.
                </p>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">AV France</h2>
                <div className="flex flex-wrap gap-2">
                  {AV_FRANCE.map((a) => {
                    const on = brouillon.avFrance.includes(a)
                    return (
                      <button
                        key={a}
                        type="button"
                        aria-pressed={on}
                        onClick={() => basculerAv(a)}
                        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                          on
                            ? 'border-cmf-navy bg-cmf-navy text-white'
                            : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {a}
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            {/* Envois */}
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Envoi du relevé de valorisation</h2>
              <p className="mb-3 text-[12px] text-slate-500">
                Un PDF par client, à ses adresses, avec <strong>L.sebah@cmf.finance en copie cachée systématique</strong>.
                Hebdomadaire le lundi, mensuel le 1er — même agent pour les deux.
              </p>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    { k: 'envoiHebdo' as const, t: 'Envoi hebdomadaire', s: 'tous les lundis' },
                    { k: 'envoiMensuel' as const, t: 'Envoi mensuel', s: 'le 1er de chaque mois' },
                  ]
                ).map(({ k, t, s }) => (
                  <label
                    key={k}
                    className="flex flex-1 cursor-pointer items-start gap-2.5 rounded-md border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={brouillon[k]}
                      onChange={(e) => patch({ [k]: e.target.checked } as Partial<Brouillon>)}
                      className="mt-0.5 h-4 w-4 accent-[#0f2544]"
                    />
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">{t}</span>
                      <span className="block text-[11px] text-slate-400">{s}</span>
                    </span>
                  </label>
                ))}
              </div>
              {(brouillon.envoiHebdo || brouillon.envoiMensuel) && emailsBrouillon.valides.length === 0 && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  ⚠ Abonnement coché sans adresse exploitable : ce client ne recevra rien. L’agent le
                  signalera dans son compte rendu à chaque envoi.
                </p>
              )}
            </section>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => void enregistrer()}
                disabled={enregistrement || persistance === false}
                className="rounded-md bg-cmf-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enregistrement ? 'Enregistrement…' : 'Enregistrer la fiche'}
              </button>
              {modifie && <span className="text-[12px] text-amber-600">Modifications non enregistrées</span>}
              {ficheSelectionnee?.origine === 'fiche' && (
                <button
                  onClick={() => void supprimer()}
                  disabled={enregistrement}
                  className="ml-auto text-[12px] text-slate-400 hover:text-red-600"
                >
                  Supprimer la fiche
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dossiers OneDrive non rattachés — symptôme d'un dossier mal nommé. */}
      {orphelins.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-500">
          <span className="font-medium text-slate-700">
            {orphelins.length} dossier(s) OneDrive rattaché(s) à aucun client :
          </span>{' '}
          {orphelins.join(' · ')} — renomme-les avec le code client exact pour que leurs pièces
          apparaissent ici.
        </div>
      )}
    </div>
  )
}
