import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { kvConfigured, kvGet } from '@/lib/kv'
import { clientsAvecReporting } from '@/lib/client-report'
import { produitsEffectifs } from '@/lib/server-overlays'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Liste des clients ayant au moins une position vivante valorisée — consommée par
// scripts/reporting_clients.mjs pour générer un PDF par client. Même règle que le
// reporting (lib/client-report) afin de ne lister que les clients réellement rendus.
//
// Les surcouches du terminal (trades saisis via « + Nouveau trade », affectations
// clients, statuts forcés) sont appliquées AVANT le filtrage : sans elles, un
// trade saisi à la main n'existait pas pour le reporting et son client était
// compté « sans position valorisée ».
interface Overlay {
  prices: Record<string, number>
}

export async function GET() {
  const o = kvConfigured() ? await kvGet<Overlay>('prices:overlay') : null
  const priceMap = o?.prices ?? {}
  try {
    const { products: effectifs, allocsOf } = await produitsEffectifs(products)
    const clients = clientsAvecReporting(effectifs, { perfMap: {}, niveauxMap: {}, priceMap }, allocsOf)
    return NextResponse.json({ clients })
  } catch (e) {
    // Surcouches illisibles : on refuse de renvoyer une liste amputée, qui
    // ferait silencieusement sauter des clients de l'envoi.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Surcouches du terminal illisibles.' },
      { status: 503 },
    )
  }
}
