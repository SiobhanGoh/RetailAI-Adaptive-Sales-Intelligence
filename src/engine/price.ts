// Price elasticity and a "what if I change the price?" simulator.
//
// Elasticity ε answers: if the price goes up 1%, by roughly what % do units sold change?
// ε = −1.5 means units fall about 1.5% for each 1% rise (and rise for each 1% cut).
//
// Estimation (per group of products):
//   E[units on a line] = exp(α_product + ε · log(price paid per unit))
// fitted by Poisson pseudo-maximum likelihood with one α per product. The α's soak up
// everything fixed about a product (how popular it is, its usual price), so ε is learned only
// from the same product selling at different prices, mostly discounts. Poisson PML is used
// instead of a log–log regression because units are small whole numbers, where log(units)
// would bias ε towards zero.
//
// Honest limits, also shown in the app:
// - The price changes it learns from are discounts, so price RISES are extrapolation.
// - Lines are treated as independent; the range ignores shoppers stocking up and coming back.
// - It measures units per line, not whether more people buy, nor competitors' reactions.
import type { Row } from './types'

export interface PriceObs {
  product: string
  x: number // log(price paid per unit)
  y: number // units on the line
  day?: number
}

export interface Elasticity {
  group: string
  elasticity: number
  se: number
  lo: number // 95% range
  hi: number
  lines: number
  products: number
  /** Share of lines sold more than 3% below the product's regular (highest) price that quarter. */
  belowUsualShare: number
  /** Lowest and highest price actually paid, as a fraction of the regular price that quarter. */
  priceRange: { low: number; high: number }
}

export interface ElasticityUnavailable {
  group: string
  reason: string
  lines: number
}

const MIN_LINES = 300
const MIN_VARYING_SHARE = 0.03

/** Lines with a positive quantity and positive revenue; price paid = revenue ÷ quantity. */
export function priceObservations(rows: Row[]): (PriceObs & { group: (k: 'category' | 'subcategory') => string | undefined })[] {
  const out: (PriceObs & { group: (k: 'category' | 'subcategory') => string | undefined })[] = []
  for (const r of rows) {
    if (r.qty === undefined || !(r.qty > 0) || !(r.revenue > 0)) continue
    const price = r.revenue / r.qty
    if (!Number.isFinite(price) || price <= 0) continue
    out.push({ product: r.product, x: Math.log(price), y: r.qty, day: r.day, group: (k) => r[k] })
  }
  return out
}

/** Poisson PML with product fixed effects, concentrated on ε and solved by Newton's method. */
export function fitElasticity(obs: PriceObs[]): { elasticity: number; se: number } | null {
  // Centre log price within each product (the product effects absorb the mean anyway).
  const byProduct = new Map<string, number[]>()
  obs.forEach((o, i) => (byProduct.get(o.product) ?? byProduct.set(o.product, []).get(o.product)!).push(i))
  const groups = [...byProduct.values()].filter((idx) => idx.length >= 2)
  const xs: number[][] = []
  const ys: number[][] = []
  let varying = 0
  for (const idx of groups) {
    const m = idx.reduce((a, i) => a + obs[i].x, 0) / idx.length
    const xc = idx.map((i) => obs[i].x - m)
    if (xc.some((v) => Math.abs(v) > 1e-6)) varying++
    xs.push(xc)
    ys.push(idx.map((i) => obs[i].y))
  }
  if (!varying) return null
  let beta = 0
  for (let iter = 0; iter < 60; iter++) {
    let score = 0
    let info = 0
    for (let g = 0; g < xs.length; g++) {
      const x = xs[g]
      const y = ys[g]
      let sy = 0
      let se = 0
      for (let i = 0; i < x.length; i++) {
        sy += y[i]
        se += Math.exp(beta * x[i])
      }
      const a = Math.log(sy / se)
      let sm = 0
      let smx = 0
      const mu = x.map((v) => Math.exp(a + beta * v))
      for (let i = 0; i < x.length; i++) {
        sm += mu[i]
        smx += mu[i] * x[i]
      }
      const xbar = smx / sm
      for (let i = 0; i < x.length; i++) {
        const d = x[i] - xbar
        score += (y[i] - mu[i]) * d
        info += mu[i] * d * d
      }
    }
    if (!(info > 0)) return null
    const step = score / info
    beta += Math.max(-1, Math.min(1, step))
    if (Math.abs(step) < 1e-9) break
  }
  // Heteroskedasticity-robust (sandwich) standard error at the solution.
  let info = 0
  let meat = 0
  for (let g = 0; g < xs.length; g++) {
    const x = xs[g]
    const y = ys[g]
    const sy = y.reduce((p, v) => p + v, 0)
    const se = x.reduce((p, v) => p + Math.exp(beta * v), 0)
    const a = Math.log(sy / se)
    const mu = x.map((v) => Math.exp(a + beta * v))
    const sm = mu.reduce((p, v) => p + v, 0)
    const xbar = mu.reduce((p, v, i) => p + v * x[i], 0) / sm
    for (let i = 0; i < x.length; i++) {
      const d = x[i] - xbar
      info += mu[i] * d * d
      meat += ((y[i] - mu[i]) * d) ** 2
    }
  }
  return { elasticity: beta, se: Math.sqrt(meat) / info }
}

