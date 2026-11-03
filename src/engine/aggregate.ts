// Filtering, KPIs with honest comparisons, weekly series and breakdowns.
import type { Dataset, Dimension, Row } from './types'
import { DIMENSIONS } from './types'
import { weekday } from './values'

export interface Filters {
  from: number
  to: number
  dims: Partial<Record<Dimension, string[]>>
}

export function fullRange(ds: Dataset): Filters {
  return { from: ds.minDay, to: ds.maxDay, dims: {} }
}

function matchesDims(row: Row, dims: Filters['dims']): boolean {
  for (const d of DIMENSIONS) {
    const sel = dims[d]
    if (sel && sel.length && !sel.includes(row[d] ?? '')) return false
  }
  return true
}

export function filterRows(rows: Row[], f: Filters, ignoreDates = false): Row[] {
  const dated = !ignoreDates && Number.isFinite(f.from) && Number.isFinite(f.to)
  return rows.filter((r) => (!dated || (r.day >= f.from && r.day <= f.to)) && matchesDims(r, f.dims))
}

export interface Kpis {
  gross: number
  returns: number
  net: number
  orders: number
  aov: number
  customers: number
  units?: number
  profit?: number
  margin?: number
  lines: number
}

export function kpis(rows: Row[]): Kpis {
  let gross = 0
  let returns = 0
  let units = 0
  let profit = 0
  let hasUnits = false
  let hasProfit = false
  const orders = new Set<string>()
  const customers = new Set<string>()
  for (const r of rows) {
    // Return-only invoices are not new orders, so only sales rows count towards orders.
    if (r.revenue >= 0) {
      gross += r.revenue
      orders.add(r.order)
    } else returns += r.revenue
    if (r.customer) customers.add(r.customer)
    if (r.qty !== undefined) {
      units += r.qty
      hasUnits = true
    }
    if (r.profit !== undefined) {
      profit += r.profit
      hasProfit = true
    }
  }
  const net = gross + returns
  return {
    gross,
    returns,
    net,
    orders: orders.size,
    aov: orders.size ? net / orders.size : 0,
    customers: customers.size,
    units: hasUnits ? units : undefined,
    profit: hasProfit ? profit : undefined,
    margin: hasProfit && net ? profit / net : undefined,
    lines: rows.length,
  }
}

export interface Comparison {
  label: string
  from: number
  to: number
  kpis: Kpis | null // null when the comparison window has no data at all
}

/** The same number of days immediately before, and the same days 52 weeks earlier. */
export function comparisons(ds: Dataset, f: Filters): Comparison[] {
  const len = f.to - f.from + 1
  const windows = [
    { label: 'previous period', from: f.from - len, to: f.from - 1 },
    { label: 'same period last year', from: f.from - 364, to: f.to - 364 },
  ]
  return windows.map((w) => {
    if (w.to < ds.minDay || w.from < ds.minDay) return { ...w, kpis: null }
    return { ...w, kpis: kpis(filterRows(ds.rows, { ...f, from: w.from, to: w.to })) }
  })
}

export function pctChange(now: number, before: number | undefined): number | undefined {
  if (before === undefined || before === 0 || !Number.isFinite(before)) return undefined
  return (now - before) / Math.abs(before)
}

// ---------- weekly series (weeks end on Sunday, like pandas "W") ----------

export interface Week {
  end: number // day number of the Sunday
  net: number
  orders: number
  /** False when the data does not cover all seven days of this week (first/last week). */
  complete: boolean
}

export function weekEnd(day: number): number {
  return day + (6 - weekday(day))
}

export function weeklySeries(rows: Row[], minDay: number, maxDay: number): Week[] {
  if (!rows.length || !Number.isFinite(minDay)) return []
  const first = weekEnd(minDay)
  const last = weekEnd(maxDay)
  const n = (last - first) / 7 + 1
  const net = new Float64Array(n)
  const orderSets: Set<string>[] = Array.from({ length: n }, () => new Set())
  for (const r of rows) {
    const i = (weekEnd(r.day) - first) / 7
    if (i < 0 || i >= n) continue
    net[i] += r.revenue
    orderSets[i].add(r.order)
  }
  return Array.from({ length: n }, (_, i) => {
    const end = first + i * 7
    const start = end - 6
    return { end, net: net[i], orders: orderSets[i].size, complete: start >= minDay && end <= maxDay }
  })
}

