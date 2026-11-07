#!/usr/bin/env node
/**
 * retailai-mcp-server: the RetailAI sales engine as MCP tools, over stdio.
 *
 * Every tool takes a `dataset`: one of the bundled sample stores ("kedai-amber",
 * "online-retail", "superstore") or an absolute path to your own CSV/TSV sales export.
 * Nothing leaves the machine: files are read locally and all maths runs in this process,
 * with the same engine as the web app (../src/engine).
 */
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'
import { loadDataset, SAMPLE_IDS } from './data.js'
import { breakdown, comparisons, filterRows, kpis, modelWeeks, pctChange, weeklySeries, type Filters } from '../../src/engine/aggregate'
import { runForecast, MAX_H, MODEL_LABEL } from '../../src/engine/forecast'
import { elasticityBy, isEstimate, whatIf } from '../../src/engine/price'
import { buildIndex, similarProducts, suggestFor, togetherWith } from '../../src/engine/recommend'
import { findAnomalies } from '../../src/engine/anomalies'
import { dayToISO } from '../../src/engine/values'
import { DIMENSIONS, type Dataset, type Dimension, type Row } from '../../src/engine/types'

const CHARACTER_LIMIT = 25_000

// ---------------------------------------------------------------- shared inputs

const datasetArg = z
  .string()
  .min(1)
  .describe(`Which sales data to use: a bundled sample (${SAMPLE_IDS.map((s) => `"${s}"`).join(', ')}) or an absolute path to a CSV/TSV export on this machine.`)

const filterArgs = {
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('First day to include, YYYY-MM-DD. Default: the first day in the data.'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Last day to include, YYYY-MM-DD. Default: the last day in the data.'),
  where: z
    .partialRecord(z.enum(DIMENSIONS), z.array(z.string()).min(1))
    .optional()
    .describe('Keep only rows whose dimension is one of these values, e.g. {"category": ["Drinks"], "state": ["Selangor"]}. Use retailai_describe_dataset to see the values.'),
}

const dayOf = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)

