// ─────────────────────────────────────────────────────────────────────────
//  Classification des mails du dossier « Décrément » : on distingue les
//  NOUVEAUX indices/TS, les MISES À JOUR de runs (prix), les idées/axes (bruit)
//  et le reste. Détection de l'émetteur par domaine expéditeur ou préfixe sujet.
//
//  (Phase suivante — extraction fine des niveaux coupon/upfront par émetteur
//  pour alimenter la base comparatif — viendra enrichir ce module.)
// ─────────────────────────────────────────────────────────────────────────
export type RunKind = 'new_index' | 'run_update' | 'idea' | 'other'

export interface MailInput {
  id: string
  subject: string
  from: string
  receivedDateTime: string
  hasAttachments: boolean
}

export interface ClassifiedMail {
  id: string
  subject: string
  issuer: string
  kind: RunKind
  date: string
  hasAttachments: boolean
}

const ISSUER_BY_HINT: [RegExp, string][] = [
  [/bbva/i, 'BBVA'],
  [/\bubs\b/i, 'UBS'],
  [/gs\.com|goldman|marquee\.gs/i, 'GS'],
  [/bnpparibas|bnpp/i, 'BNP'],
  [/sgcib|sgmarkets|socgen|societe ?generale|\bsg\b/i, 'SG'],
  [/bofa|baml|merrill/i, 'BofA'],
  [/morganstanley|morgan stanley/i, 'Morgan Stanley'],
  [/santander/i, 'Santander'],
  [/mediobanca/i, 'Mediobanca'],
  [/cibc/i, 'CIBC'],
  [/nomura/i, 'Nomura'],
  [/barclays/i, 'Barclays'],
  [/\bciti\b|citigroup/i, 'Citi'],
  [/marex/i, 'Marex'],
]

function issuerOf(from: string, subject: string): string {
  for (const [re, name] of ISSUER_BY_HINT) if (re.test(from) || re.test(subject)) return name
  const m = subject.match(/^\s*\[([A-Za-zÀ-ÿ&\s.]{2,14})\]/)
  return m ? m[1].trim().toUpperCase() : 'Autre'
}

function kindOf(subject: string): RunKind {
  const s = subject.toLowerCase()
  if (s.includes('new index') || s.includes('nouvel indice')) return 'new_index'
  if (/(trade idea|monday brokers|push|idée|idea|weekly|investment ideas|axe)/.test(s)) return 'idea'
  if (/(\brun\b|autocall|ath[ée]na|phoenix|d[ée]cr[ée]ment|decrement|indices)/.test(s)) return 'run_update'
  return 'other'
}

export function classifyMail(m: MailInput): ClassifiedMail {
  return {
    id: m.id,
    subject: m.subject,
    issuer: issuerOf(m.from, m.subject),
    kind: kindOf(m.subject),
    date: m.receivedDateTime,
    hasAttachments: m.hasAttachments,
  }
}

export interface Summary {
  classified: ClassifiedMail[]
  nouveaux: number
  majs: number
}

export function summarize(mails: MailInput[]): Summary {
  const classified = mails.map(classifyMail)
  return {
    classified,
    nouveaux: classified.filter((c) => c.kind === 'new_index').length,
    majs: classified.filter((c) => c.kind === 'run_update').length,
  }
}
