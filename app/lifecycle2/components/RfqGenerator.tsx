'use client'

// ─────────────────────────────────────────────────────────────────────────
//  RFQ — reprend le générateur d'email RFQ (artefact fourni par Laurent,
//  18/08/2026), champ pour champ et ligne pour ligne. Les listes d'émetteurs
//  (nom + adresse BCC) et d'assureurs (nom + frais de référencement par
//  défaut) sont recopiées telles quelles — ce sont les coordonnées et les
//  frais réels que Laurent utilise pour coter, rien n'y est inventé.
//
//  Ce qui CHANGE par rapport à l'artefact d'origine : l'habillage. L'artefact
//  était une page HTML autonome avec sa propre feuille de style ; il a été
//  reconstruit avec les primitives déjà en place dans Lifecycle (Panel,
//  `.input`, `.field-label`, cmf-navy/cmf-blue) pour s'intégrer à l'onglet
//  plutôt que de coller une seconde charte graphique à côté de la première —
//  et pour éviter qu'un `<style>` non scopé (`input[type=text] { … }`) ne
//  déborde sur tous les autres onglets du site.
//
//  Ce qui NE change PAS : les champs, les options, la bascule « un seul champ
//  à solver à la fois », la construction du corps de l'email et son gabarit
//  exact (lignes, tirets, majuscules), les frais préremplis par assureur, la
//  liste des émetteurs et leurs adresses BCC.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Panel } from '../components/charts'

type TypeProduit =
  | 'athena' | 'athena_airbag' | 'phoenix'
  | 'certiplus' | 'creditlinked' | 'tranchecln'
  | 'reverse' | 'perso'
type Block = 'autocall' | 'reverse' | 'participation' | 'credit' | 'perso'
type Enveloppe = 'cto' | 'avfr' | 'avlux'
type SolvableField =
  | 'coupon' | 'barriereCoupon' | 'strike' | 'protection' | 'degressivite' | 'airbag'
  | 'rc_coupon' | 'rc_barriere'
  | 'pa_participation' | 'pa_cap'
  | 'cl_spread'
  | 'reoffer'

const BLOCK_MAP: Record<TypeProduit, Block> = {
  athena: 'autocall', athena_airbag: 'autocall', phoenix: 'autocall',
  certiplus: 'participation', creditlinked: 'credit', tranchecln: 'credit',
  reverse: 'reverse', perso: 'perso',
}
const TYPE_LABEL: Record<TypeProduit, string> = {
  athena: 'Athena', athena_airbag: 'Athena Airbag', phoenix: 'Phoenix Memoire',
  certiplus: 'Certi+ (Participation)', creditlinked: 'Credit-Linked', tranchecln: 'Tranche CLN',
  reverse: 'Reverse Convertible', perso: 'Produit Personnalise',
}
const ENVELOPPE_LABEL: Record<Enveloppe, string> = {
  cto: 'CTO', avfr: 'Assurance Vie France', avlux: 'Assurance Vie Luxembourg',
}
const SOLVE_LABEL: Record<SolvableField, string> = {
  coupon: 'Coupon', barriereCoupon: 'Barriere coupon', strike: 'Strike',
  protection: 'Protection', degressivite: 'Degressivite', airbag: 'Airbag',
  rc_coupon: 'Coupon', rc_barriere: 'Barriere / PDI',
  pa_participation: 'Participation', pa_cap: 'Cap',
  cl_spread: 'Spread / Coupon', reoffer: 'Reoffer',
}

const PRIX_CC = 'prix@cmf.finance'

/** Émetteurs destinataires — nom et adresse BCC, recopiés de l'artefact. */
const EMETTEURS: { name: string; bcc: string }[] = [
  { name: 'Barclays', bcc: 'epbfrancebelux@barclays.com' },
  { name: 'BBVA', bcc: 'equity.paris@bbva.com' },
  { name: 'BNP Paribas', bcc: 'dl.brokers.france@bnpparibas.com' },
  { name: 'BofA', bcc: 'distributionfrance@bofa.com' },
  { name: 'CIBC', bcc: 'dlukstructuredproducts@cibc.com' },
  { name: 'CIC Market Solutions', bcc: 'emtnexs@cic.fr' },
  { name: 'Citigroup', bcc: 'frabeluxsp@citi.com' },
  { name: 'Credit Agricole CIB', bcc: 'CACIBWealthSolutions@ca-cib.com' },
  { name: 'Deutsche Bank', bcc: 'frabeluxteam@list.db.com' },
  { name: 'Goldman Sachs', bcc: 'gs-pipg-france@gs.com' },
  { name: 'Leonteq', bcc: 'frabelux@leonteq.com' },
  { name: 'Marex', bcc: 'suisse@marexfp.com' },
  { name: 'Morgan Stanley', bcc: 'dsgfrance@morganstanley.com' },
  { name: 'Nomura', bcc: 'francedistribution@nomura.com' },
  { name: 'Santander', bcc: 'dlsanequitysp@gruposantander.com' },
  { name: 'Societe Generale (SGCIB)', bcc: 'list.par-mark-slsflow@sgcib.com' },
  { name: 'UBS', bcc: 'ol-frabelux-solutions@ubs.com' },
]