function usualPriceStats(obs: PriceObs[]) {
  // Regular price = the highest price paid for the product within the same quarter, so
  // discounts sit below it while slow price drift over the years does not count as one.
  // Lines more than 3% below it count as reduced.
  const byKey = new Map<string, number[]>()
  for (const o of obs) {
    const key = `${o.product}\u0001${o.day === undefined || Number.isNaN(o.day) ? 0 : Math.floor(o.day / 91)}`
    ;(byKey.get(key) ?? byKey.set(key, []).get(key)!).push(Math.exp(o.x))
  }
  let below = 0
  let low = 1
  let high = 0
  for (const prices of byKey.values()) {
    let regular = 0
    for (const p of prices) if (p > regular) regular = p
    for (const p of prices) {
      const r = p / regular
      if (r < 0.97) below++
      if (r < low) low = r
      if (r > high) high = r
    }
  }
  const share = below / Math.max(1, obs.length)
  // The true lowest and highest relative prices, so "outside anything seen" is literally true.
  return { belowShare: share, low, high: high || 1, varyingShare: share }
}

/** One elasticity per value of `dim` (or one overall), with reasons where it can't be estimated. */
export function elasticityBy(rows: Row[], dim: 'category' | 'subcategory' | 'all'): (Elasticity | ElasticityUnavailable)[] {
  const all = priceObservations(rows)
  const buckets = new Map<string, PriceObs[]>()
  for (const o of all) {
    const key = dim === 'all' ? 'All products' : o.group(dim) ?? 'Uncategorised'
    ;(buckets.get(key) ?? buckets.set(key, []).get(key)!).push(o)
  }
  const out: (Elasticity | ElasticityUnavailable)[] = []
  for (const [group, obs] of buckets) {
    if (obs.length < MIN_LINES) {
      out.push({ group, reason: `Only ${obs.length} lines with a quantity; at least ${MIN_LINES} are needed.`, lines: obs.length })
      continue
    }
    const stats = usualPriceStats(obs)
    if (stats.varyingShare < MIN_VARYING_SHARE) {
      out.push({ group, reason: 'Prices barely change for the same product here, so there is nothing to learn the price effect from.', lines: obs.length })
      continue
    }
    const fit = fitElasticity(obs)
    if (!fit) {
      out.push({ group, reason: 'The price effect could not be estimated for this group.', lines: obs.length })
      continue
    }
    out.push({
      group,
      elasticity: fit.elasticity,
      se: fit.se,
      lo: fit.elasticity - 1.96 * fit.se,
      hi: fit.elasticity + 1.96 * fit.se,
      lines: obs.length,
      products: new Set(obs.map((o) => o.product)).size,
      belowUsualShare: stats.belowShare,
      priceRange: { low: stats.low, high: stats.high },
    })
  }
  return out.sort((a, b) => b.lines - a.lines)
}

export const isEstimate = (e: Elasticity | ElasticityUnavailable): e is Elasticity => 'elasticity' in e

export interface WhatIf {
  priceChange: number // e.g. 0.1 for +10%
  units: { mid: number; lo: number; hi: number } // multipliers, 1 = no change
  revenue: { mid: number; lo: number; hi: number }
  /** True when the new price is outside the range of prices the estimate was learned from. */
  extrapolated: boolean
}

/**
 * Units scale by (1 + Δ)^ε and revenue by (1 + Δ)^(1 + ε), where Δ is the price change.
 * The range uses both ends of ε's 95% range.
 */
export function whatIf(e: Elasticity, priceChange: number): WhatIf {
  const f = 1 + priceChange
  const unitsAt = (eps: number) => Math.pow(f, eps)
  const a = unitsAt(e.lo)
  const b = unitsAt(e.hi)
  const ra = Math.pow(f, 1 + e.lo)
  const rb = Math.pow(f, 1 + e.hi)
  return {
    priceChange,
    units: { mid: unitsAt(e.elasticity), lo: Math.min(a, b), hi: Math.max(a, b) },
    revenue: { mid: Math.pow(f, 1 + e.elasticity), lo: Math.min(ra, rb), hi: Math.max(ra, rb) },
    extrapolated: f < e.priceRange.low - 1e-9 || f > e.priceRange.high + 1e-9,
  }
}
