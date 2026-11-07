import { describe, expect, it } from 'vitest'
import { elasticityBy, fitElasticity, isEstimate, whatIf, type Elasticity, type PriceObs } from '../src/engine/price'
import type { Row } from '../src/engine/types'

// Small seeded generator so the test is deterministic.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function poisson(mean: number, r: () => number) {
  const L = Math.exp(-mean)
  let k = 0
  let p = 1
  do {
    k++
    p *= r()
  } while (p > L)
  return k - 1
}

/**
 * Lines where expected units scale by (1 − d)^ε: a known elasticity to recover. Mirrors the
 * Kedai Amber generator: a whole-number base quantity (at least 1), then scaled and rounded
 * up or down at random so the mean is exact.
 */
function simulate(eps: number, n: number, seed = 7): PriceObs[] {
  const r = rng(seed)
  const out: PriceObs[] = []
  for (let i = 0; i < n; i++) {
    const product = `P${i % 40}`
    const shelf = 2 + (i % 40) * 0.5
    const d = r() < 0.25 ? [0.1, 0.2, 0.3][Math.floor(r() * 3)] : 0
    const base = 1 + poisson(0.3 + (i % 7) * 0.2, r)
    const target = base * Math.pow(1 - d, eps)
    const y = Math.floor(target) + (r() < target - Math.floor(target) ? 1 : 0)
    out.push({ product, x: Math.log(shelf * (1 - d)), y, day: i % 360 })
  }
  return out
}

describe('price elasticity', () => {
  it('recovers a known elasticity: unbiased across seeds, and its 95% range usually covers it', () => {
    for (const eps of [-0.4, -1.5]) {
      let covered = 0
      let bias = 0
      for (let seed = 1; seed <= 10; seed++) {
        const fit = fitElasticity(simulate(eps, 8_000, seed))!
        expect(fit.se).toBeGreaterThan(0)
        bias += (fit.elasticity - eps) / 10
        if (Math.abs(fit.elasticity - eps) < 1.96 * fit.se) covered++
      }
      expect(Math.abs(bias)).toBeLessThan(0.05)
      expect(covered).toBeGreaterThanOrEqual(8)
    }
  })

  it('refuses groups with too few lines or no price variation', () => {
    const rows: Row[] = Array.from({ length: 500 }, (_, i) => ({ day: i, revenue: 5, qty: 1, product: `P${i % 5}`, productName: 'x', order: `o${i}`, category: 'Flat' }))
    rows.push(...Array.from({ length: 20 }, (_, i) => ({ day: i, revenue: 4, qty: 1, product: 'Q', productName: 'q', order: `q${i}`, category: 'Tiny' })))
    const out = elasticityBy(rows, 'category')
    expect(out.every((e) => !isEstimate(e))).toBe(true)
    expect(out.find((e) => e.group === 'Tiny')!.lines).toBe(20)
  })

  it('turns an elasticity into unit and revenue multipliers with a range', () => {
    const e: Elasticity = { group: 'g', elasticity: -2, se: 0.25, lo: -2.49, hi: -1.51, lines: 1000, products: 10, belowUsualShare: 0.2, priceRange: { low: 0.8, high: 1 } }
    const w = whatIf(e, -0.1)
    expect(w.units.mid).toBeCloseTo(Math.pow(0.9, -2), 10) // about +23%
    expect(w.revenue.mid).toBeCloseTo(Math.pow(0.9, -1), 10) // about +11%
    expect(w.units.lo).toBeLessThanOrEqual(w.units.mid)
    expect(w.units.hi).toBeGreaterThanOrEqual(w.units.mid)
    expect(w.extrapolated).toBe(false)
    expect(whatIf(e, 0.1).extrapolated).toBe(true) // never seen above the regular price
  })
})