/** Assureurs AV France — frais de référencement préremplis (`value`) quand
 *  connus, sinon un simple repère (`placeholder`) que rien n'affiche tant que
 *  Laurent n'a pas tapé le vrai montant. */
const INSURERS: { name: string; feekey: string; value?: string; placeholder?: string }[] = [
  { name: 'AEP', feekey: 'AEP', placeholder: 'a preciser' },
  { name: 'Afi-Esca', feekey: 'AfiEsca', placeholder: 'a preciser' },
  { name: 'AG2R La Mondiale', feekey: 'AG2R', value: '2 000 EUR HT fixe / produit' },
  { name: 'Alpheys', feekey: 'Alpheys', placeholder: 'a preciser' },
  { name: 'Apicil', feekey: 'Apicil', placeholder: 'a preciser' },
  { name: 'AXA', feekey: 'AXA', placeholder: 'a preciser' },
  { name: 'Cardif', feekey: 'Cardif', value: '0,50% (50 bp) - confirme' },
  { name: 'CNP Assurances', feekey: 'CNP', placeholder: 'a preciser' },
  { name: 'Generali', feekey: 'Generali', placeholder: 'a preciser' },
  { name: 'Nortia', feekey: 'Nortia', value: '1 500 EUR/produit (500 EUR avec pack partenariat)' },
  { name: 'Oradea Vie', feekey: 'OradeaVie', placeholder: 'a preciser' },
  { name: 'Selencia', feekey: 'Selencia', value: '1 500 EUR HT fixe / produit' },
  { name: 'Spirica', feekey: 'Spirica', placeholder: 'non precise' },
  { name: 'SwissLife', feekey: 'SwissLife', placeholder: 'a preciser' },
  { name: 'UAF LIFE Patrimoine', feekey: 'UAF', value: 'frais fixe non precise + LR 4%' },
  { name: 'Vie Plus', feekey: 'ViePlus', placeholder: 'a preciser' },
]

const defaultFees = (): Record<string, string> => {
  const m: Record<string, string> = {}
  for (const ins of INSURERS) m[ins.feekey] = ins.value ?? ''
  return m
}

/** Espace insécable comme séparateur de milliers — même comportement que
 *  l'artefact (formatage au fil de la frappe, curseur préservé). */
