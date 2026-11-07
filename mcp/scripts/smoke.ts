/**
 * Self-check: starts the built server over stdio, calls every tool as a client would, and
 * exits non-zero on any failure. Run with: npm run build && npm run smoke
 */
import { strict as assert } from 'node:assert'
import { Client } from '@modelcontextprotocol/client'
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const client = new Client({ name: 'retailai-smoke', version: '1.0.0' })
await client.connect(new StdioClientTransport({ command: 'node', args: ['dist/index.js'], env: getDefaultEnvironment() }))

type R = { isError?: boolean; content: unknown; structuredContent?: Record<string, unknown> }
const call = async (name: string, args: Record<string, unknown>) => {
  const t0 = Date.now()
  const r = (await client.callTool({ name, arguments: args })) as R
  console.error(`${name}: ${r.isError ? 'error' : 'ok'} in ${Date.now() - t0} ms`)
  return r
}
const ok = (r: R) => {
  assert.ok(!r.isError, JSON.stringify(r.content))
  return r.structuredContent!
}

const { tools } = await client.listTools()
assert.deepEqual(tools.map((t) => t.name).sort(), [
  'retailai_describe_dataset',
  'retailai_find_products',
  'retailai_forecast',
  'retailai_price_sensitivity',
  'retailai_price_what_if',
  'retailai_product_suggestions',
  'retailai_sales_summary',
  'retailai_unusual_weeks',
])
for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} should be read-only`)

const d = ok(await call('retailai_describe_dataset', { dataset: 'kedai-amber' }))
assert.equal(d.rows, 83113)
assert.ok((d.dimension_values as Record<string, string[]>).category.includes('Drinks'))

const s = ok(await call('retailai_sales_summary', { dataset: 'kedai-amber', from: '2025-01-01', to: '2025-12-31', where: { state: ['Selangor'] }, by: 'category', limit: 3 }))
assert.equal((s.breakdown as unknown[]).length, 3)
assert.ok((s.net_sales as number) > 0)

const f = ok(await call('retailai_forecast', { dataset: 'kedai-amber', weeks: 8, where: { category: ['Drinks'] } }))
const weeks = f.forecast as { net_sales: number; low_80: number; high_80: number }[]
assert.equal(weeks.length, 8)
for (const w of weeks) assert.ok(w.low_80 <= w.net_sales && w.net_sales <= w.high_80)

const p = ok(await call('retailai_price_sensitivity', { dataset: 'kedai-amber' }))
const drinks = (p.groups as { group: string; elasticity?: number; range_95?: number[] }[]).find((g) => g.group === 'Drinks')!
assert.ok(drinks.range_95![0] < -1 && drinks.range_95![1] < -1, 'Drinks should be clearly price-sensitive')

const w = ok(await call('retailai_price_what_if', { dataset: 'kedai-amber', group: 'Drinks', price_change_pct: -10 }))
assert.ok(((w.units as { change_pct: number }).change_pct) > 0, 'a cut should raise units')
assert.equal(w.outside_prices_seen, false)
const up = ok(await call('retailai_price_what_if', { dataset: 'kedai-amber', group: 'Drinks', price_change_pct: 10 }))
assert.equal(up.outside_prices_seen, true, 'rises were never seen in the data')

const found = ok(await call('retailai_find_products', { dataset: 'kedai-amber', query: 'milo', limit: 3 }))
const first = (found.products as { id: string }[])[0]
assert.ok(first?.id)
const sugg = ok(await call('retailai_product_suggestions', { dataset: 'kedai-amber', product_id: first.id }))
assert.ok(Array.isArray(sugg.bought_together))

const u = ok(await call('retailai_unusual_weeks', { dataset: 'superstore' }))
assert.ok(typeof u.found === 'number')

// Errors must come back as readable tool errors, not crashes.
const noQty = await call('retailai_price_sensitivity', { dataset: 'superstore' })
assert.equal(noQty.isError, true)
const badFilter = await call('retailai_sales_summary', { dataset: 'kedai-amber', where: { category: ['drinks'] } })
assert.equal(badFilter.isError, true)
assert.match(JSON.stringify(badFilter.content), /case-sensitive/)
const badPath = await call('retailai_describe_dataset', { dataset: 'relative/file.csv' })
assert.equal(badPath.isError, true)
const badArg = await call('retailai_forecast', { dataset: 'kedai-amber', weeks: 99 })
assert.equal(badArg.isError, true)
const dir = await call('retailai_describe_dataset', { dataset: '/tmp/claude-0/-home-claude/4cc9be20-6c2f-5e0e-9c22-fa9e0799bf33/scratchpad/dir.csv' })
assert.equal(dir.isError, true)
// date_order is accepted by every tool, not only describe.
ok(await call('retailai_sales_summary', { dataset: 'superstore', date_order: 'dmy', limit: 1 }))
// A deep cut that really happened in the data is not flagged; a rise is.
const deep = ok(await call('retailai_price_what_if', { dataset: 'kedai-amber', group: 'Drinks', price_change_pct: -25 }))
assert.equal(deep.outside_prices_seen, false)

await client.close()
console.error('Smoke test passed')
