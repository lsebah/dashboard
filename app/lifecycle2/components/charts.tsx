// ─────────────────────────────────────────────────────────────────────────
//  Primitives graphiques « terminal » (Lifecycle 2) — SVG / CSS pur, sans
//  dépendance. Thème blanc cassé, accent orange Bloomberg. Composants purs.
// ─────────────────────────────────────────────────────────────────────────
import type { ReactNode, CSSProperties } from 'react'

// Accent unique (navy institutionnel) + rampe sobre bleu acier / gris ardoise.
export const ACCENT = '#0f2748'
export const PALETTE = [
  '#0f2748', '#27496b', '#3e6188', '#5b7da3', '#86a0bf', '#b3c4d8',
  '#1b5e4b', '#6b7280', '#94732e', '#43586f', '#7d93ab', '#a8895a',
]
export const colorAt = (i: number) => PALETTE[i % PALETTE.length]

// ── Conteneur de section ─────────────────────────────────────────────────────
export function Panel({
  title,
  sub,
  right,
  children,
  className,
  style,
}: {
  title?: string
  sub?: string
  right?: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section className={`lc2-panel lc2-rise p-4 ${className ?? ''}`} style={style}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

// ── Carte KPI ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaLabel,
  accent = ACCENT,
  spark,
  style,
}: {
  label: string
  value: string
  sub?: string
  delta?: number
  deltaLabel?: string
  accent?: string
  spark?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="lc2-kpi lc2-rise relative overflow-hidden p-4" style={style}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="lc2-label">{label}</span>
        {delta !== undefined && (
          <span className={`tabular-nums text-[11px] font-semibold ${delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)} %
            {deltaLabel && <span className="ml-1 font-normal text-slate-400">{deltaLabel}</span>}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
      {spark && <div className="mt-2">{spark}</div>}
    </div>
  )
}

// ── Donut ────────────────────────────────────────────────────────────────────
export function Donut({
  data,
  size = 168,
  thickness = 22,
  centerTop,
  centerSub,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
  centerTop?: string
  centerSub?: string
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2
  const gap = data.length > 1 ? 2 : 0
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.map((d, i) => {
          const len = (Math.max(0, d.value) / total) * c
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`}
              strokeDashoffset={-acc}
            >
              <title>{`${d.label} — ${((Math.max(0, d.value) / total) * 100).toFixed(1)} %`}</title>
            </circle>
          )
          acc += len
          return el
        })}
      </g>
      {centerTop && (
        <text x={cx} y={cy} textAnchor="middle" className="fill-slate-900" style={{ fontSize: size * 0.16, fontWeight: 700 }}>
          {centerTop}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" className="fill-slate-500" style={{ fontSize: size * 0.082 }}>
          {centerSub}
        </text>
      )}
    </svg>
  )
}

