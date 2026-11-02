import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { arc, line, curveMonotoneX } from 'd3-shape'
import { useSize } from '../ui/primitives'
import { money, pct, type Currency } from '../format'

export const SERIES = ['var(--vfd)', 'var(--sticker)', 'var(--stamp)', 'var(--chrome-blue)', 'var(--lilac)', 'var(--mint)']

/** Horizontal bars styled as shelf price tags. */
export function TagBars({ items, currency, max = 10, onPick, picked }: { items: { key: string; net: number; share: number }[]; currency: Currency; max?: number; onPick?: (k: string) => void; picked?: string[] }) {
  const shown = items.slice(0, max)
  const top = Math.max(1, ...shown.map((s) => s.net))
  return (
    <ol className="tagbars">
      {shown.map((s, i) => {
        const on = picked?.includes(s.key)
        const body = (
          <>
            <span className="tagbar-rank" aria-hidden>{i + 1}</span>
            <span className="tagbar-name">{s.key}</span>
            <span className="tagbar-track" aria-hidden>
              <span className="tagbar-fill" style={{ width: `${Math.max(0.5, (s.net / top) * 100)}%` }} />
            </span>
            <span className="tagbar-price">{money(s.net, currency)}</span>
            <span className="tagbar-share">{pct(s.share)}</span>
          </>
        )
        return (
          <li key={s.key} className={on ? 'on' : ''}>
            {onPick ? (
              <button type="button" className="tagbar" onClick={() => onPick(s.key)} aria-pressed={on} title={`Filter to ${s.key}`}>
                {body}
              </button>
            ) : (
              <div className="tagbar">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Share of revenue as the grooves of a record: one ring per slice. */
export function Rings({ items, label }: { items: { key: string; share: number }[]; label: string }) {
  const size = 220
  const shown = items.slice(0, 6)
  const ringW = Math.min(14, 80 / Math.max(1, shown.length))
  return (
    <figure className="rings">
      <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} role="img" aria-label={label}>
        <circle r={size / 2 - 2} className="rings-disc" />
        <circle r={22} className="rings-label" />
        <circle r={3} className="rings-hole" />
        {shown.map((s, i) => {
          const r0 = size / 2 - 12 - i * (ringW + 5)
          const a = arc<{ innerRadius: number; outerRadius: number; startAngle: number; endAngle: number }>().cornerRadius(ringW / 2)
          const track = a({ innerRadius: r0 - ringW, outerRadius: r0, startAngle: 0, endAngle: Math.PI * 2 }) ?? ''
          const fill = a({ innerRadius: r0 - ringW, outerRadius: r0, startAngle: 0, endAngle: Math.PI * 2 * Math.max(0.003, Math.min(1, s.share)) }) ?? ''
          return (
            <g key={s.key}>
              <path d={track} className="rings-track" />
              <path d={fill} style={{ fill: SERIES[i % SERIES.length] }} className="rings-fill" />
            </g>
          )
        })}
      </svg>
      <figcaption>
        <ul className="legend">
          {shown.map((s, i) => (
            <li key={s.key}>
              <i style={{ background: SERIES[i % SERIES.length] }} aria-hidden />
              <span>{s.key}</span>
              <b>{pct(s.share)}</b>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

/** Analogue VU-style meter for a 0–1 value. */
export function Meter({ value, label, caption, zones = [0.6, 0.8] }: { value: number; label: string; caption: string; zones?: [number, number] }) {
  const angle = (v: number) => -Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, v))
  const R = 80
  const a = arc()
  const seg = (from: number, to: number) => a({ innerRadius: R - 8, outerRadius: R, startAngle: angle(from), endAngle: angle(to) }) ?? ''
  const t = angle(value)
  return (
    <figure className="meter">
      <svg viewBox="-100 -96 200 130" role="img" aria-label={`${label}: ${pct(value)}`}>
        <path d={seg(0, zones[0])} className="meter-zone z0" />
        <path d={seg(zones[0], zones[1])} className="meter-zone z1" />
        <path d={seg(zones[1], 1)} className="meter-zone z2" />
        {Array.from({ length: 11 }, (_, i) => {
          const g = angle(i / 10)
          return <line key={i} x1={Math.sin(g) * (R - 12)} y1={-Math.cos(g) * (R - 12)} x2={Math.sin(g) * (R - (i % 5 ? 16 : 22))} y2={-Math.cos(g) * (R - (i % 5 ? 16 : 22))} className="meter-tick" />
        })}
        <line x1={0} y1={0} x2={Math.sin(t) * (R - 4)} y2={-Math.cos(t) * (R - 4)} className="meter-needle" style={{ transformOrigin: '0 0' }} />
        <circle r={6} className="meter-hub" />
        <text y={26} textAnchor="middle" className="meter-value">{pct(value, 0)}</text>
      </svg>
      <figcaption>
        <strong>{label}</strong>
        <span>{caption}</span>
      </figcaption>
    </figure>
  )
}

/** Generic heat grid. `cells[row][col]` with null for "not observable yet". */
export function Heat({ cells, rows, cols, format, label, max }: { cells: (number | null)[][]; rows: string[]; cols: string[]; format: (v: number) => string; label: string; max?: number }) {
  const top = max ?? Math.max(1e-9, ...cells.flat().filter((v): v is number => v !== null))
  return (
    <div className="heat" role="table" aria-label={label} style={{ gridTemplateColumns: `minmax(64px,auto) repeat(${cols.length}, minmax(28px,1fr))` }}>
      <div role="row" className="heat-row heat-head">
        <span role="columnheader" />
        {cols.map((c) => (
          <span role="columnheader" key={c}>{c}</span>
        ))}
      </div>
      {cells.map((row, i) => (
        <div role="row" className="heat-row" key={rows[i]}>
          <span role="rowheader">{rows[i]}</span>
          {row.map((v, j) => (
            <span role="cell" key={j} className={v === null ? 'heat-cell na' : 'heat-cell'} style={v === null ? undefined : { ['--t' as string]: String(Math.min(1, Math.max(0, v) / top)), color: Math.max(0, v) / top > 0.5 ? '#04241d' : '#dbe3f1' }} title={v === null ? 'Not observed yet' : format(v)}>
              <span className="heat-val">{v === null ? '' : format(v)}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export function Pareto({ curve, label, marker = 0.2 }: { curve: { x: number; y: number }[]; label: string; marker?: number }) {
  const [ref, { w }] = useSize<HTMLDivElement>()
  const width = Math.max(240, w)
  const height = 200
  const pad = { l: 36, r: 12, t: 10, b: 24 }
  const x = useMemo(() => scaleLinear().domain([0, 1]).range([pad.l, width - pad.r]), [width])
  const y = scaleLinear().domain([0, 1]).range([height - pad.b, pad.t])
  const ln = line<{ x: number; y: number }>().x((p) => x(p.x)).y((p) => y(p.y)).curve(curveMonotoneX)
  const step = Math.max(1, Math.floor(curve.length / 300))
  const thin = curve.filter((_, i) => i % step === 0 || i === curve.length - 1)
  const at = curve.find((p) => p.x >= marker) ?? curve[curve.length - 1]
  return (
    <div ref={ref} className="pareto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">{pct(t, 0)}</text>
            <text x={x(t)} y={height - 6} className="axis" textAnchor="middle">{pct(t, 0)}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="pareto-even" />
        <path d={ln(thin) ?? ''} className="pareto-line" />
        {at && (
          <g>
            <line x1={x(at.x)} x2={x(at.x)} y1={y(0)} y2={y(at.y)} className="pareto-drop" />
            <line x1={pad.l} x2={x(at.x)} y1={y(at.y)} y2={y(at.y)} className="pareto-drop" />
            <circle cx={x(at.x)} cy={y(at.y)} r={4.5} className="pareto-dot" />
          </g>
        )}
      </svg>
    </div>
  )
}
