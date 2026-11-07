// Reproducible evaluation for the web engine on the bundled dataset.
//   npm run evaluate            → writes verification/web_evaluation.json
//
// Protocol (fixed before looking at test results):
//  1. Parity: re-implement the original Python scaled-KNN pipeline and check it reproduces the
//     archived one-step MAE (4,200.77), so the TypeScript port is trustworthy.
//  2. Forecast panel: rolling-origin backtest. The app picks the model with the lowest WAPE on
//     the backtest, which is optimistic, so here the pick is made on the EARLIER half of the
//     origins and scored on the LATER half. 80% bands are also built from earlier residuals and
//     their coverage measured on later origins.
//  3. Product suggestions: same chronological basket-completion task as the archived Python
//     test (cutoff 2018-04-06). Strategies are compared on a validation window inside the
//     training period; only the validation winner and the baselines are reported on test.
//  4. Customer next purchase: for customers active on both sides of the cutoff, do any of the
//     top-5 suggestions appear among the new items they bought later?
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { parseCsvText } from '../src/engine/load'
import { buildDataset } from '../src/engine/clean'
import { modelWeeks, weeklySeries } from '../src/engine/aggregate'
import { dayNumber, dayToISO } from '../src/engine/values'
import { FORECASTERS, MODEL_LABEL, availableModels, backtest, bandOffsets, scorePairs, type BacktestPair, type ModelId } from '../src/engine/forecast'
import { buildIndex, similarProducts, suggestFor, suggestForCustomer, type CustomerTier, type RecIndex, type Suggestion } from '../src/engine/recommend'
import type { Row } from '../src/engine/types'
import { elasticityBy, isEstimate } from '../src/engine/price'

const SOURCE = 'data/superstore_sales.csv'
const text = readFileSync(SOURCE, 'utf8')
const table = parseCsvText(text)
const ds = buildDataset('Superstore', table.records, table.columns, { options: { dateConvention: 'dmy' } })
const out: Record<string, unknown> = {
  generated_by: 'scripts/evaluate.ts',
  source: SOURCE,
  source_sha256: createHash('sha256').update(readFileSync(SOURCE)).digest('hex'),
  rows: ds.rows.length,
  net_sales: Math.round(ds.rows.reduce((a, r) => a + r.revenue, 0) * 100) / 100,
}

// ---------------------------------------------------------------- 1. parity
function isoWeek(day: number): number {
  const d = new Date(day * 86_400_000)
  const dow = (d.getUTCDay() + 6) % 7
  const thursday = new Date(d.getTime() + (3 - dow) * 86_400_000)
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return 1 + Math.floor((thursday.getTime() - yearStart) / (7 * 86_400_000))
}
{
  const weeks = weeklySeries(ds.rows, ds.minDay, ds.maxDay) // includes the partial first week, as pandas did
  const y = weeks.map((w) => w.net)
  const rows: { f: number[]; y: number; lag1: number }[] = []
  const std = (a: number[]) => {
    const m = a.reduce((x, v) => x + v, 0) / a.length
    return Math.sqrt(a.reduce((x, v) => x + (v - m) ** 2, 0) / a.length)
  }
  for (let t = 12; t < y.length; t++) {
    const d = new Date(weeks[t].end * 86_400_000)
    const woy = isoWeek(weeks[t].end)
    const prev = y.slice(0, t)
    const win = (k: number) => prev.slice(-k)
    const mean = (a: number[]) => a.reduce((x, v) => x + v, 0) / a.length
    const p1 = y[t - 1]
    const p2 = y[t - 2]
    rows.push({
      f: [woy, d.getUTCMonth() + 1, Math.floor(d.getUTCMonth() / 3) + 1, d.getUTCFullYear(), t, Math.sin((2 * Math.PI * woy) / 52), Math.cos((2 * Math.PI * woy) / 52),
        y[t - 1], y[t - 2], y[t - 3], y[t - 4], y[t - 8], y[t - 12], mean(win(2)), mean(win(4)), mean(win(8)), std(win(2)), std(win(4)), std(win(8)), p1 - p2, p2 === 0 ? 0 : (p1 - p2) / p2],
      y: y[t],
      lag1: y[t - 1],
    })
  }
  const split = Math.floor(rows.length * 0.8)
  const train = rows.slice(0, split)
  const test = rows.slice(split)
  const d = train[0].f.length
  const mu = Array.from({ length: d }, (_, j) => train.reduce((a, r) => a + r.f[j], 0) / train.length)
  const sd = Array.from({ length: d }, (_, j) => Math.sqrt(train.reduce((a, r) => a + (r.f[j] - mu[j]) ** 2, 0) / train.length) || 1)
  const z = (f: number[]) => f.map((v, j) => (v - mu[j]) / sd[j])
  const Z = train.map((r) => z(r.f))
  const preds = test.map((r) => {
    const q = z(r.f)
    const near = Z.map((v, i) => ({ i, d: v.reduce((a, x, j) => a + (x - q[j]) ** 2, 0) })).sort((a, b) => a.d - b.d).slice(0, 5)
    return near.reduce((a, n) => a + train[n.i].y, 0) / 5
  })
  const mae = test.reduce((a, r, i) => a + Math.abs(r.y - preds[i]), 0) / test.length
  const naive = test.reduce((a, r) => a + Math.abs(r.y - r.lag1), 0) / test.length
  out.parity = {
    description: 'Original Python features and split re-implemented in TypeScript; should match verification/corrected_evaluation.json.',
    train_weeks: train.length,
    test_weeks: test.length,
    mae: +mae.toFixed(2),
    archived_python_mae: 4200.77,
    previous_week_mae: +naive.toFixed(2),
    archived_python_previous_week_mae: 6410.25,
    matches: Math.abs(mae - 4200.77) < 0.01,
  }
}

