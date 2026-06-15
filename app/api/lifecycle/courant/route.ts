import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'
import { fetchHistory, closeAt, lastClose, type Bar } from '@/lib/yahoo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Niveau COURANT du worst-of par produit (en % du strike), pour estimer la
// probabilité d'autocall dans le calendrier. Batché : on ne télécharge qu'UNE
// fois l'historique de chaque symbole Yahoo (mutualisé entre produits).
export async function GET(req: Request) {
  const isinsParam = new URL(req.url).searchParams.get('isins')
  const wanted = isinsParam ? new Set(isinsParam.split(',').filter(Boolean)) : null
  const list = products.filter(
    (p) => (!wanted || wanted.has(p.isin)) && p.sousJacents.length > 0,
  )

  // Symboles Yahoo uniques → période de départ la plus ancienne nécessaire.
  const symPeriod = new Map<string, number>()
  for (const p of list) {
    const t = Math.floor(new Date(p.dateConstatationInitiale).getTime() / 1000)
    const p1 = Number.isFinite(t) ? t : Math.floor(Date.now() / 1000) - 5 * 365 * 86400
    for (const u of p.sousJacents) {
      const s = yahooSymbol(u.bloomberg)
      if (!s) continue
      symPeriod.set(s, Math.min(symPeriod.get(s) ?? p1, p1))
    }
  }

  const hist = new Map<string, Bar[]>()
  await Promise.all(
    Array.from(symPeriod.entries()).map(async ([s, p1]) => {
      try {
        hist.set(s, await fetchHistory(s, p1))
      } catch {
        hist.set(s, [])
      }
    }),
  )

  const courant: Record<string, { worstOf: number | null; sj: { nom: string; pct: number | null }[] }> = {}
  for (const p of list) {
    const sj: { nom: string; pct: number | null }[] = []
    let worst: number | null = null
    let manque = false
    for (const u of p.sousJacents) {
      const s = yahooSymbol(u.bloomberg)
      let pct: number | null = null
      if (s) {
        const bars = hist.get(s) ?? []
        const last = lastClose(bars)
        const strike =
          u.niveauInitial ?? closeAt(bars, p.dateConstatationInitiale) ?? bars[0]?.close
        if (typeof last === 'number' && typeof strike === 'number' && strike > 0)
          pct = Math.round((last / strike) * 10000) / 100
      }
      if (pct === null) manque = true
      else worst = worst === null ? pct : Math.min(worst, pct)
      sj.push({ nom: u.nom, pct })
    }
    courant[p.isin] = { worstOf: manque ? null : worst, sj }
  }

  return NextResponse.json({ courant })
}
