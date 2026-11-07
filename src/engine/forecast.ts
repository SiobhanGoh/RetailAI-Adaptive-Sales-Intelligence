// Weekly forecasting with a small model panel, a rolling-origin backtest that every model
// shares, automatic selection on that backtest, and empirical error bands.
//
// Honest-use notes (also shown in the app):
// - Selection and bands both come from the same backtest, so reported error is slightly optimistic.
// - Forecasts are recursive; error grows with the horizon.

export type ModelId = 'seasonal' | 'recent' | 'holtwinters' | 'knn'

export const MODEL_LABEL: Record<ModelId, string> = {
  seasonal: 'Same week last year',
  recent: 'Average of last 4 weeks',
  holtwinters: 'Holt–Winters (seasonal smoothing)',
  knn: 'Nearest-neighbour on recent weeks',
}

export const MODEL_SHORT: Record<ModelId, string> = {
  seasonal: 'Last year',
  recent: '4-week average',
  holtwinters: 'Holt–Winters',
  knn: 'Nearest-neighbour',
}

export interface SeriesPoint {
  end: number // day number of week end
  y: number
}

type Forecaster = (history: SeriesPoint[], h: number) => number[]

const clip = (x: number) => (x < 0 ? 0 : x)

// ---------------- baselines ----------------

export const seasonalNaive: Forecaster = (hist, h) => {
  const n = hist.length
  return Array.from({ length: h }, (_, i) => {
    const j = n - 52 + i
    return j >= 0 && j < n ? hist[j].y : hist[n - 1].y
  })
}

export const recentMean: Forecaster = (hist, h) => {
  const tail = hist.slice(-4)
  const m = tail.reduce((a, p) => a + p.y, 0) / tail.length
  return new Array(h).fill(m)
}

// ---------------- Holt–Winters (additive, damped trend, 52-week season) ----------------

const M = 52
const PHI = 0.98

function hwRun(y: number[], a: number, b: number, g: number) {
  const s = new Float64Array(y.length + M)
  let L = 0
  for (let i = 0; i < M; i++) L += y[i]
  L /= M
  let L2 = 0
  for (let i = M; i < 2 * M; i++) L2 += y[i]
  L2 /= M
  let B = (L2 - L) / M
  for (let i = 0; i < M; i++) s[i] = y[i] - L
  let sse = 0
  for (let t = M; t < y.length; t++) {
    const st = s[t - M]
    const pred = L + PHI * B + st
    const e = y[t] - pred
    sse += e * e
    const Lp = L
    L = a * (y[t] - st) + (1 - a) * (L + PHI * B)
    B = b * (L - Lp) + (1 - b) * PHI * B
    s[t] = g * (y[t] - L) + (1 - g) * st
  }
  return { L, B, s, sse }
}

const GRID_A = [0.05, 0.1, 0.2, 0.35, 0.5]
const GRID_B = [0, 0.02, 0.08]
const GRID_G = [0.05, 0.15, 0.3]

export const holtWinters: Forecaster = (hist, h) => {
  const y = hist.map((p) => p.y)
  if (y.length < 2 * M) return recentMean(hist, h)
  let best: ReturnType<typeof hwRun> | null = null
  for (const a of GRID_A) for (const b of GRID_B) for (const g of GRID_G) {
    const r = hwRun(y, a, b, g)
    if (!best || r.sse < best.sse) best = r
  }
  const { L, B, s } = best!
  const n = y.length
  const out: number[] = []
  let damp = 0
  for (let k = 1; k <= h; k++) {
    damp += PHI ** k
    out.push(clip(L + damp * B + s[n - M + ((k - 1) % M)]))
  }
  return out
}

// ---------------- KNN on lag features ----------------

function weekAngle(end: number): number {
  const d = new Date(end * 86_400_000)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return (2 * Math.PI * ((end * 86_400_000 - start) / 86_400_000)) / 365.25
}