// ---------------------------------------------------------------- 2. forecast panel
// Coverage of the app's 80% band (bandOffsets): offsets built from EARLY-origin errors only,
// checked against LATE-origin actuals. The band method was fixed on an inner split of the
// early origins before any late-origin coverage was read.
function coverage(early: BacktestPair[], late: BacktestPair[], model: ModelId, H: number) {
  let inside = 0, total = 0, width = 0, scale = 0
  for (let h = 1; h <= H; h++) {
    const off = bandOffsets(early, model, h) // all steps, as in the app (backtest runs to 12 weeks)
    for (const p of late.filter((x) => x.model === model && x.h === h)) {
      const lo = Math.max(0, p.pred + off.lo)
      const hi = p.pred + off.hi
      total++
      if (p.actual >= lo && p.actual <= hi) inside++
      width += hi - lo
      scale += Math.abs(p.actual)
    }
  }
  return { coverage_pct: +((inside / total) * 100).toFixed(1), width_pct: +((width / scale) * 100).toFixed(1), pairs: total }
}

{
  const series = modelWeeks(weeklySeries(ds.rows, ds.minDay, ds.maxDay)).map((w) => ({ end: w.end, y: w.net }))
  const models = availableModels(series.length)
  const { pairs, origins } = backtest(series, models)
  const originIds = [...new Set(pairs.map((p) => p.origin))].sort((a, b) => a - b)
  const mid = originIds[Math.floor(originIds.length / 2)]
  const early = pairs.filter((p) => p.origin < mid)
  const late = pairs.filter((p) => p.origin >= mid)
  const report = (H: number) => {
    const earlyScores = models.map((m) => scorePairs(early, m, H)).sort((a, b) => a.wape - b.wape)
    const chosen = earlyScores[0].model
    const lateScores = models.map((m) => scorePairs(late, m, H)).sort((a, b) => a.wape - b.wape)
    // Coverage of 80% bands: residual quantiles from early origins applied to late origins.
    const q = (arr: number[], p: number) => {
      const s = [...arr].sort((a, b) => a - b)
      const pos = (s.length - 1) * p
      return s[Math.floor(pos)] + (s[Math.ceil(pos)] - s[Math.floor(pos)]) * (pos - Math.floor(pos))
    }
    const band = coverage(early, late, chosen, H)
    // Previous method (raw 10th/90th percentile per step), kept for comparison.
    let inside = 0
    let total = 0
    for (let h = 1; h <= H; h++) {
      const res = early.filter((p) => p.model === chosen && p.h === h).map((p) => p.actual - p.pred)
      const lo = q(res, 0.1)
      const hi = q(res, 0.9)
      for (const p of late.filter((x) => x.model === chosen && x.h === h)) {
        total++
        if (p.actual >= p.pred + lo && p.actual <= p.pred + hi) inside++
      }
    }
    const fmt = (s: ReturnType<typeof scorePairs>) => ({ model: s.model, label: MODEL_LABEL[s.model as ModelId], wape_pct: +(s.wape * 100).toFixed(2), mae: +s.mae.toFixed(2), rmse: +s.rmse.toFixed(2), n: s.n, wape_by_horizon_pct: s.byHorizon.map((b) => +(b.wape * 100).toFixed(2)) })
    return {
      horizon_weeks: H,
      chosen_on_early_origins: chosen,
      early_origin_scores: earlyScores.map(fmt),
      late_origin_scores: lateScores.map(fmt),
      chosen_model_late_wape_pct: fmt(lateScores.find((s) => s.model === chosen)!).wape_pct,
      band_80_coverage_on_late_origins_pct: band.coverage_pct,
      band_80_mean_width_pct_of_sales: band.width_pct,
      band_80_previous_method_coverage_pct: +((inside / total) * 100).toFixed(1),
      band_pairs: band.pairs,
    }
  }
  out.forecast = {
    protocol: 'Complete weeks only (partial first week dropped). Expanding-window recursive forecasts at every origin in the final 30% of weeks. Model chosen on the earlier half of origins, scored on the later half.',
    weeks: series.length,
    first_week_end: dayToISO(series[0].end),
    last_week_end: dayToISO(series[series.length - 1].end),
    origins,
    first_origin_week_end: dayToISO(series[originIds[0]].end),
    split_origin_week_end: dayToISO(series[mid].end),
    models,
    h4: report(4),
    h12: report(12),
    final_forecast_first_4_weeks: (() => {
      const scores = models.map((m) => scorePairs(pairs, m, 4)).sort((a, b) => a.wape - b.wape)
      return { model: scores[0].model, values: FORECASTERS[scores[0].model](series, 4).map((v) => +v.toFixed(2)) }
    })(),
  }
}

