import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Modèle d'extraction (surchargeable par variable d'env). N'utilise PAS le
// modèle « identité » de l'assistant.
const MODEL = process.env.TS_PARSE_MODEL || 'claude-sonnet-4-6'

// Schéma de l'objet produit attendu (aligné sur le masque « Nouveau produit »).
const TOOL = {
  name: 'extract_product',
  description:
    "Renvoie les caractéristiques structurées d'un produit structuré (autocall/phoenix/athena/reverse convertible/note de taux/CLN…) extraites de sa term sheet. Laisse vide tout champ non déterminé avec certitude.",
  input_schema: {
    type: 'object',
    properties: {
      nom: { type: 'string', description: 'Nom commercial / payoff lisible, ex. « 7Y Phoenix Memory Wof Micron + Marvell »' },
      isin: { type: 'string' },
      emetteur: { type: 'string' },
      garant: { type: 'string' },
      assetClass: { type: 'string', enum: ['equity', 'rates', 'credit', 'commodity', 'fx', 'hybrid'] },
      family: {
        type: 'string',
        enum: ['autocall', 'reverse_convertible', 'capital_protected', 'participation', 'credit_linked', 'rates_structured', 'other'],
      },
      productType: { type: 'string', description: 'Phoenix / Athéna / Booster / Airbag / Reverse Convertible / Participation / Callable…' },
      eusipa: { type: 'string', description: 'Code EUSIPA / SSPA si présent' },
      devise: { type: 'string', description: 'Code ISO, ex. EUR, USD' },
      nominal: { type: 'number', description: 'Nominal de l’émission (montant total), si indiqué' },
      valeurNominale: { type: 'number', description: 'Dénomination unitaire (ex. 1000)' },
      prixEmission: { type: 'number', description: 'Prix d’émission en %, ex. 100' },
      dateConstatationInitiale: { type: 'string', description: 'Strike date (AAAA-MM-JJ)' },
      dateEmission: { type: 'string', description: 'Issue date (AAAA-MM-JJ)' },
      dateConstatationFinale: { type: 'string', description: 'Final valuation date (AAAA-MM-JJ)' },
      dateEcheance: { type: 'string', description: 'Maturity / redemption date (AAAA-MM-JJ)' },
      frequence: { type: 'string', enum: ['mensuel', 'trimestriel', 'semestriel', 'annuel', 'in_fine', 'autre'] },
      basket: { type: 'string', enum: ['single', 'worst_of', 'best_of', 'equipondere', 'panier'] },
      sousJacents: {
        type: 'array',
        description: 'Sous-jacents avec ticker Bloomberg si possible (ex. « MU US », « SAF FP », « SX5E Index »)',
        items: {
          type: 'object',
          properties: {
            nom: { type: 'string' },
            bloomberg: { type: 'string' },
            niveauInitial: { type: 'number' },
          },
          required: ['nom'],
        },
      },
      sens: { type: 'string', enum: ['standard', 'inverse'], description: 'Autocall : inverse = rappel si le sous-jacent BAISSE' },
      effetMemoire: { type: 'boolean' },
      degressif: { type: 'boolean', description: 'Barrière de rappel dégressive (step-down)' },
      airbag: { type: 'boolean' },
      oxygene: { type: 'boolean' },
      couponPa: { type: 'number', description: 'Coupon annualisé en %' },
      barriereCouponPct: { type: 'number', description: 'Barrière de coupon en % de l’initial' },
      barriereRappelPct: { type: 'number', description: 'Barrière de rappel en % de l’initial' },
      protectionPct: { type: 'number', description: 'Barrière de protection du capital (PDI) en % de l’initial' },
      protectionStyle: { type: 'string', enum: ['europeenne', 'americaine'] },
      bonusFinalPct: { type: 'number' },
      description: { type: 'string', description: 'Résumé d’une ligne du produit' },
    },
    required: ['isin'],
  },
} as const

const PROMPT = `Tu es un analyste de produits structurés. Analyse la term sheet fournie et renseigne l'outil extract_product.
- Déduis la FAMILLE et le TYPE (Phoenix, Athéna, Reverse Convertible, Booster/Participation, note de taux, CLN…) à partir du mécanisme décrit.
- Donne chaque sous-jacent avec son ticker Bloomberg (ex. « MU US », « SAF FP », « SX5E Index ») quand c'est identifiable.
- Convertis toutes les dates au format AAAA-MM-JJ.
- Exprime les barrières en % du niveau initial, le coupon en % annualisé.
- N'INVENTE RIEN : laisse vide tout champ non déterminé avec certitude.
Réponds uniquement via l'appel d'outil.`

interface Body {
  pdfBase64?: string
  text?: string
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: "Clé API Claude absente : définis ANTHROPIC_API_KEY dans l'environnement du déploiement." },
      { status: 503 },
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }
  if (!body.pdfBase64 && !body.text) {
    return NextResponse.json({ error: 'Fournir un PDF (pdfBase64) ou du texte.' }, { status: 400 })
  }

  const content: unknown[] = []
  if (body.pdfBase64)
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.pdfBase64 } })
  if (body.text) content.push({ type: 'text', text: `Term sheet (texte) :\n\n${body.text}` })
  content.push({ type: 'text', text: PROMPT })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'extract_product' },
        messages: [{ role: 'user', content }],
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      return NextResponse.json({ error: `Claude API ${res.status}`, detail: detail.slice(0, 600) }, { status: 502 })
    }
    const data = (await res.json()) as { content?: Array<{ type: string; name?: string; input?: unknown }> }
    const tool = (data.content ?? []).find((c) => c.type === 'tool_use' && c.name === 'extract_product')
    if (!tool?.input) {
      return NextResponse.json({ error: "Aucune extraction structurée n'a été renvoyée." }, { status: 502 })
    }
    return NextResponse.json({ product: tool.input })
  } catch (e) {
    return NextResponse.json({ error: 'Échec de l’appel au modèle.', detail: String(e).slice(0, 300) }, { status: 502 })
  }
}
