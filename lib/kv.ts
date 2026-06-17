// ─────────────────────────────────────────────────────────────────────────
//  Mini-client KV — supporte deux modes selon ce que le store Vercel injecte :
//   1) REST (Vercel KV / Upstash REST) : KV_REST_API_URL + KV_REST_API_TOKEN
//      (ou UPSTASH_REDIS_REST_URL / _TOKEN).
//   2) Connexion Redis classique : REDIS_URL (ou KV_URL) — via ioredis (TCP/TLS).
//  Dégrade proprement si rien n'est configuré (kvConfigured() === false).
//  À n'utiliser que dans des routes `runtime = 'nodejs'` (ioredis ≠ edge).
// ─────────────────────────────────────────────────────────────────────────
import type RedisClient from 'ioredis'

const REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const REDIS_URL = process.env.REDIS_URL ?? process.env.KV_URL

export const kvConfigured = (): boolean => !!((REST_URL && REST_TOKEN) || REDIS_URL)

// Client Redis réutilisé entre invocations chaudes (créé à la demande).
let client: RedisClient | null = null
async function redis(): Promise<RedisClient | null> {
  if (!REDIS_URL) return null
  if (client) return client
  const { default: Redis } = await import('ioredis')
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
  })
  client.on('error', () => {}) // évite un crash sur erreur transitoire
  return client
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (REST_URL && REST_TOKEN) {
    try {
      const res = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REST_TOKEN}` },
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
  try {
    const c = await redis()
    if (!c) return null
    const v = await c.get(key)
    return v == null ? null : (JSON.parse(v) as T)
  } catch {
    return null
  }
}

export async function kvSet(key: string, value: unknown): Promise<boolean> {
  if (REST_URL && REST_TOKEN) {
    try {
      const res = await fetch(`${REST_URL}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      return res.ok
    } catch {
      return false
    }
  }
  try {
    const c = await redis()
    if (!c) return false
    await c.set(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