function features(y: number[], t: number, end: number, yearly: boolean): number[] {
  // Uses only y[0..t-1]: the value being predicted is never visible.
  const lag = (k: number) => y[t - k]
  const win = (k: number) => y.slice(t - k, t)
  const mean = (a: number[]) => a.reduce((x, v) => x + v, 0) / a.length
  const sd = (a: number[]) => {
    const m = mean(a)
    return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / a.length)
  }
  const ang = weekAngle(end)
  const f = [lag(1), lag(2), lag(3), lag(4), lag(8), lag(12), mean(win(4)), mean(win(8)), sd(win(4)), sd(win(8)), Math.sin(ang), Math.cos(ang)]
  if (yearly) f.push(lag(52), mean([lag(51), lag(52), lag(53)]))
  return f
}

export const knn: Forecaster = (hist, h) => {
  const y = hist.map((p) => p.y)
  const ends = hist.map((p) => p.end)
  const yearly = y.length >= 53 + 52
  const start = yearly ? 53 : 12
  if (y.length - start < 20) return recentMean(hist, h)
  const X: number[][] = []
  const Y: number[] = []
  for (let t = start; t < y.length; t++) {
    X.push(features(y, t, ends[t], yearly))
    Y.push(y[t])
  }
  const d = X[0].length
  const mu = new Array(d).fill(0)
  const sigma = new Array(d).fill(0)
  for (const row of X) row.forEach((v, j) => (mu[j] += v / X.length))
  for (const row of X) row.forEach((v, j) => (sigma[j] += (v - mu[j]) ** 2 / X.length))
  for (let j = 0; j < d; j++) sigma[j] = Math.sqrt(sigma[j]) || 1
  const Z = X.map((row) => row.map((v, j) => (v - mu[j]) / sigma[j]))
  const k = Math.min(5, Z.length)
  const ext = [...y]
  const out: number[] = []
  for (let i = 1; i <= h; i++) {
    const end = ends[ends.length - 1] + 7 * i
    const q = features(ext, ext.length, end, yearly).map((v, j) => (v - mu[j]) / sigma[j])
    const dist = Z.map((z, idx) => ({ idx, d: z.reduce((a, v, j) => a + (v - q[j]) ** 2, 0) }))
    dist.sort((a, b) => a.d - b.d)
    const pred = dist.slice(0, k).reduce((a, x) => a + Y[x.idx], 0) / k
    out.push(clip(pred))
    ext.push(clip(pred))
  }
  return out
}

export const FORECASTERS: Record<ModelId, Forecaster> = {
  seasonal: seasonalNaive,
  recent: recentMean,
  holtwinters: holtWinters,
  knn,
}

// ---------------- backtest ----------------

export interface BacktestPair {
  model: ModelId
  origin: number // index of last training week
  h: number
  actual: number
  pred: number
}

export interface ModelScore {
  model: ModelId
  wape: number
  mae: number
  rmse: number
  n: number
  byHorizon: { h: number; wape: number; mae: number }[]
}

export interface ForecastResult {
  ok: true
  models: ModelId[]
  scores: ModelScore[] // sorted best first for the requested horizon
  chosen: ModelId
  horizon: number
  origins: number
  forecast: { end: number; y: number; lo: number; hi: number }[]
  pairs: BacktestPair[]
  trainWeeks: number
}

export interface ForecastUnavailable {
  ok: false
  reason: string
}

export const MAX_H = 12

export function availableModels(n: number): ModelId[] {
  const m: ModelId[] = ['recent']
  if (n >= 52 + 26) m.unshift('seasonal')
  if (n >= 2 * M + 26) m.push('holtwinters')
  if (n >= 40) m.push('knn')
  return m
}

export function backtest(series: SeriesPoint[], models: ModelId[], maxH = MAX_H): { pairs: BacktestPair[]; origins: number } {
  const n = series.length
  const minTrain = models.includes('holtwinters') ? 2 * M : models.includes('seasonal') ? 53 : Math.max(20, Math.floor(n * 0.5))
  const firstOrigin = Math.max(minTrain - 1, n - 1 - Math.max(12, Math.floor(n * 0.3)))
  const pairs: BacktestPair[] = []
  let origins = 0
  for (let o = firstOrigin; o < n - 1; o++) {
    origins++
    const hist = series.slice(0, o + 1)
    const h = Math.min(maxH, n - 1 - o)
    for (const model of models) {
      const preds = FORECASTERS[model](hist, h)
      for (let k = 1; k <= h; k++) pairs.push({ model, origin: o, h: k, actual: series[o + k].y, pred: preds[k - 1] })
    }
  }
  return { pairs, origins }
}

