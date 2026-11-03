import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { detectColumns, tokenize } from '../src/engine/mapping'
import { buildDataset } from '../src/engine/clean'
import { parseCsvText } from '../src/engine/load'
import { parseDay, parseNumber, dayToISO, detectDateConvention } from '../src/engine/values'
import { kpis, modelWeeks, weeklySeries, filterRows, comparisons } from '../src/engine/aggregate'
import { FORECASTERS, runForecast, type SeriesPoint } from '../src/engine/forecast'
import { buildIndex, suggestFor, similarProducts, suggestForCustomer } from '../src/engine/recommend'
import { customerStats, cohorts } from '../src/engine/customers'
import { findAnomalies } from '../src/engine/anomalies'

const bundled = (() => {
  const t = parseCsvText(readFileSync('data/superstore_sales.csv', 'utf8'))
  return buildDataset('Superstore', t.records, t.columns)
})()

describe('column detection', () => {
  it('splits camelCase and separators', () => {
    expect(tokenize('orderDate')).toEqual(['order', 'date'])
    expect(tokenize('Sub-Category')).toEqual(['sub', 'category'])
  })

  it('avoids the substring traps of the old mapper', () => {
    const cols = ['statement_no', 'unit_price', 'qty', 'ship_date', 'txn_date', 'product_id', 'area_code', 'sales_rep', 'invoice']
    const sample = [{ statement_no: 'S1', unit_price: '9.50', qty: '2', ship_date: '2024-01-03', txn_date: '2024-01-01', product_id: 'P1', area_code: '03', sales_rep: 'Ana', invoice: 'INV1' }]
    const { mapping } = detectColumns(cols, sample)
    expect(mapping.state).toBeUndefined()
    expect(mapping.revenue).toBeUndefined() // sales_rep holds names, unit_price is a price
    expect(mapping.unitPrice).toBe('unit_price')
    expect(mapping.quantity).toBe('qty')
    expect(mapping.orderDate).toBe('txn_date')
    expect(mapping.shipDate).toBe('ship_date')
    expect(mapping.productName).toBeUndefined()
    expect(mapping.productId).toBe('product_id')
    expect(mapping.region).toBeUndefined()
    expect(mapping.orderId).toBe('invoice')
  })

  it('maps the bundled dataset fully', () => {
    const m = bundled.mapping
    expect(m).toMatchObject({ orderDate: 'Order Date', revenue: 'Sales', orderId: 'Order ID', productId: 'Product ID', productName: 'Product Name', customerId: 'Customer ID', category: 'Category', subcategory: 'Sub-Category', region: 'Region', shipDate: 'Ship Date' })
  })
})

describe('values', () => {
  it('parses money formats', () => {
    expect(parseNumber('RM1,234.50')).toBe(1234.5)
    expect(parseNumber('(12.00)')).toBe(-12)
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('$-5')).toBe(-5)
    expect(parseNumber('abc')).toBeNaN()
  })

  it('reads dates by convention and keeps ISO order', () => {
    expect(dayToISO(parseDay('08/11/2017', 'dmy'))).toBe('2017-11-08')
    expect(dayToISO(parseDay('08/11/2017', 'mdy'))).toBe('2017-08-11')
    expect(dayToISO(parseDay('2017-11-08', 'mdy'))).toBe('2017-11-08')
    expect(dayToISO(parseDay('8 Nov 2017', 'mdy'))).toBe('2017-11-08')
    expect(parseDay('31/02/2017', 'dmy')).toBeNaN()
    expect(detectDateConvention(['13/01/2020', '02/03/2020'])).toBe('dmy')
    expect(detectDateConvention(['01/13/2020'])).toBe('mdy')
  })
})