/** Weeks safe for modelling: drop incomplete weeks at either edge. */
export function modelWeeks(weeks: Week[]): Week[] {
  let a = 0
  let b = weeks.length
  while (a < b && !weeks[a].complete) a++
  while (b > a && !weeks[b - 1].complete) b--
  return weeks.slice(a, b)
}

export function dailySeries(rows: Row[], from: number, to: number): Float64Array {
  const out = new Float64Array(Math.max(0, to - from + 1))
  for (const r of rows) {
    const i = r.day - from
    if (i >= 0 && i < out.length) out[i] += r.revenue
  }
  return out
}

// ---------- breakdowns ----------

export interface Slice {
  key: string
  net: number
  share: number
  orders: number
  profit?: number
}

export function breakdown(rows: Row[], dim: Dimension | 'product' | 'customer'): Slice[] {
  const map = new Map<string, { net: number; orders: Set<string>; profit: number; hasProfit: boolean }>()
  let total = 0
  for (const r of rows) {
    const key = dim === 'product' ? r.product : dim === 'customer' ? r.customer : r[dim]
    if (!key) continue
    let s = map.get(key)
    if (!s) map.set(key, (s = { net: 0, orders: new Set(), profit: 0, hasProfit: false }))
    s.net += r.revenue
    s.orders.add(r.order)
    if (r.profit !== undefined) {
      s.profit += r.profit
      s.hasProfit = true
    }
    total += r.revenue
  }
  return [...map.entries()]
    .map(([key, s]) => ({ key, net: s.net, share: total ? s.net / total : 0, orders: s.orders.size, profit: s.hasProfit ? s.profit : undefined }))
    .sort((a, b) => b.net - a.net)
}

/** Cumulative revenue share by ranked item: what share of revenue the top x% of items bring. */
export function paretoCurve(slices: Slice[]): { x: number; y: number }[] {
  const pos = slices.filter((s) => s.net > 0)
  const total = pos.reduce((a, s) => a + s.net, 0)
  let acc = 0
  const pts = [{ x: 0, y: 0 }]
  pos.forEach((s, i) => {
    acc += s.net
    pts.push({ x: (i + 1) / pos.length, y: total ? acc / total : 0 })
  })
  return pts
}

export function shareOfTop(slices: Slice[], fraction: number): number {
  const curve = paretoCurve(slices)
  if (curve.length < 2) return 0
  const target = fraction
  for (const p of curve) if (p.x >= target) return p.y
  return 1
}

/** Weekday × month grid of average daily net sales, over days that had any sales record. */
export function rhythm(rows: Row[]): { grid: number[][]; max: number } {
  const sum = Array.from({ length: 7 }, () => new Array(12).fill(0))
  const days = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => new Set<number>()))
  for (const r of rows) {
    const d = new Date(r.day * 86_400_000)
    const w = weekday(r.day)
    const m = d.getUTCMonth()
    sum[w][m] += r.revenue
    days[w][m].add(r.day)
  }
  let max = 0
  const grid = sum.map((row, w) =>
    row.map((v, m) => {
      const avg = days[w][m].size ? v / days[w][m].size : 0
      if (avg > max) max = avg
      return avg
    }),
  )
  return { grid, max }
}

export function shippingDays(rows: Row[]): { median: number; p90: number } | null {
  const d = rows.filter((r) => r.shipDay !== undefined).map((r) => r.shipDay! - r.day).filter((x) => x >= 0).sort((a, b) => a - b)
  if (!d.length) return null
  return { median: d[Math.floor(d.length / 2)], p90: d[Math.floor(d.length * 0.9)] }
}