// ── Légende ──────────────────────────────────────────────────────────────────
export function Legend({
  items,
  format,
}: {
  items: { label: string; value: number; color: string; pct?: number }[]
  format: (n: number) => string
}) {
  return (
    <ul className="flex flex-col gap-1.5 text-[13px]">
      {items.map((d, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
          <span className="truncate text-slate-700">{d.label}</span>
          <span className="ml-auto shrink-0 tabular-nums text-slate-500">
            {format(d.value)}
            {d.pct != null && <span className="text-slate-400"> · {d.pct.toFixed(1)} %</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Barres horizontales ──────────────────────────────────────────────────────
export function BarList({
  items,
  format,
  accent = ACCENT,
}: {
  items: { label: string; value: number; pct?: number; color?: string; sub?: string }[]
  format: (n: number) => string
  accent?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="truncate text-slate-700">
              {it.label}
              {it.sub && <span className="text-slate-400"> · {it.sub}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {format(it.value)}
              {it.pct != null && <span className="text-slate-400"> · {it.pct.toFixed(1)} %</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? accent }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── Barres divergentes (contributeurs) ───────────────────────────────────────
export function DivergingBars({
  items,
  format,
}: {
  items: { label: string; value: number; sub?: string }[]
  format: (n: number) => string
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1)
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => {
        const w = (Math.abs(it.value) / max) * 50
        const pos = it.value >= 0
        return (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span className="w-28 shrink-0 truncate text-slate-700" title={it.sub}>
              {it.label}
            </span>
            <div className="relative h-4 flex-1">
              <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300" />
              <div
                className="absolute top-0.5 h-3 rounded-sm"
                style={{ [pos ? 'left' : 'right']: '50%', width: `${w}%`, background: pos ? '#1b7a4b' : '#b42318' } as CSSProperties}
              />
            </div>
            <span className={`w-24 shrink-0 text-right tabular-nums ${pos ? 'text-emerald-700' : 'text-red-700'}`}>
              {format(it.value)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ── Aire / courbe ────────────────────────────────────────────────────────────
export function AreaChart({
  points,
  height = 150,
  color = ACCENT,
  format,
}: {
  points: { label: string; value: number }[]
  height?: number
  color?: string
  format: (n: number) => string
}) {
  if (points.length < 2) return <div className="text-sm text-slate-400">Données insuffisantes.</div>
  const H = 100
  const n = points.length
  const max = Math.max(...points.map((p) => p.value))
  const min = Math.min(...points.map((p) => p.value), 0)
  const x = (i: number) => (i / (n - 1)) * 100
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')
  const area = `${line} L100 ${H} L0 ${H} Z`
  const last = points[n - 1]
  const ticks = [0, Math.floor(n / 2), n - 1]
  const gid = `lc2area-${color.replace('#', '')}`
  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg width="100%" height={height} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="block">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="absolute -translate-y-1/2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600"
          style={{ left: 0, top: `${(y(max) / H) * 100}%` }}
        >
          {format(max)}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        {ticks.map((t) => (
          <span key={t}>{points[t].label}</span>
        ))}
      </div>
      <div className="mt-0.5 text-right text-[11px] text-slate-500">
        dernier point : <span className="tabular-nums text-slate-700">{format(last.value)}</span>
      </div>
    </div>
  )
}

// ── Heatmap (grille de cellules colorées) ────────────────────────────────────
export function HeatGrid({
  cells,
  cols = 12,
}: {
  cells: { key: string; label: string; title: string; bg: string; fg?: string }[]
  cols?: number
}) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {cells.map((c) => (
        <div
          key={c.key}
          title={c.title}
          className="flex aspect-square items-center justify-center overflow-hidden rounded-[3px] text-[8px] font-semibold leading-none transition-transform hover:scale-110 hover:ring-1 hover:ring-slate-400"
          style={{ background: c.bg, color: c.fg ?? '#ffffff' }}
        >
          {c.label}
        </div>
      ))}
    </div>
  )
}

// ── Anneau de progression (score) ────────────────────────────────────────────
export function RadialStat({
  value,
  centerTop,
  centerSub,
  color = ACCENT,
  size = 132,
  thickness = 12,
}: {
  value: number // 0..1
  centerTop: string
  centerSub?: string
  color?: string
  size?: number
  thickness?: number
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const cx = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${cx} ${cx})`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} />
      </g>
      <text x={cx} y={cx} textAnchor="middle" className="fill-slate-900" style={{ fontSize: size * 0.2, fontWeight: 700 }}>
        {centerTop}
      </text>
      {centerSub && (
        <text x={cx} y={cx + size * 0.15} textAnchor="middle" className="fill-slate-500" style={{ fontSize: size * 0.09 }}>
          {centerSub}
        </text>
      )}
    </svg>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data, color = ACCENT, height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const d = data
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (data.length - 1)) * 100).toFixed(2)} ${(height - ((v - min) / (max - min || 1)) * height).toFixed(2)}`)
    .join(' ')
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.9} />
    </svg>
  )
}