// ---------------------------------------------------------------- 3. product suggestions
type Strategy = { id: string; label: string; run: (idx: RecIndex, seed: string) => Suggestion[] }
const K = 5
const STRATEGIES: Strategy[] = [
  { id: 'popular', label: 'Popular overall (baseline)', run: (idx, s) => suggestFor(idx, s, K, ['popular']) },
  { id: 'similar', label: 'Similar description (TF-IDF)', run: (idx, s) => similarProducts(idx, s, K) },
  { id: 'together+popular', label: 'Bought together, then popular', run: (idx, s) => suggestFor(idx, s, K, ['together', 'popular']) },
  { id: 'subcategory+popular', label: 'Popular in sub-category, then popular', run: (idx, s) => suggestFor(idx, s, K, ['subcategory', 'popular']) },
  { id: 'together+subcategory+popular', label: 'Bought together, then sub-category, then popular', run: (idx, s) => suggestFor(idx, s, K, ['together', 'subcategory', 'popular']) },
  { id: 'category+popular', label: 'Popular in category, then popular', run: (idx, s) => suggestFor(idx, s, K, ['category', 'popular']) },
  { id: 'popular+category-mix', label: 'Two popular overall, then sub-category', run: (idx, s) => {
    const a = suggestFor(idx, s, 2, ['popular'])
    const seen = new Set([s, ...a.map((x) => x.product)])
    const sub = suggestFor(idx, s, K + 2, ['subcategory', 'popular']).filter((x) => !seen.has(x.product))
    return [...a, ...sub].slice(0, K)
  } },
]