function formatThousands(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** `Label : a solver (…)` si ce champ est le champ en cours de solve, sinon
 *  `Label : valeur%` ou `Label : [a preciser]` si rien n'est saisi. */
function fmtSolve(solving: SolvableField | null, field: SolvableField, label: string, value: string, unit = '%'): string {
  if (solving === field) return `${label} : a solver (inconnu, merci de coter)`
  return `${label} : ${value || '[a preciser]'}${value ? unit : ''}`
}

const inputCls = 'input'
const labelCls = 'field-label mb-1 block'

export default function RfqGenerator() {
  // ── 1. Sélection du produit ──────────────────────────────────────────
  const [nominal, setNominal] = useState('500 000')
  const [devise, setDevise] = useState<'EUR' | 'USD' | 'CHF' | 'GBP'>('EUR')
  const [maturite, setMaturite] = useState('60 Mois')
  const [typeProduit, setTypeProduit] = useState<TypeProduit>('phoenix')
  const [typeDemande, setTypeDemande] = useState<'Classique' | 'Optimisee'>('Classique')
  const [sousJacents, setSousJacents] = useState<string[]>(['SX5E'])

  // ── 2. Bloc autocall (Athena / Athena Airbag / Phoenix Mémoire) ──────
  const [coupon, setCoupon] = useState('')
  const [freqObs, setFreqObs] = useState('Trimestrielle')
  const [typeCoupon, setTypeCoupon] = useState('Conditionnel')
  const [barriereCoupon, setBarriereCoupon] = useState('70')
  const [rappelAuto, setRappelAuto] = useState('100')
  const [premierRappel, setPremierRappel] = useState('NC1Y')
  const [degressif, setDegressif] = useState(false)
  const [evolutionDe, setEvolutionDe] = useState('5')
  const [plancherDe, setPlancherDe] = useState('70')
  const [strike, setStrike] = useState('100')
  const [protection, setProtection] = useState('70')
  const [typeProtection, setTypeProtection] = useState('KI Europeenne')
  const [degressiviteStep, setDegressiviteStep] = useState('')
  const [oneStar, setOneStar] = useState(false)
  const [airbag, setAirbag] = useState('')

  // ── 2bis. Bloc reverse convertible ───────────────────────────────────
  const [rcCoupon, setRcCoupon] = useState('')
  const [rcBarriere, setRcBarriere] = useState('70')
  const [rcTypeProtection, setRcTypeProtection] = useState('KI Europeenne')
  const [rcFreq, setRcFreq] = useState('Trimestrielle')

  // ── 2ter. Bloc participation ──────────────────────────────────────────
  const [paParticipation, setPaParticipation] = useState('')
  const [paCap, setPaCap] = useState('')
  const [paFloor, setPaFloor] = useState('0')

  // ── 2quater. Bloc credit-linked ──────────────────────────────────────
  const [clEntite, setClEntite] = useState('')
  const [clSeniorite, setClSeniorite] = useState<'Senior' | 'Subordonne'>('Senior')
  const [clSpread, setClSpread] = useState('')

  // ── 2quinquies. Bloc produit personnalisé ────────────────────────────
  const [persoDesc, setPersoDesc] = useState('')

  // ── 3. Information sur la cotation ───────────────────────────────────
  const [reoffer, setReoffer] = useState('97')
  const [strikeDecale, setStrikeDecale] = useState(false)
  const [autreVariable, setAutreVariable] = useState('')

  // ── 4. Enveloppe ──────────────────────────────────────────────────────
  const [enveloppe, setEnveloppe] = useState<Enveloppe>('cto')
  const [noteOuverture, setNoteOuverture] = useState('')
  const [insurerChecked, setInsurerChecked] = useState<Record<string, boolean>>({})
  const [insurerFee, setInsurerFee] = useState<Record<string, string>>(defaultFees)
  const [autreAssureurCheck, setAutreAssureurCheck] = useState(false)
  const [autreAssureurNom, setAutreAssureurNom] = useState('')
  const [autreAssureurFee, setAutreAssureurFee] = useState('')
  const [integrerFrais, setIntegrerFrais] = useState(true)

  // ── 5. Émetteurs destinataires ───────────────────────────────────────
  const [emetteurChecked, setEmetteurChecked] = useState<boolean[]>(() => EMETTEURS.map(() => false))
  const [emetteursAutres, setEmetteursAutres] = useState('')
  const [prenomContact, setPrenomContact] = useState('')

  // ── Solve : un seul champ actif à la fois — cliquer le chip déjà actif
  //    l'éteint, cliquer un autre l'y remplace. ────────────────────────
  const [solving, setSolving] = useState<SolvableField | null>(null)
  const toggleSolve = (field: SolvableField) => setSolving((cur) => (cur === field ? null : field))

  // ── Sortie ────────────────────────────────────────────────────────────
  const [email, setEmail] = useState<string | null>(null)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const outputRef = useRef<HTMLPreElement>(null)

  // Même effet que l'artefact : changer de type de produit réinitialise le
  // type de coupon par défaut pour les structures autocall (Athena vs Phoenix).
  useEffect(() => {
    if (typeProduit === 'athena' || typeProduit === 'athena_airbag') setTypeCoupon('Lors du rappel')
    else if (typeProduit === 'phoenix') setTypeCoupon('Conditionnel')
  }, [typeProduit])

  const block = BLOCK_MAP[typeProduit]

  // ── Nominal : formatage milliers au fil de la frappe, curseur préservé ──
  const nominalRef = useRef<HTMLInputElement>(null)
  const pendingCursor = useRef<number | null>(null)
  useEffect(() => {
    if (pendingCursor.current != null && nominalRef.current) {
      nominalRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current)
      pendingCursor.current = null
    }
  }, [nominal])
  const onNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const cursorPos = input.selectionStart ?? input.value.length
    const oldLength = input.value.length
    const formatted = formatThousands(input.value)
    pendingCursor.current = Math.max(0, cursorPos + (formatted.length - oldLength))
    setNominal(formatted)
  }

  const addSousJacent = () => setSousJacents((l) => [...l, ''])
  const setSousJacent = (i: number, v: string) => setSousJacents((l) => l.map((x, j) => (j === i ? v : x)))
  const removeSousJacent = (i: number) => setSousJacents((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : l))

  const toggleEmetteur = (i: number) =>
    setEmetteurChecked((l) => l.map((v, j) => (j === i ? !v : v)))
  const toutSelectionner = () => {
    const tous = emetteurChecked.every(Boolean)
    setEmetteurChecked(EMETTEURS.map(() => !tous))
  }

  function buildPayoffBlock(): string[] {
    const lines: string[] = []
    const estDegressif = block === 'autocall' && degressif
    if (block === 'autocall') {
      lines.push(fmtSolve(solving, 'coupon', 'Coupon p.a.', coupon))
      lines.push(`Freq. observations : ${freqObs}`)
      lines.push(`Type de coupon : ${typeCoupon}`)
      if (typeProduit !== 'athena' && typeProduit !== 'athena_airbag') {
        lines.push(`${fmtSolve(solving, 'barriereCoupon', 'Barriere coupon', barriereCoupon)} avec effet Memoire`)
      }
      lines.push(`Niveau rappel automatique : ${rappelAuto}% - 1er rappel : ${premierRappel}`)
      if (estDegressif) {
        lines.push(`Structure degressive : evolution de ${evolutionDe}% / plancher de ${plancherDe}%`)
        lines.push(fmtSolve(solving, 'degressivite', 'Pas de degressivite', degressiviteStep, ''))
      }
      lines.push(fmtSolve(solving, 'strike', 'Niveau strike', strike))
      lines.push(`${fmtSolve(solving, 'protection', 'Niveau de protection', protection)} - Type : ${typeProtection}`)
      if (typeProduit === 'athena_airbag') lines.push(fmtSolve(solving, 'airbag', 'Airbag', airbag))
      if (oneStar) lines.push('Effet One Star active')
    } else if (block === 'reverse') {
      lines.push(fmtSolve(solving, 'rc_coupon', 'Coupon garanti p.a.', rcCoupon))
      lines.push(`${fmtSolve(solving, 'rc_barriere', 'Barriere protection / PDI', rcBarriere)} - Type : ${rcTypeProtection}`)
      lines.push(`Freq. coupon : ${rcFreq}`)
    } else if (block === 'participation') {
      lines.push(fmtSolve(solving, 'pa_participation', 'Taux de participation', paParticipation))
      lines.push(fmtSolve(solving, 'pa_cap', 'Cap', paCap))
      lines.push(`Floor : ${paFloor}%`)
    } else if (block === 'credit') {
      lines.push(`Entite de reference : ${clEntite || '[a preciser]'}`)
      lines.push(`Seniorite : ${clSeniorite}`)
      lines.push(fmtSolve(solving, 'cl_spread', 'Spread / Coupon', clSpread))
    } else {
      lines.push(persoDesc || '[description a completer]')
    }
    return lines
  }

  function getInsurerLines(): string[] {
    const lines: string[] = []
    for (const ins of INSURERS) {
      if (!insurerChecked[ins.feekey]) continue
      const fee = (insurerFee[ins.feekey] ?? '').trim()
      lines.push(`${ins.name}${fee ? ' - frais de referencement : ' + fee : ''}`)
    }
    if (autreAssureurCheck && autreAssureurNom.trim()) {
      const fee = autreAssureurFee.trim()
      lines.push(`${autreAssureurNom.trim()}${fee ? ' - frais de referencement : ' + fee : ''}`)
    }
    return lines
  }

  function generateEmail() {
    const sj = sousJacents.map((s) => s.trim()).filter(Boolean)
    const sjLabel = sj.length > 1 ? 'Worst-of ' + sj.join(' / ') : sj[0] || '[sous-jacent]'
    const estDegressif = block === 'autocall' && degressif

    const solvedLabels = solving ? [SOLVE_LABEL[solving]] : []
    const autreVar = autreVariable.trim()
    if (autreVar) solvedLabels.push(autreVar)
    const solveLine = solvedLabels.length ? solvedLabels.join(' / ') : '[variable a solver]'

    const bccList = EMETTEURS.filter((_, i) => emetteurChecked[i]).map((e) => e.bcc)
    const autres = emetteursAutres.split('\n').map((s) => s.trim()).filter(Boolean)
    const bccAll = [...bccList, ...autres]
    const toLine = '(pas de destinataire direct - envoi groupe en BCC)'
    const ccLine = PRIX_CC
    const bccLine = bccAll.length ? bccAll.join(', ') : '[emetteurs a preciser]'

    const payoffLines = buildPayoffBlock()
    const prenom = prenomContact.trim()

    let out = ''
    out += `A : ${toLine}\n`
    out += `CC : ${ccLine}\n`
    out += `BCC : ${bccLine}\n\n`
    out += `Sujet : CMF | ${TYPE_LABEL[typeProduit]}${estDegressif ? ' Degressif' : ''} ${maturite} ${devise} sur ${sjLabel} - Solve ${solveLine}\n\n`

    if (prenom) {
      out += `${prenom},\n\n`
      out += 'Peux-tu solver ?\n\n'
    } else {
      out += 'Bonjour,\n\n'
      out += `Merci de me coter la structure suivante${typeDemande === 'Optimisee' ? ' avec optimisation' : ''} :\n\n`
    }

    out += `** ${TYPE_LABEL[typeProduit].toUpperCase()}${estDegressif ? ' - DEGRESSIF' : ''} - ${sjLabel.toUpperCase()} **\n`
    out += `- Nominal : ${devise} ${nominal}\n`
    out += `- Devise : ${devise}\n`
    out += `- Maturite : ${maturite}\n`
    out += `- Sous-jacent(s) : ${sjLabel}\n`
    out += `- Enveloppe : ${ENVELOPPE_LABEL[enveloppe]}\n`
    for (const l of payoffLines) out += `- ${l}\n`
    if (strikeDecale) out += '- Strike decale\n'
    out += `- ${fmtSolve(solving, 'reoffer', 'Reoffer indicatif', reoffer)}\n`

    if (enveloppe === 'avfr') {
      const insLines = getInsurerLines()
      if (insLines.length) {
        out += '\nReferencement Assurance Vie France a prevoir chez :\n'
        for (const l of insLines) out += `- ${l}\n`
        if (integrerFrais) out += "\nMerci d'integrer les frais de referencement ci-dessus dans le prix communique.\n"
      }
    } else {
      const note = noteOuverture.trim()
      if (note) out += `\nNote emetteurs ouverts / verifications : ${note}\n`
    }

    if (prenom) {
      out += '\nLaurent'
    } else {
      out += '\nMerci de me revenir avec vos niveaux dans les meilleurs delais.\n\n'
      out += 'Bien a vous,\nLaurent'
    }

    setEmail(out)
    requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function fallbackCopy(text: string): boolean {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(ta)
    return ok
  }

  function selectOutputText() {
    const el = outputRef.current
    if (!el) return
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  function flashCopyMsg(label: string) {
    setCopyMsg(label)
    setTimeout(() => setCopyMsg(null), 2200)
  }

  async function copyEmail() {
    if (!email) return
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(email)
        flashCopyMsg('Copie OK')
        return
      } catch {
        /* repli ci-dessous */
      }
    }
    if (fallbackCopy(email)) {
      flashCopyMsg('Copie OK')
    } else {
      selectOutputText()
      flashCopyMsg('Copie bloquee - texte selectionne, fais Ctrl/Cmd+C')
    }
  }

  function resetForm() {
    setNominal('500 000')
    setDevise('EUR')
    setMaturite('60 Mois')
    setTypeProduit('phoenix')
    setTypeDemande('Classique')
    setSousJacents(['SX5E'])
    setCoupon('')
    setFreqObs('Trimestrielle')
    setTypeCoupon('Conditionnel')
    setBarriereCoupon('70')
    setRappelAuto('100')
    setPremierRappel('NC1Y')
    setDegressif(false)
    setEvolutionDe('5')
    setPlancherDe('70')
    setStrike('100')
    setProtection('70')
    setTypeProtection('KI Europeenne')
    setDegressiviteStep('')
    setOneStar(false)
    setAirbag('')
    setRcCoupon('')
    setRcBarriere('70')
    setRcTypeProtection('KI Europeenne')
    setRcFreq('Trimestrielle')
    setPaParticipation('')
    setPaCap('')
    setPaFloor('0')
    setClEntite('')
    setClSeniorite('Senior')
    setClSpread('')
    setPersoDesc('')
    setReoffer('97')
    setStrikeDecale(false)
    setAutreVariable('')
    setEnveloppe('cto')
    setNoteOuverture('')
    setInsurerChecked({})
    setInsurerFee(defaultFees())
    setAutreAssureurCheck(false)
    setAutreAssureurNom('')
    setAutreAssureurFee('')
    setIntegrerFrais(true)
    setEmetteurChecked(EMETTEURS.map(() => false))
    setEmetteursAutres('')
    setPrenomContact('')
    setSolving(null)
    setEmail(null)
  }

  const SolveChip = ({ field }: { field: SolvableField }) => (
    <button
      type="button"
      onClick={() => toggleSolve(field)}
      className={`mb-3 shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap ${
        solving === field
          ? 'border-cmf-navy bg-cmf-navy text-white'
          : 'border-cmf-blue/40 bg-cmf-blue/5 text-cmf-blue hover:bg-cmf-blue/10'
      }`}
      title="Marquer ce champ comme la variable à solver — un seul à la fois"
    >
      Solver
    </button>
  )

  const SolveField = ({
    field, label, value, onChange, placeholder,
  }: {
    field: SolvableField
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }) => (
    <div className="flex items-end gap-1.5">
      <div className="flex-1">
        <label className={labelCls}>{label}</label>
        {solving === field ? (
          <input
            readOnly
            value="SOLVER"
            className={`${inputCls} cursor-not-allowed bg-cmf-navy text-center font-bold tracking-wide text-white`}
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
          />
        )}
      </div>
      <SolveChip field={field} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">RFQ</h1>
        <p className="text-[13px] text-slate-500">
          Renseigne la structure à coter, l&apos;enveloppe, la ou les variable(s) à solver, coche les
          émetteurs, puis génère l&apos;email RFQ prêt à coller dans Outlook.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── 1. Sélection du produit ─────────────────────────────────── */}
        <Panel title="1 · Sélection du produit">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nominal</label>
              <input ref={nominalRef} value={nominal} onChange={onNominalChange} inputMode="numeric" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Devise</label>
              <select value={devise} onChange={(e) => setDevise(e.target.value as typeof devise)} className={inputCls}>
                <option>EUR</option>
                <option>USD</option>
                <option>CHF</option>
                <option>GBP</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Maturité</label>
              <input value={maturite} onChange={(e) => setMaturite(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type de produit</label>
              <select value={typeProduit} onChange={(e) => setTypeProduit(e.target.value as TypeProduit)} className={inputCls}>
                <option value="athena">Athena</option>
                <option value="athena_airbag">Athena Airbag</option>
                <option value="phoenix">Phoenix Memoire</option>
                <option value="certiplus">Certi+ (Participation)</option>
                <option value="creditlinked">Credit-Linked</option>
                <option value="tranchecln">Tranche CLN</option>
                <option value="reverse">Reverse Convertible</option>
                <option value="perso">Produit Personnalise</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Type de demande</label>
              <select value={typeDemande} onChange={(e) => setTypeDemande(e.target.value as typeof typeDemande)} className={inputCls}>
                <option>Classique</option>
                <option>Optimisee</option>
              </select>
            </div>
          </div>
          <label className={`${labelCls} mt-3`}>Sous-jacent(s)</label>
          <div className="mb-2 flex flex-col gap-1.5">
            {sousJacents.map((sj, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={sj}
                  onChange={(e) => setSousJacent(i, e.target.value)}
                  placeholder="Nom du sous-jacent"
                  className={`${inputCls} mb-0`}
                />
                {sousJacents.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSousJacent(i)}
                    className="rounded-md border border-slate-300 px-2.5 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addSousJacent} className="text-[12px] font-semibold text-cmf-blue hover:underline">
            + ajouter un sous-jacent
          </button>
        </Panel>

        {/* ── 2. Bloc dépendant du type de produit ────────────────────── */}
        {block === 'autocall' && (
          <Panel title="2 · Observations — note autocall">
            <SolveField field="coupon" label="Coupon P.A. (%)" value={coupon} onChange={setCoupon} placeholder="Inconnu a calculer" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Freq. observations</label>
                <select value={freqObs} onChange={(e) => setFreqObs(e.target.value)} className={inputCls}>
                  <option>Trimestrielle</option>
                  <option>Mensuelle</option>
                  <option>Semestrielle</option>
                  <option>Annuelle</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Type de coupon</label>
                <select value={typeCoupon} onChange={(e) => setTypeCoupon(e.target.value)} className={inputCls}>
                  <option>Conditionnel</option>
                  <option>Garanti</option>
                  <option>Lors du rappel</option>
                  <option>Increment journalier</option>
                </select>
              </div>
            </div>
            {typeProduit !== 'athena' && typeProduit !== 'athena_airbag' && (
              <div className="mt-3">
                <SolveField field="barriereCoupon" label="Barriere coupon (%)" value={barriereCoupon} onChange={setBarriereCoupon} />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Niv. rappel automatique (%)</label>
                <input value={rappelAuto} onChange={(e) => setRappelAuto(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>1er rappel</label>
                <select value={premierRappel} onChange={(e) => setPremierRappel(e.target.value)} className={inputCls}>
                  {['NC1Y', 'NC6M', 'NC1Y6M', 'NC2Y', 'NC3Y', 'NC4Y', 'NC5Y'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            {degressif && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Evolution de (%)</label>
                  <input value={evolutionDe} onChange={(e) => setEvolutionDe(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Plancher de (%)</label>
                  <input value={plancherDe} onChange={(e) => setPlancherDe(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
            <div className="mt-3">
              <SolveField field="strike" label="Niveau strike (%)" value={strike} onChange={setStrike} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SolveField field="protection" label="Niveau de protection (%)" value={protection} onChange={setProtection} />
              <div>
                <label className={labelCls}>Type de protection</label>
                <select value={typeProtection} onChange={(e) => setTypeProtection(e.target.value)} className={inputCls}>
                  <option>KI Europeenne</option>
                  <option>KI Americaine</option>
                  <option>Capital garanti</option>
                </select>
              </div>
            </div>
            <label className="mt-1 flex items-center gap-2 text-[13px] text-slate-700">
              <input type="checkbox" checked={degressif} onChange={(e) => setDegressif(e.target.checked)} />
              Structure degressive
            </label>
            <div className="mt-3">
              <SolveField
                field="degressivite"
                label="Degressivite (step %/observation)"
                value={degressiviteStep}
                onChange={setDegressiviteStep}
                placeholder="ex: -2,5%/T"
              />
            </div>
            <label className="mt-1 flex items-center gap-2 text-[13px] text-slate-700">
              <input type="checkbox" checked={oneStar} onChange={(e) => setOneStar(e.target.checked)} />
              Effet One Star
            </label>
            {typeProduit === 'athena_airbag' && (
              <div className="mt-3">
                <SolveField field="airbag" label="Airbag (%)" value={airbag} onChange={setAirbag} placeholder="ex: 20" />
              </div>
            )}
          </Panel>
        )}

        {block === 'reverse' && (
          <Panel title="2 · Note reverse convertible">
            <SolveField field="rc_coupon" label="Coupon garanti P.A. (%)" value={rcCoupon} onChange={setRcCoupon} />
            <div className="mt-3">
              <SolveField field="rc_barriere" label="Barriere protection / PDI (%)" value={rcBarriere} onChange={setRcBarriere} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type de protection</label>
                <select value={rcTypeProtection} onChange={(e) => setRcTypeProtection(e.target.value)} className={inputCls}>
                  <option>KI Europeenne</option>
                  <option>KI Americaine</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Freq. coupon</label>
                <select value={rcFreq} onChange={(e) => setRcFreq(e.target.value)} className={inputCls}>
                  <option>Trimestrielle</option>
                  <option>Semestrielle</option>
                  <option>Annuelle</option>
                </select>
              </div>
            </div>
          </Panel>
        )}

        {block === 'participation' && (
          <Panel title="2 · Note de participation">
            <SolveField field="pa_participation" label="Taux de participation (%)" value={paParticipation} onChange={setPaParticipation} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <SolveField field="pa_cap" label="Cap (%)" value={paCap} onChange={setPaCap} />
              <div>
                <label className={labelCls}>Floor (%)</label>
                <input value={paFloor} onChange={(e) => setPaFloor(e.target.value)} className={inputCls} />
              </div>
            </div>
          </Panel>
        )}

        {block === 'credit' && (
          <Panel title="2 · Note credit-linked">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Entite de reference</label>
                <input value={clEntite} onChange={(e) => setClEntite(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Seniorite</label>
                <select value={clSeniorite} onChange={(e) => setClSeniorite(e.target.value as typeof clSeniorite)} className={inputCls}>
                  <option>Senior</option>
                  <option>Subordonne</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <SolveField field="cl_spread" label="Spread / Coupon (%)" value={clSpread} onChange={setClSpread} />
            </div>
          </Panel>
        )}

        {block === 'perso' && (
          <Panel title="2 · Parametres produit personnalise">
            <label className={labelCls}>Description libre de la structure et des parametres</label>
            <textarea
              value={persoDesc}
              onChange={(e) => setPersoDesc(e.target.value)}
              placeholder="Decris ici le payoff, les parametres fixes et la/les variable(s) a solver"
              className={`${inputCls} min-h-[100px] resize-y`}
            />
          </Panel>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── 3. Information sur la cotation ──────────────────────────── */}
        <Panel title="3 · Information sur la cotation">
          <SolveField field="reoffer" label="Reoffer indicatif (%)" value={reoffer} onChange={setReoffer} />
          <label className="mt-1 flex items-center gap-2 text-[13px] text-slate-700">
            <input type="checkbox" checked={strikeDecale} onChange={(e) => setStrikeDecale(e.target.checked)} />
            Strike decale
          </label>
          <label className={`${labelCls} mt-3`}>Variable(s) additionnelle(s) à solver (hors champs cochés ci-dessus)</label>
          <input value={autreVariable} onChange={(e) => setAutreVariable(e.target.value)} placeholder="ex: maturite, autre..." className={inputCls} />
        </Panel>

        {/* ── 4. Enveloppe ─────────────────────────────────────────────── */}
        <Panel title="4 · Enveloppe">
          <label className={labelCls}>Type d&apos;enveloppe</label>
          <select value={enveloppe} onChange={(e) => setEnveloppe(e.target.value as Enveloppe)} className={inputCls}>
            <option value="cto">CTO (Compte-Titres Ordinaire)</option>
            <option value="avfr">Assurance Vie France</option>
            <option value="avlux">Assurance Vie Luxembourg</option>
          </select>

          {enveloppe !== 'avfr' ? (
            <>
              <p className="mt-2 text-[11.5px] text-slate-400">
                AV Lux / CTO : pas de circuit de référencement français — vérifie simplement que les
                émetteurs choisis sont bien ouverts sur ce contrat avant envoi.
              </p>
              <label className={labelCls}>Note émetteurs ouverts / vérifications spécifiques</label>
              <textarea
                value={noteOuverture}
                onChange={(e) => setNoteOuverture(e.target.value)}
                placeholder="ex: verifier ouverture Wealins pour cette structure"
                className={`${inputCls} min-h-[60px] resize-y`}
              />
            </>
          ) : (
            <>
              <p className="mt-2 text-[11.5px] text-slate-400">
                Module de référencement AV France — coche le/les assureur(s) concerné(s), classés par
                ordre alphabétique. Frais préremplis à partir des infos connues (à corriger/compléter au
                fil de l&apos;eau).
              </p>
              <div className="columns-2 gap-6">
                {INSURERS.map((ins) => (
                  <div key={ins.feekey} className="mb-2 grid grid-cols-[16px_1fr_1fr] items-center gap-2 break-inside-avoid">
                    <input
                      type="checkbox"
                      checked={!!insurerChecked[ins.feekey]}
                      onChange={(e) => setInsurerChecked((m) => ({ ...m, [ins.feekey]: e.target.checked }))}
                    />
                    <span className="truncate text-[12.5px] font-semibold text-slate-800" title={ins.name}>
                      {ins.name}
                    </span>
                    <input
                      value={insurerFee[ins.feekey] ?? ''}
                      onChange={(e) => setInsurerFee((m) => ({ ...m, [ins.feekey]: e.target.value }))}
                      placeholder={ins.placeholder}
                      className="mb-0 rounded-md border border-slate-300 px-1.5 py-1 text-[12px]"
                    />
                  </div>
                ))}
                <div className="mb-2 grid grid-cols-[16px_1fr_1fr] items-center gap-2 break-inside-avoid">
                  <input type="checkbox" checked={autreAssureurCheck} onChange={(e) => setAutreAssureurCheck(e.target.checked)} />
                  <input
                    value={autreAssureurNom}
                    onChange={(e) => setAutreAssureurNom(e.target.value)}
                    placeholder="Autre assureur..."
                    className="mb-0 rounded-md border border-slate-300 px-1.5 py-1 text-[12px]"
                  />
                  <input
                    value={autreAssureurFee}
                    onChange={(e) => setAutreAssureurFee(e.target.value)}
                    placeholder="frais"
                    className="mb-0 rounded-md border border-slate-300 px-1.5 py-1 text-[12px]"
                  />
                </div>
              </div>
              <label className="mt-1 flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={integrerFrais} onChange={(e) => setIntegrerFrais(e.target.checked)} />
                Demander l&apos;intégration des frais de référencement dans le prix
              </label>
            </>
          )}
        </Panel>
      </div>

      {/* ── 5. Émetteurs destinataires ──────────────────────────────────── */}
      <Panel title="5 · Émetteurs destinataires">
        <p className="mb-2.5 rounded-md border border-cmf-blue/30 bg-cmf-blue/5 px-3 py-2 text-[12px] text-cmf-blue">
          Coche les émetteurs à qui envoyer. CC systématique : <strong>{PRIX_CC}</strong> — BCC : adresse
          générique équipe de chaque émetteur coché (pas de TO).
        </p>
        <button
          type="button"
          onClick={toutSelectionner}
          className="mb-2.5 rounded-md border border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
        >
          {emetteurChecked.every(Boolean) ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
        <div className="columns-2 gap-6">
          {EMETTEURS.map((e, i) => (
            <label key={e.name} className="flex items-center gap-2 border-b border-slate-100 py-1.5 text-[12.5px] break-inside-avoid">
              <input type="checkbox" checked={emetteurChecked[i]} onChange={() => toggleEmetteur(i)} />
              <span className="font-semibold text-slate-800">{e.name}</span>
            </label>
          ))}
        </div>
        <label className={`${labelCls} mt-3`}>Émetteur(s) additionnel(s) non listé(s) — nom / email, un par ligne</label>
        <textarea
          value={emetteursAutres}
          onChange={(e) => setEmetteursAutres(e.target.value)}
          placeholder="ex: XYZ Bank - contact@xyzbank.com"
          className={`${inputCls} min-h-[60px] resize-y`}
        />
        <label className={labelCls}>Prénom du contact (optionnel — active le tutoiement)</label>
        <input value={prenomContact} onChange={(e) => setPrenomContact(e.target.value)} placeholder="ex: Matteo" className={inputCls} />
        <p className="text-[11.5px] text-slate-400">
          Si renseigné : email court et informel (« Matteo, Peux-tu solver ? »). Si vide : email formel
          par défaut (« Bonjour, » / « vous »).
        </p>
      </Panel>

      <div className="flex gap-2.5">
        <button type="button" onClick={generateEmail} className="rounded-lg bg-cmf-navy px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-90">
          Générer l&apos;email RFQ
        </button>
        <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
          Réinitialiser
        </button>
      </div>

      {email && (
        <Panel
          title="Email RFQ généré"
          right={<span className="rounded-full bg-cmf-navy px-2.5 py-1 text-[11px] font-semibold text-white">prêt à coller</span>}
        >
          <pre
            ref={outputRef}
            className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-[12.5px] leading-relaxed text-slate-800"
          >
            {email}
          </pre>
          <div className="mt-3 flex items-center gap-2.5">
            <button type="button" onClick={copyEmail} className="rounded-lg bg-cmf-navy px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-90">
              Copier le texte
            </button>
            {copyMsg && <span className="text-[12px] font-medium text-emerald-600">{copyMsg}</span>}
          </div>
        </Panel>
      )}
    </div>
  )
}
