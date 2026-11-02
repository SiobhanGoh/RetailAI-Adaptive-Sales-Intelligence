// Unusual weeks, judged against the 13 weeks before them (never against the future),
// with the categories or regions that moved the most.
import type { Dimension, Row } from './types'
import type { Week } from './aggregate'
import { weekEnd } from './aggregate'

export interface Anomaly {
  end: number
  net: number
  baseline: number
  z: number
  direction: 'spike' | 'dip'
  drivers: { dim: Dimension; key: string; delta: number; share: number }[]
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const ANOMALY_WINDOW = 13
export const ANOMALY_THRESHOLD = 4

export function findAnomalies(weeks: Week[], rows: Row[], dims: Dimension[], threshold = ANOMALY_THRESHOLD, win = ANOMALY_WINDOW): Anomaly[] {
  const out: Anomaly[] = []
  const usable = weeks.filter((w) => w.complete)
  for (let i = win; i < usable.length; i++) {
    const prior = usable.slice(i - win, i).map((w) => w.net)
    const med = median(prior)
    const mad = median(prior.map((v) => Math.abs(v - med))) * 1.4826
    if (!mad) continue
    const z = (usable[i].net - med) / mad
    if (Math.abs(z) < threshold) continue
    out.push({ end: usable[i].end, net: usable[i].net, baseline: med, z, direction: z > 0 ? 'spike' : 'dip', drivers: [] })
  }
  if (!out.length) return out

  const wanted = new Set(out.map((a) => a.end))
  const priorWeeks = new Map<number, number[]>()
  for (const a of out) {
    const idx = usable.findIndex((w) => w.end === a.end)
    priorWeeks.set(a.end, usable.slice(idx - win, idx).map((w) => w.end))
  }
  const need = new Set<number>([...wanted, ...[...priorWeeks.values()].flat()])
  // week end → dim → key → net
  const cube = new Map<number, Map<string, number>>()
  for (const r of rows) {
    const we = weekEnd(r.day)
    if (!need.has(we)) continue
    let m = cube.get(we)
    if (!m) cube.set(we, (m = new Map()))
    for (const d of dims) {
      const k = r[d]
      if (!k) continue
      const key = `${d}\u0001${k}`
      m.set(key, (m.get(key) ?? 0) + r.revenue)
    }
  }
  for (const a of out) {
    const now = cube.get(a.end) ?? new Map()
    const priors = priorWeeks.get(a.end)!.map((e) => cube.get(e) ?? new Map<string, number>())
    const keys = new Set<string>([...now.keys(), ...priors.flatMap((p) => [...p.keys()])])
    const total = a.net - a.baseline
    const drivers = [...keys].map((key) => {
      const base = median(priors.map((p) => p.get(key) ?? 0))
      const delta = (now.get(key) ?? 0) - base
      const [dim, k] = key.split('\u0001') as [Dimension, string]
      return { dim, key: k, delta, share: total ? delta / total : 0 }
    })
    a.drivers = drivers
      .filter((d) => Math.sign(d.delta) === Math.sign(total))
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
      .slice(0, 3)
  }
  return out
}
