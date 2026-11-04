// The customer map: every customer is a dot. Further right means they bought more recently,
// higher means more orders, bigger means more sales. Dots take their segment's colour, so the
// segments read as neighbourhoods. Pointing at a dot shows who it is; clicking one picks that
// customer for the panels below and pins their card.
import { useMemo, useState } from 'react'
import { scaleLog } from 'd3-scale'
import { PinNote, usePin, useSize } from '../ui/primitives'
import { fmtDay, money, plural, type Currency } from '../format'
import type { CustomerStat, SegmentId } from '../engine/customers'

export const SEGMENT_COLOR: Record<SegmentId, string> = {
  champions: 'var(--seg-champions)',
  loyal: 'var(--seg-loyal)',
  new: 'var(--seg-new)',
  promising: 'var(--seg-promising)',
  'at-risk': 'var(--seg-at-risk)',
  hibernating: 'var(--seg-hibernating)',
}

const MAX_DOTS = 2500

/** A small stable number in [-1, 1] from an id, so dots on the same order count spread out the
 *  same way on every render. */
function jitter(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) / 4294967295) * 2 - 1
}

const AGE_TICKS: [number, string][] = [
  [0, 'Period end'],
  [30, '1 month'],
  [90, '3 months'],
  [180, '6 months'],
  [365, '1 year'],
  [730, '2 years'],
  [1095, '3 years'],
]

export function CustomerMap({
  stats,
  segLabel,
  seg,
  lit,
  person,
  onPerson,
  currency,
  height = 300,
}: {
  stats: CustomerStat[]
  segLabel: (s: SegmentId) => string
  seg: SegmentId
  lit: SegmentId | null
  person?: string
  onPerson: (c: CustomerStat) => void
  currency: Currency
  height?: number
}) {
  const [ref, { w }, root] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<CustomerStat | null>(null)
  const [pin, setPin] = usePin<CustomerStat>(root)
  const width = Math.max(w, 300)
  const pad = { l: 44, r: 18, t: 16, b: 34 }

  // Biggest customers first, so a very large store keeps the ones that matter.
  const shown = useMemo(() => (stats.length > MAX_DOTS ? [...stats].sort((a, b) => b.net - a.net).slice(0, MAX_DOTS) : stats), [stats])
  const maxAge = Math.max(30, ...shown.map((c) => c.recencyDays))
  const maxOrders = Math.max(2, ...shown.map((c) => c.orders))
  const maxNet = Math.max(1, ...shown.map((c) => c.net))
  // Square-root spacing gives the busy recent end more room than the quiet past.
  const x = (age: number) => pad.l + (1 - Math.sqrt(Math.max(0, age) / maxAge)) * (width - pad.l - pad.r)
  const y = useMemo(() => scaleLog().domain([0.8, maxOrders * 1.15]).range([height - pad.b, pad.t]), [maxOrders, height, pad.b, pad.t])
  const row = Math.abs(y(2) - y(1))
  const dot = (c: CustomerStat) => ({
    cx: x(c.recencyDays),
    cy: y(c.orders) + jitter(c.id) * Math.min(14, row * 0.32),
    r: 2.2 + 7 * Math.sqrt(Math.max(0, c.net) / maxNet),
  })
  const yTicks = [1, 2, 3, 5, 10, 20, 50, 100, 200].filter((t) => t <= maxOrders)
  const xTicks = AGE_TICKS.filter(([d]) => d <= maxAge)
  const focus = lit ?? seg
  // The picked segment is drawn last so its dots sit on top.
  const order = useMemo(() => [...shown].sort((a, b) => Number(a.segment === focus) - Number(b.segment === focus)), [shown, focus])
  const me = person ? shown.find((c) => c.id === person) : undefined
  const card = pin ?? hover

  return (
    <div ref={ref} className={`cmap ${pin ? 'is-pinned' : ''}`} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`${plural(stats.length, 'customer')} placed by how recently they bought and how often. ${segLabel(focus)} are highlighted.`}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          if (!(e.target as Element).closest('.cmap-dot')) setPin(null)
        }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 8} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">{t}</text>
          </g>
        ))}
        {xTicks.map(([d, l]) => (
          <text key={d} x={x(d)} y={height - 12} className="axis" textAnchor={d === 0 ? 'end' : 'middle'}>{l}</text>
        ))}
        <line x1={x(0)} x2={x(0)} y1={pad.t} y2={height - pad.b} className="cmap-now" />
        <text x={pad.l} y={pad.t - 4} className="axis cmap-axis-name">Orders</text>
        <g className="cmap-dots">
          {order.map((c) => {
            const d = dot(c)
            const on = c.segment === focus
            return (
              <circle
                key={c.id}
                {...d}
                className={`cmap-dot ${on ? 'on' : 'off'}`}
                style={{ ['--c' as string]: SEGMENT_COLOR[c.segment] }}
                onPointerEnter={() => setHover(c)}
                onClick={() => {
                  setPin(pin?.id === c.id ? null : c)
                  onPerson(c)
                }}
              />
            )
          })}
        </g>
        {me && (
          <g className="cmap-me" transform={`translate(${dot(me).cx},${dot(me).cy})`} aria-hidden>
            <circle r={dot(me).r + 6} className="cmap-me-ring" />
            <circle r={dot(me).r + 6} className="cmap-me-pulse" />
          </g>
        )}
      </svg>
      {card && (() => {
        const d = dot(card)
        const below = d.cy < 110
        return (
          <div
            className={`chart-tip glass-tip cmap-tip ${pin ? 'pinned' : ''} ${below ? 'chart-tip-below' : ''}`}
            style={{ left: Math.min(Math.max(d.cx, 130), width - 130), top: below ? d.cy + d.r + 4 : d.cy - d.r }}
            aria-hidden={!pin}
          >
            <span className="cmap-tip-seg">
              <i style={{ background: SEGMENT_COLOR[card.segment] }} />
              {segLabel(card.segment)}
            </span>
            <strong>{card.name ?? card.id}</strong>
            <span>
              {plural(card.orders, 'order')}, {money(card.net, currency)}, last {fmtDay(card.lastDay)}
            </span>
            {pin && <PinNote onClose={() => setPin(null)} />}
          </div>
        )
      })()}
      <span className="cmap-x-name" aria-hidden>
        Bought more recently <b>→</b>
      </span>
    </div>
  )
}

