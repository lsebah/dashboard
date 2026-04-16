'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ───────────────────────────────────────────────────────────
interface WeatherData {
  location: string
  temp: string
  high: string
  low: string
  description: string
}

interface MarketItem {
  name: string
  symbol: string
  price: number | null
  change: number | null
  changePct: number | null
  marketState: string
}

interface MarketsResponse {
  markets: MarketItem[]
  updatedAt: string
  fallback?: boolean
}

interface NewsItem {
  text: string
  url: string
  tag: string
  positive: boolean
}

// ─── Link categories ────────────────────────────────────────────────
const categories = [
  {
    title: 'Mes Apps',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    links: [
      {
        name: 'Internship Monitor',
        url: 'https://lsebah.github.io/internship-monitor/',
        description: 'Suivi des stages',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
          </svg>
        ),
        color: '#818cf8',
      },
      {
        name: 'CGP Monitor',
        url: 'https://lsebah.github.io/cgp-monitor/',
        description: 'Suivi CGP',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        ),
        color: '#34d399',
      },
      {
        name: 'Mutuelles Monitor',
        url: 'https://lsebah.github.io/mutuelles-monitor/',
        description: 'Suivi Mutuelles',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        ),
        color: '#f472b6',
      },
    ],
  },
  {
    title: 'Work',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
    ),
    links: [
      {
        name: 'Vizibility',
        url: 'https://cmf-extranet.com/dashboard/risk-analytics',
        description: 'Risk Analytics',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        ),
        color: '#fbbf24',
      },
      {
        name: 'LinkedIn',
        url: 'https://www.linkedin.com/feed/',
        description: "Fil d'actualite",
        icon: (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        ),
        color: '#0a66c2',
      },
      {
        name: 'Folk CRM',
        url: 'https://app.folk.app/apps/contacts/network/5718fc01-b978-496f-b674-51aba96e7c35/groups/9ab5b27f-2161-4dfb-a00e-ada0888efb29/view/fb991af0-b7a0-442e-b408-0da1759c22a4',
        description: 'Contacts & CRM',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        ),
        color: '#a78bfa',
      },
    ],
  },
  {
    title: 'Outils',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
      </svg>
    ),
    links: [
      {
        name: 'Claude AI',
        url: 'https://claude.ai',
        description: 'Assistant IA',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        ),
        color: '#d4a574',
      },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────
function formatPrice(price: number | null, symbol: string): string {
  if (price === null) return '--'
  if (symbol === 'EURUSD=X') return price.toFixed(4)
  if (symbol === 'CMS10' || symbol === 'OAT10') return price.toFixed(3) + '%'
  if (symbol === '^VIX') return price.toFixed(2)
  if (price >= 1000) return price.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
  return price.toFixed(2)
}

function formatChange(change: number | null, pct: number | null): string {
  if (change === null || pct === null) return '--'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [markets, setMarkets] = useState<MarketItem[]>([])
  const [marketsUpdated, setMarketsUpdated] = useState('')
  const [isFallback, setIsFallback] = useState(false)
  const [news, setNews] = useState<NewsItem[]>([])

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      setDate(now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Weather
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch('/api/weather')
      const data = await res.json()
      setWeather(data)
    } catch { /* silent */ }
  }, [])

  // Markets
  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/markets')
      const data: MarketsResponse = await res.json()
      setMarkets(data.markets)
      setMarketsUpdated(new Date(data.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      setIsFallback(!!data.fallback)
    } catch { /* silent */ }
  }, [])

  // News
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news')
      const data = await res.json()
      if (data.news?.length > 0) setNews(data.news)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchWeather()
    fetchMarkets()
    fetchNews()
    const weatherInterval = setInterval(fetchWeather, 30 * 60 * 1000) // 30 min
    const marketsInterval = setInterval(fetchMarkets, 5 * 60 * 1000)  // 5 min
    const newsInterval = setInterval(fetchNews, 15 * 60 * 1000)       // 15 min
    return () => {
      clearInterval(weatherInterval)
      clearInterval(marketsInterval)
      clearInterval(newsInterval)
    }
  }, [fetchWeather, fetchMarkets, fetchNews])

  return (
    <main className="min-h-screen px-8 py-6 max-w-6xl mx-auto">

      {/* ── Header: single line ──────────────────────────────────── */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <span className="text-slate-500 text-sm">|</span>
            <span className="text-lg text-slate-300 font-medium">{time}</span>
          </div>
          {weather && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
              </svg>
              <span className="text-slate-300">{weather.location}</span>
              <span className="text-white font-semibold">{weather.temp}&deg;C</span>
              <span className="text-slate-600">|</span>
              <span className="text-blue-400">{weather.low}&deg;</span>
              <span className="text-slate-600">/</span>
              <span className="text-orange-400">{weather.high}&deg;</span>
            </div>
          )}
        </div>
        <div className="text-sm text-slate-500 capitalize mt-1">{date}</div>
      </header>

      {/* ── Markets Widget ───────────────────────────────────────── */}
      {markets.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            <h2 className="category-title">Marches</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/20 to-transparent ml-3" />
            <div className="flex items-center gap-2">
              {isFallback && <span className="text-xs text-yellow-500">donnees en cache</span>}
              <span className="text-xs text-slate-600">MAJ {marketsUpdated}</span>
              <button
                onClick={fetchMarkets}
                className="text-slate-500 hover:text-indigo-400 transition-colors"
                title="Rafraichir"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
            {markets.map((m) => {
              const isUp = (m.changePct ?? 0) >= 0
              return (
                <div
                  key={m.symbol}
                  className="glass-card p-2 text-center hover:!transform-none"
                >
                  <div className="text-[10px] text-orange-400 uppercase tracking-wider mb-1 truncate">
                    {m.name}
                  </div>
                  <div className="text-white font-bold text-sm">
                    {formatPrice(m.price, m.symbol)}
                  </div>
                  <div className={`text-xs font-medium mt-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatChange(m.change, m.changePct)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── News Widget ──────────────────────────────────────────── */}
      {news.length > 0 && (
      <section className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
          </svg>
          <h2 className="category-title">News du jour</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/20 to-transparent ml-3" />
        </div>

        <div className="glass-card p-3 space-y-0">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.url}
              className="flex items-center gap-3 text-xs no-underline rounded-lg px-2 py-1 -mx-2 hover:bg-white/5 transition-colors group"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.positive ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-slate-300 group-hover:text-white transition-colors">{item.text}</span>
              <span className="ml-auto text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full flex-shrink-0">
                {item.tag}
              </span>
            </a>
          ))}
        </div>
      </section>
      )}

      {/* ── Link Categories ──────────────────────────────────────── */}
      <div className="space-y-5">
        {categories.map((category) => (
          <section key={category.title}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-indigo-400">{category.icon}</span>
              <h2 className="category-title">{category.title}</h2>
              <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/20 to-transparent ml-3" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {category.links.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  className="glass-card p-2.5 flex items-center gap-2.5 group cursor-pointer no-underline"
                >
                  <div
                    className="p-2 rounded-lg transition-all duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: `${link.color}15`,
                      color: link.color,
                    }}
                  >
                    {link.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {link.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {link.description}
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 ml-auto text-slate-600 group-hover:text-indigo-400 transition-all group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="text-center mt-6 text-xs text-slate-600">
        Laurent Sebah &middot; Capital Management France
      </footer>
    </main>
  )
}