describe('cleaning', () => {
  it('reproduces the verified bundled totals', () => {
    const k = kpis(bundled.rows)
    expect(bundled.rows.length).toBe(9800)
    expect(k.net).toBeCloseTo(2261536.7827, 3)
    expect(k.orders).toBe(4922)
    expect(dayToISO(bundled.rows[0].day)).toBe('2017-11-08')
  })

  it('keeps returns and duplicate rows unless asked', () => {
    const cols = ['Date', 'Order ID', 'Item', 'Sales']
    const rec = [
      { Date: '2024-01-01', 'Order ID': 'A', Item: 'x', Sales: '10' },
      { Date: '2024-01-01', 'Order ID': 'A', Item: 'x', Sales: '10' },
      { Date: '2024-01-02', 'Order ID': 'B', Item: 'x', Sales: '-4' },
    ]
    const kept = buildDataset('t', rec, cols)
    expect(kept.rows.length).toBe(3)
    expect(kpis(kept.rows)).toMatchObject({ gross: 20, returns: -4, net: 16 })
    const dropped = buildDataset('t', rec, cols, { options: { dropExactDuplicates: true } })
    expect(dropped.rows.length).toBe(2)
  })

  it('derives revenue from price × quantity', () => {
    const ds = buildDataset('t', [{ 'Unit Price': '2.5', Quantity: '4', Date: '2024-01-01' }], ['Unit Price', 'Quantity', 'Date'])
    expect(ds.revenueSource).toBe('price×quantity')
    expect(ds.rows[0].revenue).toBe(10)
  })
})

describe('weekly series', () => {
  it('drops partial edge weeks from modelling', () => {
    const weeks = weeklySeries(bundled.rows, bundled.minDay, bundled.maxDay)
    expect(weeks.length).toBe(209)
    expect(weeks[0].complete).toBe(false)
    expect(modelWeeks(weeks).length).toBe(208)
  })

  it('compares against windows that exist', () => {
    const f = { from: bundled.maxDay - 89, to: bundled.maxDay, dims: {} }
    const [prev, yoy] = comparisons(bundled, f)
    expect(prev.kpis).not.toBeNull()
    expect(yoy.kpis).not.toBeNull()
    const early = comparisons(bundled, { from: bundled.minDay, to: bundled.minDay + 30, dims: {} })
    expect(early[0].kpis).toBeNull()
  })
})

describe('forecasting', () => {
  const series: SeriesPoint[] = modelWeeks(weeklySeries(bundled.rows, bundled.minDay, bundled.maxDay)).map((w) => ({ end: w.end, y: w.net }))

  it('never reads values after the forecast origin', () => {
    const hist = series.slice(0, 150)
    for (const [id, f] of Object.entries(FORECASTERS)) {
      const clean = f(hist, 4)
      // Forecasts from a prefix must not change when later (unseen) weeks are altered.
      const altered = series.map((p, i) => (i >= 150 ? { ...p, y: 1e9 } : p))
      expect(f(altered.slice(0, 150), 4), id).toEqual(clean)
    }
  })

  it('returns a chosen model, a non-negative forecast and ordered bands', () => {
    const r = runForecast(series, 4)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.forecast).toHaveLength(4)
    for (const p of r.forecast) {
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.lo).toBeLessThanOrEqual(p.y)
      expect(p.hi).toBeGreaterThanOrEqual(p.y)
    }
  })

  it('refuses short or sparse histories with a reason', () => {
    const r = runForecast(series.slice(0, 10), 4)
    expect(r.ok).toBe(false)
  })
})

describe('recommendations', () => {
  const idx = buildIndex(filterRows(bundled.rows, { from: bundled.minDay, to: bundled.maxDay, dims: {} }))
  const seed = idx.popular[0]

  it('fills k suggestions without repeating the seed', () => {
    const s = suggestFor(idx, seed, 5)
    expect(s).toHaveLength(5)
    expect(s.map((x) => x.product)).not.toContain(seed)
    expect(new Set(s.map((x) => x.product)).size).toBe(5)
  })

  it('labels bought-together items with real co-order counts', () => {
    for (const s of suggestFor(idx, seed, 5, ['together'])) {
      expect(s.reason).toBe('bought-together')
      expect(s.evidence).toBeGreaterThan(0)
    }
  })

  it('finds similar descriptions and skips owned items for customers', () => {
    expect(similarProducts(idx, seed, 5).length).toBeGreaterThan(0)
    const customer = [...idx.customerItems.keys()][0]
    const owned = idx.customerItems.get(customer)!
    for (const s of suggestForCustomer(idx, customer, 5)) expect(owned.has(s.product)).toBe(false)
  })
})

