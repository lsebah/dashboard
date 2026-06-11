import { NextResponse } from 'next/server'
import seed from '@/data/decrement-monitoring.json'
import { graphConfigured, listFolderMessages, DEFAULT_MAILBOX, DEFAULT_FOLDER_ID } from '@/lib/graph'
import { kvConfigured, kvGet, kvSet } from '@/lib/kv'
import { summarize } from '@/lib/decrement/parser'
import type { MonitoringState } from '@/lib/decrement/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const KV_KEY = 'decrement:monitoring'

// Cron quotidien (19h Paris). Lit le dossier Outlook via Microsoft Graph, classe
// les mails (nouveaux indices vs runs), met à jour l'état KV lu par le dashboard.
export async function GET(req: Request) {
  // Auth : Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ».
  if (process.env.CRON_SECRET) {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  if (!graphConfigured()) {
    return NextResponse.json(
      {
        error: 'Microsoft Graph non configuré.',
        needs: ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET'],
        mailbox: DEFAULT_MAILBOX,
        folderId: DEFAULT_FOLDER_ID,
      },
      { status: 503 },
    )
  }

  const prev = (await kvGet<MonitoringState>(KV_KEY)) ?? (seed as MonitoringState)
  const since = prev.lastCheck ?? new Date(Date.now() - 7 * 86400000).toISOString()

  let mails
  try {
    mails = await listFolderMessages({ since, top: 50 })
  } catch (e) {
    const errState: MonitoringState = { ...prev, lastCheck: new Date().toISOString(), statut: 'erreur' }
    if (kvConfigured()) await kvSet(KV_KEY, errState)
    return NextResponse.json({ error: `Lecture Graph échouée : ${String(e)}` }, { status: 502 })
  }

  const { classified, nouveaux, majs } = summarize(mails)
  const now = new Date().toISOString()
  const details =
    classified
      .filter((c) => c.kind === 'new_index' || c.kind === 'run_update')
      .slice(0, 8)
      .map((c) => `${c.issuer}${c.kind === 'new_index' ? ' (NEW)' : ''}`)
      .join(', ') || 'Aucun nouveau run depuis le dernier scan.'

  const next: MonitoringState = {
    ...prev,
    dossier: prev.dossier ?? `Outlook ▸ Emetteurs ▸ Décrement (${DEFAULT_MAILBOX})`,
    lastCheck: now,
    statut: 'ok',
    nouveaux,
    majs,
    historique: [...(prev.historique ?? []), { date: now, nouveaux, majs, statut: 'ok', details }].slice(-30),
  }
  const persisted = kvConfigured() ? await kvSet(KV_KEY, next) : false

  return NextResponse.json({ ok: true, nouveaux, majs, persisted, classified: classified.slice(0, 15) })
}
