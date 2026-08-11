import { NextResponse } from 'next/server'
import { products } from '@/lib/products'
import { yahooSymbol } from '@/lib/underlyings'
import { fetchHistory, closeAt, lastClose, type Bar } from '@/lib/yahoo'
import { kvConfigured, kvGet } from '@/lib/kv'
import { aggregateBasket } from '@/lib/lifecycle'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

// Niveau worst-of constaté à chaque observation passée (pour le suivi des
// coupons) + niveaux COURANTS des sous-jacents (en % du strike) pour afficher la
// performance dans la fiche produit.
//
// Le strike de chaque sous-jacent est soit figé dans la termsheet
// (`niveauInitial`), soit RECONSTRUIT = clôture Yahoo à la date de constatation
// initiale. Le calcul est résilient par sous-jacent : un sous-jacent
// indisponible (indice propriétaire, échec Yahoo) ⇒ « — » pour CELUI-LÀ
// uniquement, les autres affichent bien leur performance.
export async function GET(req: Request) {
  const isin = new URL(req.url).searchParams.get('isin')
  if (!isin) return NextResponse.json({ error: 'isin requis' }, { status: 400 })
  const p = products.find((x) => x.isin === isin)
  if (!p) return NextResponse.json({ error: 'produit inconnu' }, { status: 404 })

  const t = Math.floor(new Date(p.dateConstatationInitiale).getTime() / 1000)
  const period1 = Number.isFinite(t) ? t : Math.floor(Date.now() / 1000) - 5 * 365 * 86400

  // Strikes Bloomberg (BDH à la date de constatation initiale) par ISIN produit —
  // pour les indices à décrément non cotés Yahoo dont le strike n'est pas figé
  // dans la termsheet. Même overlay que l'onglet Décrément (`decrement:strikes`).
  const strikesOverlay = kvConfigured()
    ? (await kvGet<{ strikes: Record<string, { ticker?: string; value: number }> }>('decrement:strikes:overlay'))?.strikes ?? {}
    : {}
  const normTicker = (x?: string) => (x ?? '').replace(/\s+(Index|Equity|Comdty|Curncy)$/i, '').trim()

  // Par sous-jacent : symbole Yahoo, historique, strike (TS > Yahoo à la
  // constatation > overlay Bloomberg BDH).
  const cols = await Promise.all(
    p.sousJacents.map(async (u) => {
      const sym = yahooSymbol(u.bloomberg)
      let bars: Bar[] = []
      if (sym) {
        try {
          bars = await fetchHistory(sym, period1)
        } catch {
          bars = []
        }
      }
      const sEntry = strikesOverlay[p.isin]
      const strikeBbg =
        sEntry && (!sEntry.ticker || normTicker(sEntry.ticker) === normTicker(u.bloomberg))
          ? sEntry.value
          : undefined
      const strike =
        u.niveauInitial ?? closeAt(bars, p.dateConstatationInitiale) ?? bars[0]?.close ?? strikeBbg
      return { nom: u.nom, sym, bars, strike, bbg: u.bloomberg?.trim() }
    }),
  )

  // Niveaux Bloomberg (PX_Last) par ticker — repli pour les sous-jacents non
  // mappables Yahoo (indices à décrément, baskets propriétaires…).
  const levels = kvConfigured()
    ? (await kvGet<{ levels: Record<string, number> }>('levels:overlay'))?.levels ?? {}
    : {}

  // Niveaux courants (% du strike) par sous-jacent — résilient. Repli sur le
  // niveau Bloomberg (PX_Last) quand Yahoo n'a pas de clôture (décréments…).
  const sj = cols.map((c) => {
    const last = lastClose(c.bars) ?? (c.bbg ? levels[c.bbg] : undefined)
    const pct =
      typeof last === 'number' && typeof c.strike === 'number' && c.strike > 0
        ? Math.round((last / c.strike) * 10000) / 100
        : null
    return { nom: c.nom, pct }
  })
  // Agrégation du panier selon p.basket (worst-of/single → min, best_of → max,
  // équipondéré/panier → MOYENNE) — identique à /api/lifecycle/courant. Un
  // Math.min forcé ici affichait, sur la fiche produit, le pire sous-jacent au
  // lieu de la moyenne pour un équipondéré : la fiche et la ligne de portefeuille
  // montraient deux valeurs différentes pour le même produit.
  const worstOf = sj.some((x) => x.pct === null)
    ? null
    : aggregateBasket(sj.map((x) => x.pct as number), p.basket)

  // Worst-of constaté aux observations passées (suivi des coupons) : nécessite
  // TOUS les sous-jacents (strike + historique). Sinon on saute le suivi.
  const niveaux: Record<string, number> = {}
  const complet = cols.every((c) => typeof c.strike === 'number' && c.bars.length > 0)
  if (complet) {
    const today = new Date().toISOString().slice(0, 10)
    for (const o of p.observations ?? []) {
      const d = o.dateObservation
      if (d > today) continue
      // Niveau du PANIER à cette observation : même agrégation que le niveau
      // courant (respecte p.basket). C'est ce chiffre qui pilote le suivi des
      // coupons ET la détection de rappel — un min forcé sur un équipondéré
      // faisait manquer des coupons et rater des rappels.
      const perfs: number[] = []
      for (const c of cols) {
        const cl = closeAt(c.bars, d)
        if (typeof cl !== 'number') {
          perfs.length = 0
          break
        }
        perfs.push((cl / (c.strike as number)) * 100)
      }
      if (perfs.length === cols.length && perfs.length > 0)
        niveaux[d] = Math.round(aggregateBasket(perfs, p.basket) * 100) / 100
    }
  }

  return NextResponse.json({
    isin,
    niveaux,
    symbols: cols.map((c) => c.sym),
    courant: { worstOf, sj },
  })
}
