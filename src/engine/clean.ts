// Turn raw records + a column mapping into clean line items and an honest quality report.
// Returns (negative revenue) are kept and reported, not silently dropped. Exact duplicate
// rows are counted and only removed when the user asks, because real line items repeat.
import type { Capabilities, CleanOptions, Dataset, Detection, Dimension, Mapping, QualityIssue, Row } from './types'
import { DIMENSIONS } from './types'
import { detectColumns } from './mapping'
import { detectDateConvention, parseDay, parseNumber } from './values'

export type RawRecord = Record<string, unknown>

const text = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined
  const s = String(v).trim()
  if (!s || /^(nan|null|none|n\/a|na|-)$/i.test(s)) return undefined
  return s
}

export function defaultOptions(records: RawRecord[], mapping: Mapping): CleanOptions {
  const hint = mapping.orderDate ? detectDateConvention(records.slice(0, 2000).map((r) => r[mapping.orderDate!])) : 'ambiguous'
  return { dateConvention: hint === 'mdy' ? 'mdy' : 'dmy', dropExactDuplicates: false }
}

export function buildDataset(
  name: string,
  records: RawRecord[],
  columns: string[],
  opts?: { mapping?: Mapping; options?: Partial<CleanOptions>; detection?: Detection },
): Dataset {
  const detection = opts?.detection ?? detectColumns(columns, records.slice(0, 500))
  const mapping: Mapping = { ...(opts?.mapping ?? detection.mapping) }
  const options: CleanOptions = { ...defaultOptions(records, mapping), ...opts?.options }
  const dateHint = mapping.orderDate
    ? detectDateConvention(records.slice(0, 5000).map((r) => r[mapping.orderDate!]))
    : 'ambiguous'

  const quality: QualityIssue[] = []
  const get = (r: RawRecord, role: keyof Mapping) => (mapping[role] ? r[mapping[role]!] : undefined)

  const revenueSource: Dataset['revenueSource'] = mapping.revenue
    ? 'revenue'
    : mapping.unitPrice && mapping.quantity
      ? 'price×quantity'
      : 'price'

  if (!mapping.revenue && !mapping.unitPrice) {
    quality.push({ level: 'error', text: 'No sales, revenue, amount or price column was found. Map one on the Data screen.' })
  }
  if (!mapping.orderDate) {
    quality.push({ level: 'warn', text: 'No order date column was found, so trends, forecasts and customer recency are off.' })
  }
  if (revenueSource === 'price×quantity') {
    quality.push({ level: 'info', text: `Line revenue is calculated as ${mapping.unitPrice} × ${mapping.quantity}.` })
  }
  if (revenueSource === 'price' && mapping.unitPrice) {
    quality.push({ level: 'warn', text: `Only a unit price column (${mapping.unitPrice}) was found, so each row's price is treated as its revenue.` })
  }

  let badRevenue = 0
  let badDate = 0
  let returns = 0
  let returnsValue = 0
  let duplicates = 0
  const seen = new Set<string>()
  const rows: Row[] = []
  let syntheticOrders = 0

  records.forEach((r, i) => {
    const key = columns.map((c) => String(r[c] ?? '')).join('\u0001')
    if (seen.has(key)) {
      duplicates++
      if (options.dropExactDuplicates) return
    } else seen.add(key)

    let revenue: number
    const qty = mapping.quantity ? parseNumber(get(r, 'quantity')) : undefined
    if (revenueSource === 'revenue') revenue = parseNumber(get(r, 'revenue'))
    else if (revenueSource === 'price×quantity') revenue = parseNumber(get(r, 'unitPrice')) * (qty ?? NaN)
    else revenue = parseNumber(get(r, 'unitPrice'))
    if (!Number.isFinite(revenue)) {
      badRevenue++
      return
    }

    let day = NaN
    if (mapping.orderDate) {
      day = parseDay(get(r, 'orderDate'), options.dateConvention)
      if (Number.isNaN(day)) {
        badDate++
        return
      }
    }

    if (revenue < 0) {
      returns++
      returnsValue += revenue
    }

    const productId = text(get(r, 'productId'))
    const productName = text(get(r, 'productName')) ?? productId ?? text(get(r, 'subcategory')) ?? text(get(r, 'category')) ?? 'Unlabelled item'
    const customer = text(get(r, 'customerId')) ?? text(get(r, 'customerName'))
    let order = text(get(r, 'orderId'))
    if (!order) {
      syntheticOrders++
      order = customer && !Number.isNaN(day) ? `${customer}@${day}` : `row-${i}`
    }

    const shipDay = mapping.shipDate ? parseDay(get(r, 'shipDate'), options.dateConvention) : NaN
    const profit = mapping.profit ? parseNumber(get(r, 'profit')) : NaN
    const discount = mapping.discount ? parseNumber(get(r, 'discount')) : NaN

    rows.push({
      day,
      shipDay: Number.isNaN(shipDay) ? undefined : shipDay,
      revenue,
      qty: qty !== undefined && Number.isFinite(qty) ? qty : undefined,
      profit: Number.isFinite(profit) ? profit : undefined,
      discount: Number.isFinite(discount) ? (discount > 1 ? discount / 100 : discount) : undefined,
      product: productId ?? productName,
      productName,
      customer,
      customerName: text(get(r, 'customerName')),
      order,
      category: text(get(r, 'category')),
      subcategory: text(get(r, 'subcategory')),
      region: text(get(r, 'region')),
      segment: text(get(r, 'segment')),
      state: text(get(r, 'state')),
      city: text(get(r, 'city')),
    })
  })

  if (badRevenue) quality.push({ level: 'warn', text: 'Rows without a readable revenue value were left out.', count: badRevenue })
  if (badDate) quality.push({ level: 'warn', text: `Rows whose order date could not be read as ${options.dateConvention === 'dmy' ? 'day/month/year' : 'month/day/year'} were left out.`, count: badDate })
  if (returns) quality.push({ level: 'info', text: `Rows with negative revenue are kept as returns or refunds (${returnsValue.toFixed(2)} in total).`, count: returns })
  if (duplicates) {
    quality.push({
      level: 'info',
      text: options.dropExactDuplicates
        ? 'Exact duplicate rows were removed at your request.'
        : 'Exact duplicate rows were found and kept, since identical line items can be real. You can remove them in the column matching.',
      count: duplicates,
    })
  }
  if (mapping.orderId === undefined && rows.length) {
    quality.push({
      level: 'warn',
      text: mapping.customerId || mapping.customerName
        ? 'No order ID column, so each customer\'s purchases on the same day are treated as one order.'
        : 'No order ID or customer column, so every row is treated as its own order and basket analysis is off.',
      count: syntheticOrders,
    })
  }
  if (mapping.productId && mapping.productName) {
    const names = new Map<string, Set<string>>()
    for (const row of rows) {
      if (!names.has(row.product)) names.set(row.product, new Set())
      names.get(row.product)!.add(row.productName)
    }
    const shared = [...names.values()].filter((s) => s.size > 1).length
    if (shared) quality.push({ level: 'info', text: 'Some product IDs appear with more than one name; products are grouped by ID.', count: shared })
  }

  const dimensions = DIMENSIONS.filter((d) => {
    const values = new Set<string>()
    for (const row of rows) {
      const v = row[d as Dimension]
      if (v) values.add(v)
      if (values.size > 1) return true
    }
    return false
  })

  const capabilities: Capabilities = {
    dates: !!mapping.orderDate && rows.length > 0,
    products: !!(mapping.productId || mapping.productName),
    customers: !!(mapping.customerId || mapping.customerName),
    orders: !!mapping.orderId,
    quantity: rows.some((r) => r.qty !== undefined),
    profit: rows.some((r) => r.profit !== undefined),
    dimensions,
  }

  let minDay = Infinity
  let maxDay = -Infinity
  for (const row of rows) {
    if (row.day < minDay) minDay = row.day
    if (row.day > maxDay) maxDay = row.day
  }

  if (!rows.length) quality.push({ level: 'error', text: 'No usable rows remain after cleaning. Check the column mapping and date convention.' })

  return {
    name,
    rows,
    rawRowCount: records.length,
    columns,
    detection,
    mapping,
    options,
    quality,
    capabilities,
    minDay: Number.isFinite(minDay) ? minDay : NaN,
    maxDay: Number.isFinite(maxDay) ? maxDay : NaN,
    dateHint,
    revenueSource,
  }
}
