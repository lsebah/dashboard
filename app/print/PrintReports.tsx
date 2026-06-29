'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Product } from '@/lib/types'
import { ReportSheet } from '@/app/lifecycle/components/ClientReport'
import { clientReportRows, clientsAvecReporting, type ReportMaps } from '@/lib/client-report'

// Récupère les MÊMES données que le portefeuille (niveaux courants Yahoo + surcouche
// prix Bloomberg/KV) puis rend la/les feuille(s) <ReportSheet/>. Pose un drapeau
// data-report-ready="1" une fois les données chargées : le script headless attend
// ce drapeau avant de générer le PDF (sinon niveaux/coupons seraient vides).
const EMPTY: ReportMaps = { perfMap: {}, niveauxMap: {}, priceMap: {} }

export default function PrintReports({
  products,
  selectedClient,
}: {
  products: Product[]
  selectedClient?: string
}) {
  const [maps, setMaps] = useState<ReportMaps>(EMPTY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const isins = products.map((p) => p.isin)
    const courant = fetch(`/api/lifecycle/courant?isins=${encodeURIComponent(isins.join(','))}`)
      .then((r) => r.json())
      .catch(() => null)
    const prices = fetch('/api/prices')
      .then((r) => r.json())
      .catch(() => null)
    Promise.all([courant, prices]).then(([c, pr]) => {
      const perfMap: Record<string, Record<string, number>> = {}
      const niveauxMap: Record<string, Record<string, number>> = {}
      for (const [isin, v] of Object.entries((c?.courant ?? {}) as Record<string, unknown>)) {
        const entry = v as { sj?: { nom: string; pct: number | null }[]; niveaux?: Record<string, number> }
        const inner: Record<string, number> = {}
        for (const x of entry.sj ?? []) if (typeof x.pct === 'number') inner[x.nom] = x.pct
        perfMap[isin] = inner
        niveauxMap[isin] = entry.niveaux ?? {}
      }
      const priceMap =
        pr?.prices && typeof pr.prices === 'object' ? (pr.prices as Record<string, number>) : {}
      setMaps({ perfMap, niveauxMap, priceMap })
      setReady(true)
    })
  }, [products])

  const clients = useMemo(
    () => (selectedClient ? [selectedClient] : clientsAvecReporting(products, maps)),
    [products, selectedClient, maps],
  )
  const date = new Date().toLocaleDateString('fr-FR')

  return (
    <div data-report-ready={ready ? '1' : '0'}>
      {clients.map((c, i) => (
        <div
          key={c}
          className="report-page"
          style={i < clients.length - 1 ? { breakAfter: 'page' } : undefined}
        >
          <ReportSheet
            client={c}
            rows={clientReportRows(products, c, maps)}
            perfMap={maps.perfMap}
            date={date}
            // id #client-report unique → uniquement en rendu mono-client.
            withId={Boolean(selectedClient)}
          />
        </div>
      ))}
    </div>
  )
}