function basketEval(train: Row[], test: Row[], strategies: Strategy[]) {
  const idx = buildIndex(train)
  const baskets = new Map<string, Set<string>>()
  for (const r of test) if (r.revenue > 0) (baskets.get(r.order) ?? baskets.set(r.order, new Set()).get(r.order)!).add(r.product)
  const multi = [...baskets.values()].filter((b) => b.size >= 2)
  const queries: { seed: string; targets: Set<string> }[] = []
  let unknownSeeds = 0
  let noTarget = 0
  for (const b of multi) {
    for (const seed of b) {
      if (!idx.products.has(seed)) { unknownSeeds++; continue }
      const targets = new Set([...b].filter((p) => p !== seed && idx.products.has(p)))
      if (!targets.size) { noTarget++; continue }
      queries.push({ seed, targets })
    }
  }
  const metrics: Record<string, unknown> = {}
  for (const s of strategies) {
    let hit = 0, recall = 0, ndcg = 0
    const shown = new Set<string>()
    for (const q of queries) {
      const recs = s.run(idx, q.seed).map((x) => x.product)
      recs.forEach((p) => shown.add(p))
      const rel = recs.map((p) => (q.targets.has(p) ? 1 : 0))
      const hits = rel.reduce<number>((a, v) => a + v, 0)
      if (hits) hit++
      recall += hits / q.targets.size
      const dcg = rel.reduce<number>((a, v, i) => a + v / Math.log2(i + 2), 0)
      const ideal = Array.from({ length: Math.min(K, q.targets.size) }, (_, i) => 1 / Math.log2(i + 2)).reduce((a, v) => a + v, 0)
      ndcg += dcg / ideal
    }
    metrics[s.id] = {
      label: s.label,
      hit_rate_at_5_pct: +((hit / queries.length) * 100).toFixed(2),
      recall_at_5_pct: +((recall / queries.length) * 100).toFixed(2),
      ndcg_at_5: +(ndcg / queries.length).toFixed(4),
      catalogue_coverage_pct: +((shown.size / idx.products.size) * 100).toFixed(2),
    }
  }
  return { train_rows: train.length, test_rows: test.length, catalogue: idx.products.size, multi_item_orders: multi.length, queries: queries.length, unknown_seeds_excluded: unknownSeeds, no_known_target_excluded: noTarget, metrics }
}

{
  const cutoff = dayNumber(2018, 4, 6)
  const valCut = dayNumber(2017, 10, 1)
  const train = ds.rows.filter((r) => r.day <= cutoff)
  const test = ds.rows.filter((r) => r.day > cutoff)
  const validation = basketEval(train.filter((r) => r.day < valCut), train.filter((r) => r.day >= valCut), STRATEGIES)
  const ranked = Object.entries(validation.metrics as Record<string, { hit_rate_at_5_pct: number; ndcg_at_5: number }>).sort((a, b) => b[1].hit_rate_at_5_pct - a[1].hit_rate_at_5_pct || b[1].ndcg_at_5 - a[1].ndcg_at_5)
  const winner = ranked[0][0]
  const reportIds = new Set([winner, 'popular', 'similar', 'together+popular'])
  const testResult = basketEval(train, test, STRATEGIES.filter((s) => reportIds.has(s.id)))
  out.products = {
    protocol: 'Each known item in a later multi-item order is a seed; the other known items in that order are the targets. Index (pairs, popularity, TF-IDF) uses training rows only. Products keyed by Product ID.',
    cutoff: dayToISO(cutoff),
    validation_window: `${dayToISO(valCut)} to ${dayToISO(cutoff)} (training period only)`,
    validation,
    chosen_on_validation: winner,
    test: testResult,
  }
}

// ---------------------------------------------------------------- 4. customer next purchase
{
  const cutoff = dayNumber(2018, 4, 6)
  const valCut = dayNumber(2017, 10, 1)
  const chains: Record<string, CustomerTier[]> = {
    popular: ['popular'],
    'their-subcategories+popular': ['their-subcategories', 'popular'],
    'together+popular': ['together', 'popular'],
    'together+their-subcategories+popular': ['together', 'their-subcategories', 'popular'],
  }
  const evalCustomers = (train: Row[], test: Row[], ids: string[]) => {
    const idx = buildIndex(train)
    const later = new Map<string, Set<string>>()
    for (const r of test) if (r.customer && r.revenue > 0) (later.get(r.customer) ?? later.set(r.customer, new Set()).get(r.customer)!).add(r.product)
    const res: Record<string, unknown> = {}
    let customers = 0
    for (const id of ids) {
      let hit = 0
      customers = 0
      for (const [c, items] of later) {
        const owned = idx.customerItems.get(c)
        if (!owned) continue
        const fresh = [...items].filter((p) => !owned.has(p) && idx.products.has(p))
        if (!fresh.length) continue
        customers++
        const recs = suggestForCustomer(idx, c, K, chains[id]).map((s) => s.product)
        if (recs.some((p) => fresh.includes(p))) hit++
      }
      res[id] = { hit_rate_at_5_pct: +((hit / customers) * 100).toFixed(2) }
    }
    return { customers, metrics: res }
  }
  const train = ds.rows.filter((r) => r.day <= cutoff)
  const validation = evalCustomers(train.filter((r) => r.day < valCut), train.filter((r) => r.day >= valCut), Object.keys(chains))
  const winner = Object.entries(validation.metrics as Record<string, { hit_rate_at_5_pct: number }>).sort((a, b) => b[1].hit_rate_at_5_pct - a[1].hit_rate_at_5_pct)[0][0]
  out.customers = {
    protocol: 'Customers with purchases before and after the cutoff; success = any top-5 suggestion is among new (previously unbought, known) products they bought after the cutoff.',
    validation,
    chosen_on_validation: winner,
    test: evalCustomers(train, ds.rows.filter((r) => r.day > cutoff), [...new Set([winner, 'popular'])]),
  }
}

