// ─────────────────────────────────────────────────────────────────────────
//  Mini-client KV (Vercel KV / Upstash Redis REST) via fetch — sans dépendance.
//  Variables : KV_REST_API_URL, KV_REST_API_TOKEN (fournies par Vercel KV).
//  Dégrade proprement si non configuré (kvConfigured() === false).
// ─────────────────────────────────────────────────────────────────────────
const URL = process.env.KV_REST_API_URL
const TOKEN = process.env.KV_REST_API_TOKEN

export const kvConfigured = (): boolean => !!(URL && TOKEN)

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!kvConfigured()) return null
  try {
    const res = await fetch(`${URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = (await res.json()) as { result?: string | null }
    if (j.result == null) return null
    return JSON.parse(j.result) as T
  } catch {
    return null
  }
}

export async function kvSet(key: string, value: unknown): Promise<boolean> {
  if (!kvConfigured()) return false
  try {
    const res = await fetch(`${URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    })
    return res.ok
  } catch {
    return false
  }
}
