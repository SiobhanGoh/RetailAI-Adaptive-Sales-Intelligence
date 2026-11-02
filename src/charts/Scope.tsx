// The "oscilloscope": a glowing weekly line with optional forecast fan and event markers.
import { useId, useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { area, line, curveMonotoneX } from 'd3-shape'
import { useSize } from '../ui/primitives'
import { fmtDay, fmtMonth, money, type Currency } from '../format'

export interface ScopePoint {
  end: number
  y: number
  partial?: boolean
}

export interface ScopeMarker {
  end: number
  kind: 'spike' | 'dip'
  label: string
}

export interface ScopeBand {
  end: number
  y: number
  lo: number
  hi: number
}

export function Scope({
  points,
  forecast,
  markers = [],
  currency,
  height = 260,
  label,
  compare,
}: {
  points: ScopePoint[]
  forecast?: ScopeBand[]
  markers?: ScopeMarker[]
  currency: Currency
  height?: number
  label: string
  compare?: ScopePoint[]
}) {
  const [ref, { w }] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const id = useId().replace(/:/g, '')
  const pad = { l: 52, r: 14, t: 14, b: 26 }
  const width = Math.max(w, 280)
  const all = [...points, ...(forecast ?? []).map((f) => ({ end: f.end, y: f.hi }))]
  const x = useMemo(() => {
    const xs = all.map((p) => p.end)
    return scaleLinear()
      .domain([Math.min(...xs), Math.max(...xs)])
      .range([pad.l, width - pad.r])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, forecast, width])
  const y = useMemo(() => {
    const max = Math.max(1, ...all.map((p) => p.y), ...(compare ?? []).map((p) => p.y))
    const min = Math.min(0, ...points.map((p) => p.y))
    return scaleLinear().domain([min, max]).nice(4).range([height - pad.b, pad.t])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, forecast, compare, height])

  if (!points.length) return <div ref={ref} className="scope" style={{ height }} />
  // Re-draw the line (and replay its draw-in) whenever the data changes.
  const drawKey = `${points.length}-${points[0].end}-${Math.round(points[points.length - 1].y)}`

  const ln = line<ScopePoint>().x((p) => x(p.end)).y((p) => y(p.y)).curve(curveMonotoneX)
  const fill = area<ScopePoint>().x((p) => x(p.end)).y0(y(0)).y1((p) => y(p.y)).curve(curveMonotoneX)
  const band = area<ScopeBand>().x((p) => x(p.end)).y0((p) => y(p.lo)).y1((p) => y(p.hi)).curve(curveMonotoneX)
  const last = points[points.length - 1]
  const fcLine = forecast?.length ? [{ end: last.end, y: last.y }, ...forecast] : null
  const fcBand = forecast?.length ? [{ end: last.end, y: last.y, lo: last.y, hi: last.y }, ...forecast] : null

  const ticks = x.ticks(Math.max(2, Math.floor(width / 120)))
  const yTicks = y.ticks(4)

  const series = [...points.map((p) => ({ ...p, f: false as const })), ...(forecast ?? []).map((p) => ({ ...p, f: true as const }))]
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * width
    let best = 0
    let bd = Infinity
    series.forEach((p, i) => {
      const d = Math.abs(x(p.end) - px)
      if (d < bd) [bd, best] = [d, i]
    })
    setHover(best)
  }
  const hp = hover !== null ? series[hover] : null

  return (
    <div ref={ref} className="scope" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--amber)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {money(t, currency)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={height - 6} className="axis" textAnchor="middle">
            {fmtMonth(t)}
          </text>
        ))}
        {compare && compare.length > 1 && <path d={ln(compare) ?? ''} className="scope-compare" />}
        <path key={`f${drawKey}`} d={fill(points) ?? ''} fill={`url(#fill-${id})`} className="scope-fill" />
        <path key={`l${drawKey}`} d={ln(points) ?? ''} pathLength={1} className="scope-line" filter={`url(#glow-${id})`} />
        {fcBand && <path d={band(fcBand) ?? ''} className="scope-band" />}
        {fcLine && <path d={ln(fcLine) ?? ''} className="scope-forecast" />}
        {points.filter((p) => p.partial).map((p) => (
          <circle key={`p${p.end}`} cx={x(p.end)} cy={y(p.y)} r={3.5} className="scope-partial" />
        ))}
        {markers.map((m) => {
          const p = points.find((q) => q.end === m.end)
          if (!p) return null
          return (
            <g key={`m${m.end}`} className={`scope-marker scope-marker-${m.kind}`} transform={`translate(${x(p.end)},${y(p.y)})`}>
              <circle r={7} />
              <circle r={2.5} className="dot" />
              <title>{m.label}</title>
            </g>
          )
        })}
        {hp && (
          <g>
            <line x1={x(hp.end)} x2={x(hp.end)} y1={pad.t} y2={height - pad.b} className="crosshair" />
            <circle cx={x(hp.end)} cy={y(hp.y)} r={4} className="crosshair-dot" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="scope-tip" style={{ left: Math.min(Math.max(x(hp.end), 90), width - 90) }}>
          <strong>{money(hp.y, currency, 'whole')}</strong>
          <span>
            {hp.f ? 'Forecast, ' : ''}week ending {fmtDay(hp.end)}
            {'partial' in hp && hp.partial ? ' (partial week)' : ''}
          </span>
          {hp.f && 'lo' in hp && (
            <span>
              80% band {money(hp.lo, currency)} – {money(hp.hi, currency)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
