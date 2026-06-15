// ─────────────────────────────────────────────────────────────────────────
//  Client Microsoft Graph (app-only / client credentials) pour lire un dossier
//  Outlook côté serveur (cron). Aucune dépendance : OAuth + REST via fetch.
//
//  Variables d'environnement requises (à définir dans Vercel) :
//    GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   (app registration Azure,
//      permission APPLICATION « Mail.Read » avec admin consent)
//    DECREMENT_MAILBOX   (déf. l.sebah@cmf.finance)
//    DECREMENT_FOLDER_ID (déf. = dossier Emetteurs ▸ Décrement)
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_MAILBOX = process.env.DECREMENT_MAILBOX ?? 'l.sebah@cmf.finance'
export const DEFAULT_FOLDER_ID =
  process.env.DECREMENT_FOLDER_ID ??
  'AAMkAGFmZmE3YTNhLTg5MWUtNGQ2MC1iZTY5LWYwYjU3ODQyMWVhYwAuAAAAAADw9l3-cRVeQ5r-_IQauFxrAQBohwpen8s7RLOOlacY0owfAALuzKBuAAA='

export interface GraphMessage {
  id: string
  subject: string
  from: string
  receivedDateTime: string
  hasAttachments: boolean
  bodyPreview?: string
}

export function graphConfigured(): boolean {
  return !!(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET)
}

async function getToken(): Promise<string> {
  const tenant = process.env.GRAPH_TENANT_ID!
  const body = new URLSearchParams({
    client_id: process.env.GRAPH_CLIENT_ID!,
    client_secret: process.env.GRAPH_CLIENT_SECRET!,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Graph token ${res.status}: ${await res.text()}`)
  const j = (await res.json()) as { access_token?: string }
  if (!j.access_token) throw new Error('Graph token: pas de access_token')
  return j.access_token
}

interface GraphMsgRaw {
  id: string
  subject?: string
  receivedDateTime?: string
  hasAttachments?: boolean
  bodyPreview?: string
  from?: { emailAddress?: { address?: string } }
}

/** Liste les messages d'un dossier (les plus récents d'abord), optionnellement depuis `since` (ISO). */
export async function listFolderMessages(opts: {
  mailbox?: string
  folderId?: string
  since?: string
  top?: number
}): Promise<GraphMessage[]> {
  const mailbox = opts.mailbox ?? DEFAULT_MAILBOX
  const folderId = opts.folderId ?? DEFAULT_FOLDER_ID
  const top = opts.top ?? 50
  const token = await getToken()

  const params = new URLSearchParams({
    $top: String(top),
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,from,receivedDateTime,hasAttachments,bodyPreview',
  })
  if (opts.since) params.set('$filter', `receivedDateTime ge ${opts.since}`)

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/${folderId}/messages?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Graph messages ${res.status}: ${await res.text()}`)
  const j = (await res.json()) as { value?: GraphMsgRaw[] }
  return (j.value ?? []).map((m) => ({
    id: m.id,
    subject: m.subject ?? '',
    from: m.from?.emailAddress?.address ?? '',
    receivedDateTime: m.receivedDateTime ?? '',
    hasAttachments: !!m.hasAttachments,
    bodyPreview: m.bodyPreview,
  }))
}