/** One customer's orders on a line from their first order to today. The gap since their last
 *  order turns red once it runs well past their usual gap. */
export function OrderRhythm({ days, asOf, usualGap }: { days: number[]; asOf: number; usualGap: number | null }) {
  const [ref, { w }] = useSize<HTMLDivElement>()
  const width = Math.max(w, 220)
  const H = 46
  const first = days[0]
  const last = days[days.length - 1]
  const span = Math.max(1, asOf - first)
  const x = (d: number) => 10 + ((d - first) / span) * (width - 20)
  const since = asOf - last
  const late = usualGap !== null && since > usualGap * 1.5
  return (
    <div ref={ref} className="rhythm">
      <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={`${plural(days.length, 'order day')}; ${since} days since the last one`}>
        <line x1={x(first)} x2={x(last)} y1={20} y2={20} className="rhythm-past" />
        <line x1={x(last)} x2={x(asOf)} y1={20} y2={20} className={`rhythm-gap ${late ? 'late' : ''}`} />
        {days.map((d, i) => (
          <circle key={d} cx={x(d)} cy={20} r={4.5} className="rhythm-dot" style={{ ['--n' as string]: String(i) }} />
        ))}
        <circle cx={x(asOf)} cy={20} r={4} className={`rhythm-now ${late ? 'late' : ''}`} />
        <text x={x(first)} y={42} className="axis" textAnchor="start">{fmtDay(first)}</text>
        <text x={x(asOf)} y={42} className="axis" textAnchor="end">{fmtDay(asOf - 1)}</text>
      </svg>
      <p className={`rhythm-note ${late ? 'late' : ''}`}>
        {usualGap === null
          ? `${since} days since their last order.`
          : late
            ? `Usually orders every ${Math.round(usualGap)} days. It has been ${since}: worth a message now.`
            : `Usually orders every ${Math.round(usualGap)} days. It has been ${since}, so they are on track.`}
      </p>
    </div>
  )
}
