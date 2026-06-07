import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'
import { fetchHistory, closeAt, lastClose } from '@/lib/yahoo'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Niveau worst-of constaté à chaque observation passée (pour le suivi des
// coupons) + niveaux COURANTS des sous-jacents (en % du strike) pour afficher la
// performance dans la fiche produit.
export async function GET(req: Request) {
  const isin = new URL(req.url).searchParams.get('isin')
  if (!isin) return NextResponse.json({ error: 'isin requis' }, { status: 400 })
  const p = products.find((x) => x.isin === isin)
  if (!p) return NextResponse.json({ error: 'produit inconnu' }, { status: 404 })

  const vide = { isin, niveaux: {}, courant: null as null | unknown }
  const symbols = p.sousJacents.map((u) => yahooSymbol(u.bloomberg))
  if (symbols.length === 0 || symbols.some((s) => s === null)) {
    return NextResponse.json({
      ...vide,
      incomplet: true,
      raison: 'un sous-jacent au moins n’est pas disponible sur Yahoo (indice propriétaire / taux)',
    })
  }

  const period1 = Math.floor(new Date(p.dateConstatationInitiale).getTime() / 1000)
  if (!Number.isFinite(period1)) {
    return NextResponse.json({ ...vide, incomplet: true, raison: 'date initiale invalide' })
  }

  try {
    const histories = await Promise.all((symbols as string[]).map((s) => fetchHistory(s, period1)))
    // Strike = clôture de chaque sous-jacent à la date de constatation initiale
    // (ou niveau initial figé dans la termsheet s'il est connu).
    const strikes = histories.map(
      (h, j) => p.sousJacents[j].niveauInitial ?? closeAt(h, p.dateConstatationInitiale) ?? h[0]?.close,
    )
    if (strikes.some((s) => !s)) {
      return NextResponse.json({ ...vide, incomplet: true, raison: 'strike introuvable' })
    }

    // Worst-of constaté à chaque observation passée.
    const today = new Date().toISOString().slice(0, 10)
    const niveaux: Record<string, number> = {}
    for (const o of p.observations ?? []) {
      const d = o.dateObservation
      if (d > today) continue
      let worst: number | undefined
      for (let j = 0; j < histories.length; j++) {
        const c = closeAt(histories[j], d)
        if (typeof c !== 'number') {
          worst = undefined
          break
        }
        const perf = (c / (strikes[j] as number)) * 100
        worst = worst === undefined ? perf : Math.min(worst, perf)
      }
      if (typeof worst === 'number') niveaux[d] = Math.round(worst * 100) / 100
    }

    // Niveaux courants (dernière clôture) en % du strike.
    const sj = histories.map((h, j) => {
      const last = lastClose(h)
      const strike = strikes[j] as number
      const pct = typeof last === 'number' && strike ? Math.round((last / strike) * 10000) / 100 : null
      return { nom: p.sousJacents[j].nom, pct }
    })
    const worstOf = sj.some((x) => x.pct === null)
      ? null
      : Math.min(...sj.map((x) => x.pct as number))

    return NextResponse.json({ isin, niveaux, symbols, courant: { worstOf, sj } })
  } catch (e) {
    return NextResponse.json({ ...vide, incomplet: true, raison: String(e) })
  }
}