export function scorePairs(pairs: BacktestPair[], model: ModelId, maxH: number): ModelScore {
  const own = pairs.filter((p) => p.model === model && p.h <= maxH)
  const agg = (ps: BacktestPair[]) => {
    const absErr = ps.reduce((a, p) => a + Math.abs(p.actual - p.pred), 0)
    const absAct = ps.reduce((a, p) => a + Math.abs(p.actual), 0)
    return {
      wape: absAct ? absErr / absAct : NaN,
      mae: ps.length ? absErr / ps.length : NaN,
      rmse: ps.length ? Math.sqrt(ps.reduce((a, p) => a + (p.actual - p.pred) ** 2, 0) / ps.length) : NaN,
    }
  }
  const byHorizon = Array.from({ length: maxH }, (_, i) => {
    const r = agg(own.filter((p) => p.h === i + 1))
    return { h: i + 1, wape: r.wape, mae: r.mae }
  })
  return { model, ...agg(own), n: own.length, byHorizon }
}

/**
 * 80% band offsets for horizon step `h`, from past backtest errors of one model.
 *
 * Split-conformal with two choices fixed before scoring on held-out weeks:
 *  - errors from the neighbouring steps (h-1, h, h+1) are pooled, so each band rests on about
 *    three times as many past errors as a single step would give;
 *  - the finite-sample correction: with n errors, the lower edge is the floor((n+1)·0.1)-th
 *    smallest and the upper edge the ceil((n+1)·0.9)-th smallest, which widens small samples
 *    slightly instead of trusting raw 10th/90th percentiles.
 * Returns offsets to add to the point forecast.
 */
export function bandOffsets(pairs: BacktestPair[], model: ModelId, h: number): { lo: number; hi: number } {
  const res = pairs.filter((p) => p.model === model && Math.abs(p.h - h) <= 1).map((p) => p.actual - p.pred).sort((a, b) => a - b)
  const n = res.length
  if (!n) return { lo: 0, hi: 0 }
  const loRank = Math.max(1, Math.floor((n + 1) * 0.1))
  const hiRank = Math.min(n, Math.ceil((n + 1) * 0.9))
  return { lo: res[loRank - 1], hi: res[hiRank - 1] }
}

export interface BacktestCache {
  key: string
  pairs: BacktestPair[]
  origins: number
  models: ModelId[]
}

export function runForecast(series: SeriesPoint[], horizon: number, cache?: BacktestCache | null): ForecastResult | ForecastUnavailable {
  if (series.length < 30) {
    return { ok: false, reason: `Forecasting needs at least 30 complete weeks of history; this selection has ${series.length}.` }
  }
  const nonZero = series.filter((p) => p.y !== 0).length
  if (nonZero < series.length * 0.5) {
    return { ok: false, reason: 'More than half of these weeks have no sales, which is too sparse for a weekly forecast. Try a broader filter.' }
  }
  const models = availableModels(series.length)
  const bt = cache ?? { ...backtest(series, models), models }
  const scores = models.map((m) => scorePairs(bt.pairs, m, horizon)).sort((a, b) => a.wape - b.wape)
  const chosen = scores[0].model
  const preds = FORECASTERS[chosen](series, horizon)
  const forecast = preds.map((y, i) => {
    const off = bandOffsets(bt.pairs, chosen, i + 1)
    return {
      end: series[series.length - 1].end + 7 * (i + 1),
      y,
      lo: clip(y + off.lo),
      hi: y + off.hi,
    }
  })
  return { ok: true, models, scores, chosen, horizon, origins: bt.origins, forecast, pairs: bt.pairs, trainWeeks: series.length }
}