// ---------------------------------------------------------------- 5. band coverage on the other samples
// Same early/late protocol as section 2, on the two other bundled samples, so the band claim
// does not rest on one store.
{
  const others = [
    { id: 'online-retail', file: 'data/online_retail_ii_sample.csv' },
    { id: 'kedai-amber', file: 'data/kedai_amber_synthetic.csv' },
  ]
  const result: Record<string, unknown> = {}
  for (const o of others) {
    const t = parseCsvText(readFileSync(o.file, 'utf8'))
    const d = buildDataset(o.id, t.records, t.columns)
    const series = modelWeeks(weeklySeries(d.rows, d.minDay, d.maxDay)).map((w) => ({ end: w.end, y: w.net }))
    const models = availableModels(series.length)
    const { pairs } = backtest(series, models)
    const ids = [...new Set(pairs.map((p) => p.origin))].sort((a, b) => a - b)
    const mid = ids[Math.floor(ids.length / 2)]
    const early = pairs.filter((p) => p.origin < mid)
    const late = pairs.filter((p) => p.origin >= mid)
    const byH: Record<string, unknown> = { weeks: series.length }
    for (const H of [4, 12]) {
      const chosen = models.map((m) => scorePairs(early, m, H)).sort((a, b) => a.wape - b.wape)[0].model
      byH[`h${H}`] = { chosen_on_early_origins: chosen, ...coverage(early, late, chosen, H) }
    }
    result[o.id] = byH
  }
  out.band_coverage_other_samples = result
}

// ---------------------------------------------------------------- 6. price elasticity recovery
// Kedai Amber is generated with a known elasticity per category (data/kedai_amber_price_truth.json),
// so the estimator can be checked against the truth. The UK shop is real wholesale data where
// bigger orders get lower unit prices, so its estimate is reported but marked as confounded.
{
  const truth = JSON.parse(readFileSync('data/kedai_amber_price_truth.json', 'utf8')).elasticity as Record<string, number>
  const t = parseCsvText(readFileSync('data/kedai_amber_synthetic.csv', 'utf8'))
  const d = buildDataset('kedai-amber', t.records, t.columns)
  const groups = elasticityBy(d.rows, 'category').filter(isEstimate).map((e) => ({
    category: e.group,
    true_elasticity: truth[e.group],
    estimate: +e.elasticity.toFixed(3),
    range_95: [+e.lo.toFixed(3), +e.hi.toFixed(3)],
    error: +(e.elasticity - truth[e.group]).toFixed(3),
    truth_inside_range: truth[e.group] >= e.lo && truth[e.group] <= e.hi,
    lines: e.lines,
    products: e.products,
  }))
  const uk = parseCsvText(readFileSync('data/online_retail_ii_sample.csv', 'utf8'))
  const ukEst = elasticityBy(buildDataset('online-retail', uk.records, uk.columns).rows, 'all')[0]
  out.price_elasticity = {
    protocol: 'Poisson pseudo-maximum likelihood of units per line on log(price paid), one effect per product (src/engine/price.ts). Kedai Amber truth comes from the generator, which was written before the estimator was run.',
    kedai_amber: {
      groups,
      inside_range: `${groups.filter((g) => g.truth_inside_range).length} of ${groups.length}`,
      mean_absolute_error: +(groups.reduce((a, g) => a + Math.abs(g.error), 0) / groups.length).toFixed(3),
    },
    uk_online_retail: isEstimate(ukEst)
      ? { estimate: +ukEst.elasticity.toFixed(3), range_95: [+ukEst.lo.toFixed(3), +ukEst.hi.toFixed(3)], note: 'Confounded: unit price falls with order size (wholesale tiers), so this is not a price response.' }
      : { unavailable: ukEst.reason },
  }
}

mkdirSync('verification', { recursive: true })
writeFileSync('verification/web_evaluation.json', JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(out, null, 2))
