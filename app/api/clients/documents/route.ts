import { NextResponse } from 'next/server'
import inventaire from '@/data/client-docs.json'
import type { InventaireDocs } from '@/lib/client-docs'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Inventaire des pièces déposées dans OneDrive ▸ Documents ▸ Clients, alimenté
// par scripts/sync-client-docs.mjs. L'app ne peut pas lire un chemin Windows
// local depuis Vercel : elle sert l'inventaire versionné, et l'onglet
// Maintenance en déduit la présence du DER (lib/client-docs).
export async function GET() {
  const inv = inventaire as unknown as InventaireDocs
  return NextResponse.json({
    genere: inv.genere ?? null,
    racine: inv.racine,
    dossiers: inv.dossiers ?? {},
    /** Aucune synchro encore passée → l'interface doit dire « inconnu », pas « absent ». */
    synchronise: inv.genere != null,
  })
}