function applyFilters(ds: Dataset, a: { from?: string; to?: string; where?: Partial<Record<Dimension, string[]>> }): { rows: Row[]; f: Filters } {
  const f: Filters = { from: a.from ? dayOf(a.from) : ds.minDay, to: a.to ? dayOf(a.to) : ds.maxDay, dims: a.where ?? {} }
  if (f.from > f.to) throw new Error(`"from" (${a.from}) is after "to" (${a.to}). Swap them.`)
  for (const [dim, values] of Object.entries(f.dims) as [Dimension, string[]][]) {
    if (!ds.capabilities.dimensions.includes(dim)) throw new Error(`This dataset has no ${dim} column. Available: ${ds.capabilities.dimensions.join(', ') || 'none'}.`)
    const known = new Set(ds.rows.map((r) => r[dim]))
    const missing = values.filter((v) => !known.has(v))
    if (missing.length) throw new Error(`Unknown ${dim} value(s): ${missing.join(', ')}. Call retailai_describe_dataset to list valid values (they are case-sensitive).`)
  }
  const rows = filterRows(ds.rows, f)
  if (!rows.length) throw new Error('No rows match these dates and filters. Widen the date range or remove a filter.')
  return { rows, f }
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d
const pctStr = (v: number | undefined) => (v === undefined ? 'n/a' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`)

/** JSON text plus structuredContent, trimmed by dropping list items (never cutting text) if too long. */
function jsonResult(data: Record<string, unknown>, listKey?: string) {
  let out = data
  let text = JSON.stringify(out, null, 2)
  if (listKey && Array.isArray(out[listKey])) {
    let list = out[listKey] as unknown[]
    while (list.length > 1 && text.length > CHARACTER_LIMIT) {
      list = list.slice(0, Math.ceil(list.length / 2))
      out = { ...data, [listKey]: list, truncated: true, note: `Showing ${list.length} items to stay under the size limit; use "limit" or filters to narrow.` }
      text = JSON.stringify(out, null, 2)
    }
  }
  return { content: [{ type: 'text' as const, text }], structuredContent: out }
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const

// ---------------------------------------------------------------- server

function createServer(): McpServer {
  const server = new McpServer({ name: 'retailai-mcp-server', version: '1.0.0' })

  server.registerTool(
    'retailai_describe_dataset',
    {
      title: 'Describe a sales dataset',
      description: `Load a sales dataset and say what is in it: rows, date range, which columns were recognised (revenue, quantity, product, customer, category...), what the engine can do with it, data-quality notes, and the values of each dimension (categories, regions, states...) for use as filters.

Call this first with a new file. Example: dataset="kedai-amber".`,
      inputSchema: z.strictObject({ dataset: datasetArg, date_order: z.enum(['dmy', 'mdy']).optional().describe('Only for your own CSV when dates like 03/04/2024 are ambiguous: day-month-year or month-day-year.') }),
      annotations: READ_ONLY,
    },
    async ({ dataset, date_order }) => {
      const ds = await loadDataset(dataset, date_order)
      const values: Record<string, string[]> = {}
      for (const d of ds.capabilities.dimensions) {
        const set = new Set<string>()
        for (const r of ds.rows) if (r[d]) set.add(r[d]!)
        const list = [...set].sort()
        values[d] = list.length > 60 ? [...list.slice(0, 60), `…and ${list.length - 60} more`] : list
      }
      return jsonResult({
        name: ds.name,
        rows: ds.rows.length,
        first_day: dayToISO(ds.minDay),
        last_day: dayToISO(ds.maxDay),
        revenue_from: ds.revenueSource,
        columns_recognised: ds.mapping,
        can: ds.capabilities,
        quality_notes: ds.quality.map((q) => `${q.level}: ${q.text}`),
        dimension_values: values,
      })
    },
  )

  server.registerTool(
    'retailai_sales_summary',
    {
      title: 'Sales summary and breakdown',
      description: `Net sales, orders, average order, customers, units and margin for a period, compared with the period just before and the same period last year, plus the top slices by a dimension.

Examples:
  - "How did Selangor do in 2025?" -> from="2025-01-01", to="2025-12-31", where={"state":["Selangor"]}, by="category"
  - "Which products sell most?" -> by="product"`,
      inputSchema: z.strictObject({
        dataset: datasetArg,
        ...filterArgs,
        by: z.enum([...DIMENSIONS, 'product', 'customer']).optional().describe('Break sales down by this dimension. Default: category if present.'),
        limit: z.number().int().min(1).max(100).default(10).describe('How many slices to return, largest first.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ dataset, from, to, where, by, limit }) => {
      const ds = await loadDataset(dataset)
      const { rows, f } = applyFilters(ds, { from, to, where })
      const k = kpis(rows)
      const comps = comparisons(ds, f).map((c) => ({
        against: c.label,
        from: dayToISO(c.from),
        to: dayToISO(c.to),
        net_sales_change: c.kpis ? pctStr(pctChange(k.net, c.kpis.net)) : 'no data that far back',
        orders_change: c.kpis ? pctStr(pctChange(k.orders, c.kpis.orders)) : 'no data that far back',
      }))
      const dim = by ?? (ds.capabilities.dimensions.includes('category') ? 'category' : ds.capabilities.products ? 'product' : undefined)
      const slices = dim ? breakdown(rows, dim).slice(0, limit) : []
      const names = dim === 'product' ? new Map(rows.map((r) => [r.product, r.productName])) : null
      return jsonResult(
        {
          period: { from: dayToISO(f.from), to: dayToISO(f.to) },
          filters: f.dims,
          net_sales: round(k.net),
          gross_sales: round(k.gross),
          returns: round(k.returns),
          orders: k.orders,
          average_order: round(k.aov),
          customers: k.customers,
          ...(k.units !== undefined ? { units: k.units } : {}),
          ...(k.margin !== undefined ? { margin_pct: round(k.margin * 100, 1) } : {}),
          compared_with: comps,
          breakdown_by: dim ?? null,
          breakdown: slices.map((s) => ({ key: names?.get(s.key) ?? s.key, net_sales: round(s.net), share_pct: round(s.share * 100, 1), orders: s.orders })),
        },
        'breakdown',
      )
    },
  )

  server.registerTool(
    'retailai_forecast',
    {
      title: 'Weekly sales forecast with an 80% range',
      description: `Forecast weekly net sales 1 to ${MAX_H} weeks ahead for the whole store or a filtered slice. Four models are replayed on past weeks and the lowest-error one is used; each week gets an 80% range from split-conformal calibration on past errors. Returns the chosen model, every model's past error (WAPE), and the forecast.

Needs at least 30 complete weeks. Example: "next 8 weeks of Drinks" -> weeks=8, where={"category":["Drinks"]}.`,
      inputSchema: z.strictObject({ dataset: datasetArg, ...filterArgs, weeks: z.number().int().min(1).max(MAX_H).default(4).describe('How many weeks ahead.') }),
      annotations: READ_ONLY,
    },
    async ({ dataset, from, to, where, weeks }) => {
      const ds = await loadDataset(dataset)
      if (!ds.capabilities.dates) throw new Error('This dataset has no order date column, so it cannot be forecast.')
      const { rows, f } = applyFilters(ds, { from, to, where })
      const series = modelWeeks(weeklySeries(rows, f.from, f.to)).map((w) => ({ end: w.end, y: w.net }))
      const r = runForecast(series, weeks)
      if (!r.ok) throw new Error(r.reason)
      return jsonResult({
        history_weeks: r.trainWeeks,
        last_week_ending: dayToISO(series[series.length - 1].end),
        chosen_model: MODEL_LABEL[r.chosen],
        backtest_origins: r.origins,
        models_by_past_error: r.scores.map((s) => ({ model: MODEL_LABEL[s.model], wape_pct: round(s.wape * 100, 1) })),
        forecast: r.forecast.map((p) => ({ week_ending: dayToISO(p.end), net_sales: round(p.y), low_80: round(p.lo), high_80: round(p.hi) })),
        caution: 'Model choice and ranges both come from the same replay, so past error is slightly optimistic. On the Superstore sample the 80% range held about 69–71% of later weeks.',
      })
    },
  )

  server.registerTool(
    'retailai_price_sensitivity',
    {
      title: 'Price sensitivity (elasticity) by group',
      description: `How strongly units sold respond to price, per category, sub-category or for the whole shop: the % change in units for a 1% change in price, with a 95% range. Learned from the same product selling at different prices (mostly discounts). Needs a quantity column.

Use retailai_price_what_if to turn one group's sensitivity into a projected change. Example: by="category".`,
      inputSchema: z.strictObject({ dataset: datasetArg, ...filterArgs, by: z.enum(['category', 'subcategory', 'all']).default('category') }),
      annotations: READ_ONLY,
    },
    async ({ dataset, from, to, where, by }) => {
      const ds = await loadDataset(dataset)
      if (!ds.capabilities.quantity) throw new Error('This dataset has no quantity column, so price sensitivity cannot be measured. It needs units sold per line.')
      if (by !== 'all' && !ds.capabilities.dimensions.includes(by)) throw new Error(`This dataset has no ${by} column. Try by="all".`)
      const { rows } = applyFilters(ds, { from, to, where })
      const all = elasticityBy(rows, by)
      return jsonResult(
        {
          groups: all.map((e) =>
            isEstimate(e)
              ? { group: e.group, elasticity: round(e.elasticity, 3), range_95: [round(e.lo, 3), round(e.hi, 3)], lines: e.lines, products: e.products, share_below_regular_price_pct: round(e.belowUsualShare * 100, 1), prices_seen_vs_regular: [round(e.priceRange.low, 3), round(e.priceRange.high, 3)] }
              : { group: e.group, unavailable: e.reason, lines: e.lines },
          ),
          how_to_read: 'elasticity −1.5 means a 10% price cut has gone with about 15% more units. Assumes discounts were not timed to busy weeks; ignores stock-up and competitor reactions.',
          ...(dataset === 'online-retail' ? { warning: 'Wholesale data: bigger orders get lower unit prices, so this exaggerates sensitivity.' } : {}),
        },
        'groups',
      )
    },
  )

  server.registerTool(
    'retailai_price_what_if',
    {
      title: 'What if a price changes?',
      description: `Project how units and sales would move for one group if its prices changed by a given %, using its measured price sensitivity. Returns multipliers with a range, the change per week in units and money, and whether the new price is outside anything seen in the data (then it is guesswork).

Example: "What if Drinks go up 10%?" -> group="Drinks", price_change_pct=10.`,
      inputSchema: z.strictObject({
        dataset: datasetArg,
        ...filterArgs,
        group: z.string().min(1).describe('Category or sub-category name, or "All products" with by="all". See retailai_price_sensitivity.'),
        by: z.enum(['category', 'subcategory', 'all']).default('category'),
        price_change_pct: z.number().min(-50).max(50).describe('Price change in percent, e.g. -10 for a 10% cut.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ dataset, from, to, where, group, by, price_change_pct }) => {
      const ds = await loadDataset(dataset)
      if (!ds.capabilities.quantity) throw new Error('This dataset has no quantity column, so a price what-if is not possible.')
      const { rows } = applyFilters(ds, { from, to, where })
      const all = elasticityBy(rows, by)
      const e = all.find((x) => x.group === group)
      if (!e) throw new Error(`No group "${group}". Groups here: ${all.map((x) => x.group).join(', ')}.`)
      if (!isEstimate(e)) throw new Error(`${group}: ${e.reason}`)
      const w = whatIf(e, price_change_pct / 100)
      const inGroup = rows.filter((r) => (by === 'all' || r[by] === group) && r.revenue > 0 && (r.qty ?? 0) > 0)
      const days = Math.max(1, Math.max(...inGroup.map((r) => r.day)) - Math.min(...inGroup.map((r) => r.day)) + 1)
      const perWeek = { units: (inGroup.reduce((a, r) => a + (r.qty ?? 0), 0) / days) * 7, sales: (inGroup.reduce((a, r) => a + r.revenue, 0) / days) * 7 }
      const m = (x: { mid: number; lo: number; hi: number }) => ({ change_pct: round((x.mid - 1) * 100, 1), range_pct: [round((x.lo - 1) * 100, 1), round((x.hi - 1) * 100, 1)] })
      return jsonResult({
        group,
        price_change_pct,
        elasticity: round(e.elasticity, 3),
        units: m(w.units),
        sales: m(w.revenue),
        per_week_now: { units: round(perWeek.units, 1), sales: round(perWeek.sales) },
        per_week_change: { units: round(perWeek.units * (w.units.mid - 1), 1), sales: round(perWeek.sales * (w.revenue.mid - 1)) },
        outside_prices_seen: w.extrapolated,
        ...(w.extrapolated ? { warning: price_change_pct > 0 ? 'Prices in this data were never above the regular price, so a rise is guesswork.' : 'This cut is deeper than any discount in this data, so treat it as guesswork.' } : {}),
      })
    },
  )

  server.registerTool(
    'retailai_find_products',
    {
      title: 'Find products by name',
      description: 'Search product names (case-insensitive, all words must match) and return ids with sales and orders, best sellers first. Use the id with retailai_product_suggestions. Example: query="milo".',
      inputSchema: z.strictObject({ dataset: datasetArg, query: z.string().min(2).max(100).describe('Words to look for in product names.'), limit: z.number().int().min(1).max(50).default(10) }),
      annotations: READ_ONLY,
    },
    async ({ dataset, query, limit }) => {
      const ds = await loadDataset(dataset)
      if (!ds.capabilities.products) throw new Error('This dataset has no product column.')
      const idx = buildIndex(ds.rows)
      const words = query.toLowerCase().split(/\s+/).filter(Boolean)
      const hits = [...idx.products.values()].filter((p) => words.every((w) => p.name.toLowerCase().includes(w))).sort((a, b) => b.net - a.net)
      if (!hits.length) return { content: [{ type: 'text', text: `No product name contains "${query}". Try fewer or shorter words.` }] }
      return jsonResult({ total: hits.length, products: hits.slice(0, limit).map((p) => ({ id: p.id, name: p.name, category: p.category, subcategory: p.subcategory, net_sales: round(p.net), orders: p.orders })) }, 'products')
    },
  )

  server.registerTool(
    'retailai_product_suggestions',
    {
      title: 'What sells with a product',
      description: 'For one product id: items bought in the same orders (with how many orders), best sellers in its sub-category, and look-alikes by description. Find ids with retailai_find_products.',
      inputSchema: z.strictObject({ dataset: datasetArg, product_id: z.string().min(1), limit: z.number().int().min(1).max(20).default(5) }),
      annotations: READ_ONLY,
    },
    async ({ dataset, product_id, limit }) => {
      const ds = await loadDataset(dataset)
      const idx = buildIndex(ds.rows)
      const info = idx.products.get(product_id)
      if (!info) throw new Error(`No product with id "${product_id}". Use retailai_find_products to look it up by name.`)
      const fmt = (s: { product: string; name: string; evidence: number; score: number }) => ({ id: s.product, name: s.name, orders: s.evidence })
      return jsonResult({
        product: { id: info.id, name: info.name, category: info.category, subcategory: info.subcategory, orders: info.orders },
        bought_together: togetherWith(idx, [product_id], new Set([product_id])).slice(0, limit).map(fmt),
        best_sellers_same_subcategory: suggestFor(idx, product_id, limit, ['subcategory']).map(fmt),
        similar_description: similarProducts(idx, product_id, limit).map((s) => ({ id: s.product, name: s.name, word_overlap_pct: round(s.score * 100, 0) })),
      })
    },
  )

  server.registerTool(
    'retailai_unusual_weeks',
    {
      title: 'Unusual weeks and what drove them',
      description: 'Weeks whose net sales were far above or below the 13 weeks before them (never judged against the future), each with the categories or regions that moved most. Example: from="2025-01-01".',
      inputSchema: z.strictObject({ dataset: datasetArg, ...filterArgs, limit: z.number().int().min(1).max(50).default(10) }),
      annotations: READ_ONLY,
    },
    async ({ dataset, from, to, where, limit }) => {
      const ds = await loadDataset(dataset)
      // Use earlier weeks as the baseline even when "from" is set, then keep only flagged weeks in range.
      const { f } = applyFilters(ds, { from, to, where })
      const rows = filterRows(ds.rows, { ...f, from: ds.minDay })
      const weeks = weeklySeries(rows, ds.minDay, f.to)
      const found = findAnomalies(weeks, rows, ds.capabilities.dimensions).filter((a) => a.end >= f.from).sort((a, b) => b.end - a.end)
      return jsonResult(
        {
          found: found.length,
          weeks: found.slice(0, limit).map((a) => ({
            week_ending: dayToISO(a.end),
            direction: a.direction,
            net_sales: round(a.net),
            usual: round(a.baseline),
            drivers: a.drivers.slice(0, 3).map((d) => ({ [d.dim]: d.key, change: round(d.delta) })),
          })),
        },
        'weeks',
      )
    },
  )

  return server
}

serveStdio(createServer)
console.error('retailai-mcp-server running on stdio')
