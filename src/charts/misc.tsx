import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { useSize } from '../ui/primitives'
import { money, pct, type Currency } from '../format'

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)']

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
          <li key={s.key} className={on ? 'on' : ''} style={{ ['--n' as string]: String(i) }}>
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

/** Share of revenue as one strip, split like a till roll. */
export function ShareStack({ items, label }: { items: { key: string; share: number }[]; label: string }) {
  const top = items.slice(0, 5)
  const rest = Math.max(0, 1 - top.reduce((a, s) => a + Math.max(0, s.share), 0))
  const parts = rest > 0.005 ? [...top, { key: 'Everything else', share: rest }] : top
  return (
    <figure className="sharestack" aria-label={label}>
      <div className="sharestack-bar" role="img" aria-label={parts.map((p) => `${p.key} ${pct(p.share, 0)}`).join(', ')}>
        {parts.map((p, i) => (
          <span key={p.key} style={{ flexGrow: Math.max(0.002, p.share), background: SERIES[i % SERIES.length] }} title={`${p.key}: ${pct(p.share)}`} />
        ))}
      </div>
      <figcaption>
        <ul className="legend">
          {parts.map((p, i) => (
            <li key={p.key}>
              <i style={{ background: SERIES[i % SERIES.length] }} aria-hidden />
              <span>{p.key}</span>
              <b>{pct(p.share)}</b>
            </li>
          ))}
        </ul>
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
            <span role="cell" key={j} className={v === null ? 'heat-cell na' : 'heat-cell'} style={v === null ? undefined : { ['--i' as string]: String(i * row.length + j), ['--t' as string]: String(Math.min(1, Math.max(0, v) / top)), color: Math.max(0, v) / top > 0.5 ? '#2e1800' : '#f3e8d8' }} title={v === null ? 'Not observed yet' : format(v)}>
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
