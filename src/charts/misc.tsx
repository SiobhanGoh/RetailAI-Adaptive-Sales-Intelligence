import { useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line, curveMonotoneX } from 'd3-shape'
import { PinNote, usePin, useSize } from '../ui/primitives'
import { money, pct, type Currency } from '../format'

export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)']

/** Horizontal bars styled as shelf price tags. */
export function TagBars({ items, currency, max = 10, onPick, picked }: { items: { key: string; net: number; share: number }[]; currency: Currency; max?: number; onPick?: (k: string) => void; picked?: string[] }) {
  // A picked row outside the top few still shows, at its real rank.
  const shown = items.filter((s, i) => i < max || picked?.includes(s.key))
  const top = Math.max(1, ...shown.map((s) => s.net))
  return (
    <ol className={`tagbars ${picked?.length ? 'picking' : ''} ${shown.length > 8 ? 'tagbars-two' : ''}`} style={{ ['--rows' as string]: String(Math.ceil(shown.length / 2)) }}>
      {shown.map((s, i) => {
        const on = picked?.includes(s.key)
        const body = (
          <>
            <span className="tagbar-rank" aria-hidden>{items.indexOf(s) + 1}</span>
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
              <button type="button" className="tagbar" onClick={() => onPick(s.key)} aria-pressed={on} title={on ? `Stop filtering to ${s.key}` : `Filter to ${s.key}`}>
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
export function Heat({ cells, rows, cols, format, label, max, tip, corner = 'Row' }: { cells: (number | null)[][]; rows: string[]; cols: string[]; format: (v: number) => string; label: string; max?: number; tip?: (row: number, col: number, v: number | null) => { title: string; value: string }; corner?: string }) {
  const top = max ?? Math.max(1e-9, ...cells.flat().filter((v): v is number => v !== null))
  type Spot = { i: number; j: number; x: number; y: number; h: number }
  const [hover, setHover] = useState<Spot | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const [pin, setPin] = usePin<Spot>(root)
  const shown = pin ?? hover
  const place = (el: HTMLElement, i: number, j: number) => {
    const box = root.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { i, j, x: Math.min(Math.max(r.left + r.width / 2 - box.left, 110), box.width - 110), y: r.top - box.top, h: r.height }
  }
  const describe = (i: number, j: number, v: number | null) => tip?.(i, j, v) ?? { title: `${rows[i]}, ${cols[j]}`, value: v === null ? 'Not observed yet' : format(v) }
  return (
    <div
      className={`heat-wrap ${pin ? 'is-pinned' : ''}`}
      ref={root}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const cell = (e.target as HTMLElement).closest<HTMLElement>('.heat-cell:not(.na)')
        if (!cell) return setPin(null)
        const i = Number(cell.dataset.i)
        const j = Number(cell.dataset.j)
        setPin(pin && pin.i === i && pin.j === j ? null : place(cell, i, j))
      }}
    >
      <div className="heat" role="table" aria-label={label} style={{ gridTemplateColumns: `minmax(64px,auto) repeat(${cols.length}, minmax(28px,1fr))` }}>
        <div role="row" className="heat-row heat-head">
          <span role="columnheader"><span className="sr-only">{corner}</span></span>
          {cols.map((c, j) => (
            <span role="columnheader" key={c + j} className={shown?.j === j ? 'lit' : ''}>{c}</span>
          ))}
        </div>
        {cells.map((row, i) => (
          <div role="row" className="heat-row" key={rows[i]}>
            <span role="rowheader" className={shown?.i === i ? 'lit' : ''}>{rows[i]}</span>
            {row.map((v, j) => {
              const d = describe(i, j, v)
              return (
                <span
                  role="cell"
                  key={j}
                  aria-label={`${d.title}: ${d.value}`}
                  data-i={i}
                  data-j={j}
                  tabIndex={v === null ? undefined : 0}
                  onFocus={(e) => setHover(place(e.currentTarget, i, j))}
                  onBlur={() => setHover(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setPin(pin && pin.i === i && pin.j === j ? null : place(e.currentTarget, i, j))
                    }
                  }}
                  className={`${v === null ? 'heat-cell na' : 'heat-cell'} ${shown?.i === i && shown.j === j ? 'on' : ''} ${pin?.i === i && pin.j === j ? 'pinned' : ''}`}
                  style={v === null ? undefined : { ['--i' as string]: String(i * row.length + j), ['--t' as string]: String(Math.min(1, Math.max(0, v) / top)), color: Math.max(0, v) / top > 0.5 ? '#2e1800' : '#f3e8d8' }}
                  onPointerEnter={(e) => setHover(place(e.currentTarget, i, j))}
                >
                  <span className="heat-val">{v === null ? '' : format(v)}</span>
                </span>
              )
            })}
          </div>
        ))}
      </div>
      {shown && (() => {
        const d = describe(shown.i, shown.j, cells[shown.i][shown.j])
        return (
          // Rows near the top show their card underneath, so it never slips out of the panel.
          <div className={`chart-tip glass-tip ${pin ? 'pinned' : ''} ${shown.y < 110 ? 'chart-tip-below' : ''}`} style={{ left: shown.x, top: shown.y < 110 ? shown.y + shown.h : shown.y }} aria-hidden={!pin}>
            <span>{d.title}</span>
            <strong>{d.value}</strong>
            {pin && <PinNote onClose={() => setPin(null)} />}
          </div>
        )
      })()}
    </div>
  )
}

export function Pareto({ curve, label, marker = 0.2, count }: { curve: { x: number; y: number }[]; label: string; marker?: number; count?: number }) {
  const [ref, { w }, root] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [pin, setPin] = usePin<{ x: number; y: number }>(root)
  const width = Math.max(240, w)
  const height = 200
  const pad = { l: 36, r: 12, t: 10, b: 24 }
  const x = useMemo(() => scaleLinear().domain([0, 1]).range([pad.l, width - pad.r]).clamp(true), [width])
  const y = scaleLinear().domain([0, 1]).range([height - pad.b, pad.t])
  const ln = line<{ x: number; y: number }>().x((p) => x(p.x)).y((p) => y(p.y)).curve(curveMonotoneX)
  const step = Math.max(1, Math.floor(curve.length / 300))
  const thin = curve.filter((_, i) => i % step === 0 || i === curve.length - 1)
  const at = curve.find((p) => p.x >= marker) ?? curve[curve.length - 1]
  const pick = (fx: number) => {
    // The curve is sorted by x, so a binary search finds the nearest ranked product.
    let lo = 0
    let hi = curve.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (curve[mid].x < fx) lo = mid + 1
      else hi = mid
    }
    return curve[lo]
  }
  const live = pin ?? hover
  const shown = live ?? at
  const under = (e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const fx = x.invert(((e.clientX - r.left) / r.width) * width)
    const py = ((e.clientY - r.top) / r.height) * height
    const p = pick(Math.max(0.0001, fx))
    return { p, near: !!p && Math.abs(y(p.y) - py) < 36 }
  }
  return (
    <div ref={ref} className={`pareto ${pin ? 'is-pinned' : ''}`} onPointerLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const { p } = under(e)
          if (p) setHover(p)
        }}
        onClick={(e) => {
          const { p, near } = under(e)
          setPin(near && p && p !== pin ? p : null)
        }}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">{pct(t, 0)}</text>
            <text x={x(t)} y={height - 6} className="axis" textAnchor="middle">{pct(t, 0)}</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} className="pareto-even" />
        <path d={ln(thin) ?? ''} className="pareto-line" />
        {shown && (
          <g className={live ? 'pareto-live' : ''}>
            <line x1={x(shown.x)} x2={x(shown.x)} y1={y(0)} y2={y(shown.y)} className="pareto-drop" />
            <line x1={pad.l} x2={x(shown.x)} y1={y(shown.y)} y2={y(shown.y)} className="pareto-drop" />
            <circle cx={x(shown.x)} cy={y(shown.y)} r={4.5} className="pareto-dot" />
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={width - pad.l - pad.r} height={height - pad.t - pad.b} fill="transparent" />
      </svg>
      {live && (
        <div className={`chart-tip glass-tip ${pin ? 'pinned' : ''}`} style={{ left: Math.min(Math.max(x(live.x), 130), width - 130), top: (y(live.y) / height) * 100 + '%' }} aria-hidden={!pin}>
          <span>
            Top {pct(live.x, 0)} of products{count ? ` (${Math.max(1, Math.round(live.x * count)).toLocaleString('en')})` : ''}
          </span>
          <strong>{pct(live.y, 1)} of sales</strong>
          {pin && <PinNote onClose={() => setPin(null)} />}
        </div>
      )}
    </div>
  )
}

/** Orders by how many days they took to ship; the last bar holds anything slower. */
export function ShipBars({ counts, orders }: { counts: number[]; orders: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const [pin, setPin] = usePin<number>(root)
  const shown = pin ?? hover
  const top = Math.max(1, ...counts)
  const last = counts.length - 1
  const name = (d: number) => (d === 0 ? 'Same day' : d === last ? `${d}+ days` : d === 1 ? '1 day' : `${d} days`)
  return (
    <div
      ref={root}
      className={`shipbars ${pin !== null ? 'is-pinned' : ''}`}
      role="img"
      aria-label={counts.map((c, d) => `${name(d)}: ${c} orders`).join(', ')}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const col = (e.target as HTMLElement).closest<HTMLElement>('.shipbar-col')
        const d = col ? Number(col.dataset.d) : null
        setPin(d !== null && d !== pin ? d : null)
      }}
    >
      {counts.map((c, d) => (
        <div key={d} className={`shipbar ${shown === d ? 'on' : ''}`} onPointerEnter={() => setHover(d)}>
          <span className="shipbar-col" data-d={d}>
            <i style={{ height: `${Math.max(2, (c / top) * 100)}%`, ['--n' as string]: String(d) }} />
          </span>
          <span className="shipbar-day">{d === last ? `${d}+` : d}</span>
          {shown === d && (
            <span className={`chart-tip chart-tip-up glass-tip ${pin !== null ? 'pinned' : ''}`} aria-hidden={pin === null}>
              <span>{name(d)}</span>
              <strong>
                {c.toLocaleString('en')} orders, {pct(c / Math.max(1, orders), 0)}
              </strong>
              {pin !== null && <PinNote onClose={() => setPin(null)} />}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}


/** Sub-categories on a ring, joined by a line for each pair that shares orders more often than
 *  chance. Thicker lines are stronger pairs; pointing at a line or a row lights both ends. */
export function PairWeb({ pairs, active, onHover, onPick, label }: { pairs: { a: string; b: string; together: number; lift: number }[]; active: number | null; onHover: (i: number | null) => void; onPick?: (i: number | null) => void; label: string }) {
  const W = 360
  const H = 300
  const cx = W / 2
  const cy = H / 2
  const R = 104
  const nodes = useMemo(() => {
    const names: string[] = []
    for (const p of pairs) for (const n of [p.a, p.b]) if (!names.includes(n)) names.push(n)
    return names.map((name, i) => {
      const t = (i / names.length) * Math.PI * 2 - Math.PI / 2
      return { name, x: cx + R * Math.cos(t), y: cy + R * Math.sin(t), cos: Math.cos(t), sin: Math.sin(t) }
    })
  }, [pairs, cx, cy])
  const at = (n: string) => nodes.find((d) => d.name === n)!
  const maxLift = Math.max(...pairs.map((p) => p.lift))
  const lit = active !== null ? new Set([pairs[active].a, pairs[active].b]) : null
  return (
    <svg className="pairweb" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${pairs.map((p) => `${p.a} with ${p.b}, ${p.lift.toFixed(1)} times chance`).join('; ')}`} onPointerLeave={() => onHover(null)} onClick={(e) => {
        const g = (e.target as Element).closest('[data-pair]')
        onPick?.(g ? Number(g.getAttribute('data-pair')) : null)
      }}>
      {pairs.map((p, i) => {
        const a = at(p.a)
        const b = at(p.b)
        // Bend each line toward the middle so lines between neighbours don't hug the ring.
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const qx = mx + (cx - mx) * 0.55
        const qy = my + (cy - my) * 0.55
        const w = 1.5 + (Math.max(0, p.lift - 1) / Math.max(0.01, maxLift - 1)) * 6
        return (
          <g key={`${p.a}${p.b}`} data-pair={i} className={`pw-link ${active === i ? 'on' : active !== null ? 'off' : ''}`} onPointerEnter={() => onHover(i)} style={{ ['--n' as string]: String(i) }}>
            <path d={`M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`} className="pw-hit" />
            <path d={`M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`} className="pw-line" strokeWidth={w} pathLength={1} />
          </g>
        )
      })}
      {nodes.map((n) => {
        const anchor = n.cos > 0.3 ? 'start' : n.cos < -0.3 ? 'end' : 'middle'
        const lx = n.x + n.cos * 12
        const ly = n.y + n.sin * 14 + (Math.abs(n.cos) <= 0.3 ? (n.sin > 0 ? 8 : -2) : 4)
        return (
          <g key={n.name} className={`pw-node ${lit ? (lit.has(n.name) ? 'on' : 'off') : ''}`}>
            <circle cx={n.x} cy={n.y} r={6} />
            <text x={lx} y={ly} textAnchor={anchor}>{n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}</text>
          </g>
        )
      })}
    </svg>
  )
}
