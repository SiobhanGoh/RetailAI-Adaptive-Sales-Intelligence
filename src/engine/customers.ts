// Recency / frequency / monetary segments and quarterly retention cohorts.
import type { Row } from './types'

export interface CustomerStat {
  id: string
  name?: string
  firstDay: number
  lastDay: number
  orders: number
  net: number
  recencyDays: number
  r: number
  f: number
  m: number
  segment: SegmentId
}

export type SegmentId = 'champions' | 'loyal' | 'new' | 'promising' | 'at-risk' | 'hibernating'

export const SEGMENTS: { id: SegmentId; label: string; rule: string; action: string }[] = [
  { id: 'champions', label: 'Champions', rule: 'Bought recently and often', action: 'Thank them and ask for reviews or referrals.' },
  { id: 'loyal', label: 'Loyal', rule: 'Buy regularly, fairly recent', action: 'Offer bundles from the sub-categories they already buy.' },
  { id: 'new', label: 'New or returning', rule: 'Very recent, few orders so far', action: 'Follow up within a few weeks to earn a second order.' },
  { id: 'promising', label: 'Needs a nudge', rule: 'Middling recency and frequency', action: 'A timely reminder or limited offer.' },
  { id: 'at-risk', label: 'At risk', rule: 'Used to buy often, not lately', action: 'Win-back message before they lapse for good.' },
  { id: 'hibernating', label: 'Lapsed', rule: 'Few orders, long ago', action: 'Low-cost reactivation only; do not over-spend here.' },
]

/** Score 1–5 by rank, so ties and skew do not empty a bucket. Higher is better. */
function rankScores(values: number[], higherIsBetter: boolean): number[] {
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => (higherIsBetter ? a.v - b.v : b.v - a.v))
  const out = new Array(values.length)
  // Equal values share the score of their first position.
  let start = 0
  while (start < idx.length) {
    let end = start
    while (end + 1 < idx.length && idx[end + 1].v === idx[start].v) end++
    const score = Math.min(5, Math.floor((start / idx.length) * 5) + 1)
    for (let j = start; j <= end; j++) out[idx[j].i] = score
    start = end + 1
  }
  return out
}

function segmentOf(r: number, f: number): SegmentId {
  if (r >= 4 && f >= 4) return 'champions'
  if (r >= 3 && f >= 3) return 'loyal'
  if (r >= 4 && f <= 2) return 'new'
  if (r <= 2 && f >= 3) return 'at-risk'
  if (r <= 2 && f <= 2) return 'hibernating'
  return 'promising'
}

export function customerStats(rows: Row[], asOfDay: number): CustomerStat[] {
  const map = new Map<string, { name?: string; first: number; last: number; orders: Set<string>; net: number }>()
  for (const r of rows) {
    if (!r.customer) continue
    let c = map.get(r.customer)
    if (!c) map.set(r.customer, (c = { name: r.customerName, first: r.day, last: r.day, orders: new Set(), net: 0 }))
    if (r.day < c.first) c.first = r.day
    if (r.day > c.last) c.last = r.day
    c.orders.add(r.order)
    c.net += r.revenue
  }
  const list = [...map.entries()].map(([id, c]) => ({ id, name: c.name, firstDay: c.first, lastDay: c.last, orders: c.orders.size, net: c.net, recencyDays: asOfDay - c.last }))
  const R = rankScores(list.map((c) => c.recencyDays), false)
  const F = rankScores(list.map((c) => c.orders), true)
  const Mo = rankScores(list.map((c) => c.net), true)
  return list.map((c, i) => ({ ...c, r: R[i], f: F[i], m: Mo[i], segment: segmentOf(R[i], F[i]) }))
}

export function segmentSummary(stats: CustomerStat[]) {
  const total = stats.reduce((a, c) => a + c.net, 0)
  return SEGMENTS.map((s) => {
    const members = stats.filter((c) => c.segment === s.id)
    const net = members.reduce((a, c) => a + c.net, 0)
    return { ...s, customers: members.length, net, share: total ? net / total : 0, members: members.sort((a, b) => b.net - a.net) }
  })
}

/** grid[r-1][f-1] = number of customers with that recency and frequency score. */
export function rfGrid(stats: CustomerStat[]): number[][] {
  const g = Array.from({ length: 5 }, () => new Array(5).fill(0))
  for (const c of stats) g[c.r - 1][c.f - 1]++
  return g
}

function quarterIndex(day: number): number {
  const d = new Date(day * 86_400_000)
  return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3)
}

export function quarterLabel(q: number): string {
  return `Q${(q % 4) + 1} ${Math.floor(q / 4)}`
}

export interface Cohort {
  quarter: number
  size: number
  /** retention[k] = share of the cohort who ordered in quarter k after their first (k=0 is 100%). */
  retention: (number | null)[]
}

export function cohorts(rows: Row[], maxDay: number): Cohort[] {
  const first = new Map<string, number>()
  const active = new Map<string, Set<number>>()
  for (const r of rows) {
    if (!r.customer || r.revenue <= 0) continue
    const q = quarterIndex(r.day)
    if (!first.has(r.customer) || q < first.get(r.customer)!) first.set(r.customer, q)
    ;(active.get(r.customer) ?? active.set(r.customer, new Set()).get(r.customer)!).add(q)
  }
  const lastQ = quarterIndex(maxDay)
  const groups = new Map<number, string[]>()
  for (const [c, q] of first) (groups.get(q) ?? groups.set(q, []).get(q)!).push(c)
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([q, members]) => ({
      quarter: q,
      size: members.length,
      retention: Array.from({ length: lastQ - q + 1 }, (_, k) =>
        members.filter((m) => active.get(m)!.has(q + k)).length / members.length,
      ),
    }))
}

export function repeatStats(stats: CustomerStat[]) {
  const repeat = stats.filter((c) => c.orders > 1)
  const gaps = repeat.map((c) => (c.lastDay - c.firstDay) / (c.orders - 1)).sort((a, b) => a - b)
  return {
    repeatShare: stats.length ? repeat.length / stats.length : 0,
    medianGapDays: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
  }
}
