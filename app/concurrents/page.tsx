'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Competitor {
  name: string
  website: string | null
  country: string
  type: string
  siren: string | null
  denomination?: string | null
  naf?: string | null
  trancheEffectifs?: string | null
  dirigeant?: string | null
  ca: number | null
  caYear: number | null
  volumeStructures: number | null
  volumeYear: number | null
  founded?: number | null
  teamSize?: string | null
  aum?: string | null
  bureaux?: string | null
  tagline?: string | null
  notes: string
  _lastEnrichedAt?: string | null
  _sources?: Record<string, string>
}

interface ConcurrentsData {
  updatedAt: string
  sources: string[]
  competitors: Competitor[]
}

function formatMoney(v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)} Md€`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k€`
  return `${v} €`
}

function flag(country: string): string {
  if (country.includes('FR')) return '🇫🇷'
  if (country.includes('CH')) return '🇨🇭'
  if (country.includes('UK')) return '🇬🇧'
  return '🌐'
}

export default function ConcurrentsPage() {
  const [data, setData] = useState<ConcurrentsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/concurrents')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const sorted = data?.competitors.slice().sort((a, b) => {
    if (a.ca === null && b.ca === null) return a.name.localeCompare(b.name)
    if (a.ca === null) return 1
    if (b.ca === null) return -1
    return b.ca - a.ca
  }) ?? []

  return (
    <main className="min-h-screen px-8 py-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-indigo-400 transition-colors no-underline text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-500 text-sm">|</span>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Veille concurrentielle
          </h1>
        </div>
        {data && (
          <div className="text-xs text-slate-600">
            MAJ {data.updatedAt} · {data.competitors.length} acteurs
          </div>
        )}
      </header>

      {loading && <div className="text-slate-500 text-sm">Chargement…</div>}

      {!loading && data && (
        <section>
          <div className="glass-card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-indigo-400">
                  <th className="text-left px-4 py-3 font-semibold">#</th>
                  <th className="text-left px-4 py-3 font-semibold">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-right px-4 py-3 font-semibold">CA</th>
                  <th className="text-right px-4 py-3 font-semibold">Vol. structurés / an</th>
                  <th className="text-left px-4 py-3 font-semibold">Site</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr key={c.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-slate-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{flag(c.country)}</span>
                        <div>
                          <div className="font-semibold text-white">{c.name}</div>
                          {c.notes && <div className="text-[11px] text-slate-500">{c.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{c.type}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-white">{formatMoney(c.ca)}</div>
                      {c.caYear && <div className="text-[10px] text-slate-600">{c.caYear}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-white">{formatMoney(c.volumeStructures)}</div>
                      {c.volumeYear && <div className="text-[10px] text-slate-600">{c.volumeYear}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 transition-colors text-xs no-underline"
                        >
                          {c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.sources.length > 0 && (
            <div className="mt-4 text-[11px] text-slate-600">
              Sources : {data.sources.join(' · ')}
            </div>
          )}
          <div className="mt-2 text-[11px] text-slate-600">
            Données CA / volumes à compléter — la plupart des acteurs ne publient pas leurs volumes structurés (info concurrentielle).
            Édition manuelle dans <code className="text-slate-500">data/concurrents.json</code>.
          </div>
        </section>
      )}
    </main>
  )
}
