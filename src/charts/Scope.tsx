// The "oscilloscope": a glowing weekly line with optional forecast fan and event markers.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { area, line, curveMonotoneX } from 'd3-shape'
import { reducedMotion, useSize } from '../ui/primitives'
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

  // When the data changes, the line eases from its old shape to the new one instead of redrawing.
  // Both shapes are sampled at the same screen positions, so any two periods can be blended.
  const drawKey = points.length ? `${points.length}-${points[0].end}-${Math.round(points[points.length - 1].y)}` : ''
  const N = 140
  const sample = useMemo(() => {
    if (points.length < 2) return null
    const xs = points.map((p) => x(p.end))
    const ys = points.map((p) => y(p.y))
    const out: number[] = []
    let j = 0
    for (let i = 0; i < N; i++) {
      const px = pad.l + (i / (N - 1)) * (width - pad.l - pad.r)
      while (j < xs.length - 2 && xs[j + 1] < px) j++
      const t = xs[j + 1] === xs[j] ? 0 : Math.min(1, Math.max(0, (px - xs[j]) / (xs[j + 1] - xs[j])))
      out.push(ys[j] + (ys[j + 1] - ys[j]) * t)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey, width, height, y])
  const prev = useRef<number[] | null>(null)
  const morphed = useRef<string>('')
  const [blend, setBlend] = useState<number[] | null>(null)
  useEffect(() => {
    const from = prev.current
    prev.current = sample
    if (!from || !sample || reducedMotion()) return
    morphed.current = drawKey
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650)
      const e = 1 - Math.pow(1 - k, 3)
      setBlend(sample.map((v, i) => from[i] + (v - from[i]) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else setBlend(null)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample])

  if (!points.length) return <div ref={ref} className="scope" style={{ height }} />

  const ln = line<ScopePoint>().x((p) => x(p.end)).y((p) => y(p.y)).curve(curveMonotoneX)
  const lnXY = line<[number, number]>().curve(curveMonotoneX)
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
        {blend ? (
          <>
            <path d={(lnXY(blend.map((v, i) => [pad.l + (i / (N - 1)) * (width - pad.l - pad.r), v])) ?? '') + `L${width - pad.r},${y(0)}L${pad.l},${y(0)}Z`} fill={`url(#fill-${id})`} />
            <path d={lnXY(blend.map((v, i) => [pad.l + (i / (N - 1)) * (width - pad.l - pad.r), v])) ?? ''} className="scope-line scope-line-still" filter={`url(#glow-${id})`} />
          </>
        ) : (
          <>
            <path key={`f${drawKey}`} d={fill(points) ?? ''} fill={`url(#fill-${id})`} className={morphed.current === drawKey ? '' : 'scope-fill'} />
            <path key={`l${drawKey}`} d={ln(points) ?? ''} pathLength={1} className={`scope-line ${morphed.current === drawKey ? 'scope-line-still' : ''}`} filter={`url(#glow-${id})`} />
          </>
        )}
        {fcBand && <path d={band(fcBand) ?? ''} className="scope-band" />}
        {fcLine && <path d={ln(fcLine) ?? ''} className="scope-forecast" />}
        {!blend && !forecast?.length && (
          <g className="scope-now" transform={`translate(${x(last.end)},${y(last.y)})`} aria-hidden>
            <circle r={9} className="scope-now-ring" />
            <circle r={3.6} className="scope-now-dot" />
          </g>
        )}
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