describe('customers and anomalies', () => {
  it('scores every customer and builds cohorts that start at 100%', () => {
    const stats = customerStats(bundled.rows, bundled.maxDay + 1)
    expect(stats.length).toBe(793)
    for (const c of stats) expect(c.r >= 1 && c.r <= 5 && c.f >= 1 && c.f <= 5).toBe(true)
    for (const c of cohorts(bundled.rows, bundled.maxDay)) expect(c.retention[0]).toBe(1)
  })

  it('explains unusual weeks with drivers in the same direction', () => {
    const weeks = weeklySeries(bundled.rows, bundled.minDay, bundled.maxDay)
    for (const a of findAnomalies(weeks, bundled.rows, ['category', 'region'])) {
      for (const d of a.drivers) expect(Math.sign(d.delta)).toBe(a.direction === 'spike' ? 1 : -1)
    }
  })
})

describe('a messy upload (synthetic gift-shop fixture)', () => {
  const t = parseCsvText(readFileSync('test/fixtures/synthetic_gift_shop.csv', 'utf8'))
  const ds = buildDataset('gift', t.records, t.columns)

  it('maps invoice-style headers and derives revenue from price × quantity', () => {
    expect(ds.mapping).toMatchObject({ orderId: 'Invoice', orderDate: 'InvoiceDate', productId: 'StockCode', unitPrice: 'Price', quantity: 'Quantity', customerId: 'Customer ID' })
    expect(ds.revenueSource).toBe('price×quantity')
  })

  it('detects month-first dates, keeps returns and reports the duplicate', () => {
    expect(ds.dateHint).toBe('mdy')
    expect(ds.options.dateConvention).toBe('mdy')
    expect(dayToISO(ds.minDay)).toBe('2023-01-02')
    expect(kpis(ds.rows).returns).toBeLessThan(0)
    expect(ds.quality.some((q) => q.text.includes('duplicate') && q.count === 1)).toBe(true)
  })
})

describe('bundled samples', () => {
  const load = (file: string) => {
    const t = parseCsvText(readFileSync(`data/${file}`, 'utf8'))
    return buildDataset(file, t.records, t.columns)
  }

  it('reads the trimmed Online Retail II file with returns, units and real baskets', () => {
    const ds = load('online_retail_ii_sample.csv')
    expect(ds.mapping).toMatchObject({ orderId: 'Invoice', orderDate: 'InvoiceDate', productId: 'StockCode', unitPrice: 'Price', quantity: 'Quantity', customerId: 'Customer ID' })
    expect(ds.rows.length).toBe(158114)
    const k = kpis(ds.rows)
    expect(k.customers).toBe(1695)
    expect(k.returns).toBeLessThan(0)
    expect(k.units).toBeGreaterThan(0)
    expect(dayToISO(ds.minDay)).toBe('2010-12-01')
    expect(dayToISO(ds.maxDay)).toBe('2011-12-09')
  })

  it('reads the synthetic Malaysian store with every column role filled', () => {
    const ds = load('kedai_amber_synthetic.csv')
    for (const role of ['orderId', 'orderDate', 'productId', 'productName', 'customerId', 'category', 'subcategory', 'region', 'segment', 'state', 'city', 'quantity', 'unitPrice', 'revenue', 'profit', 'discount'] as const) {
      expect(ds.mapping[role], role).toBeDefined()
    }
    const k = kpis(ds.rows)
    expect(k.margin).toBeGreaterThan(0.1)
    expect(k.returns).toBeLessThan(0)
    expect(ds.capabilities.dimensions).toEqual(['category', 'subcategory', 'region', 'segment', 'state', 'city'])
  })
})
