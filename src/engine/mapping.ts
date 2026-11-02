// Column detection by whole words, checked against the values, so "statement_no" is never a
// state, "unit_price" is never treated as line revenue, and "ship_date" is never the order date.
import type { Confidence, Detection, Mapping, Role } from './types'
import { parseDay, parseNumber } from './values'

export const ROLE_LABEL: Record<Role, string> = {
  revenue: 'Line revenue',
  unitPrice: 'Unit price',
  quantity: 'Quantity',
  orderDate: 'Order date',
  shipDate: 'Ship date',
  productName: 'Product name',
  productId: 'Product ID',
  customerId: 'Customer ID',
  customerName: 'Customer name',
  orderId: 'Order ID',
  category: 'Category',
  subcategory: 'Sub-category',
  region: 'Region',
  segment: 'Segment',
  state: 'State',
  city: 'City',
  profit: 'Profit',
  discount: 'Discount',
  cost: 'Cost',
}

export const ROLE_ORDER: Role[] = [
  'orderDate', 'revenue', 'unitPrice', 'quantity', 'orderId', 'productId', 'productName',
  'customerId', 'customerName', 'category', 'subcategory', 'region', 'segment', 'state', 'city',
  'profit', 'discount', 'cost', 'shipDate',
]

/** "Order Date", "orderDate", "order-date" → ["order", "date"] */
export function tokenize(header: string): string[] {
  return header
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

const ID = ['id', 'code', 'no', 'num', 'number', 'key', 'ref', 'sku']
const has = (t: string[], words: string[]) => words.some((w) => t.includes(w))
const joined = (t: string[]) => t.join('')

type Scorer = (t: string[]) => number // 0 = no match, 3 = exact

const SCORERS: Record<Role, Scorer> = {
  orderDate: (t) => {
    if (!has(t, ['date', 'dt', 'day', 'time', 'timestamp', 'datetime'])) return 0
    if (has(t, ['ship', 'shipping', 'shipped', 'delivery', 'delivered', 'dispatch', 'due', 'birth', 'dob', 'expiry', 'updated', 'modified'])) return 0
    if (has(t, ['order', 'transaction', 'txn', 'invoice', 'purchase', 'sale', 'sales', 'receipt'])) return 3
    if (t.length === 1 && t[0] === 'date') return 3
    return 1
  },
  shipDate: (t) =>
    has(t, ['date', 'dt', 'day']) && has(t, ['ship', 'shipping', 'shipped', 'delivery', 'delivered', 'dispatch']) ? 3 : 0,
  revenue: (t) => {
    if (has(t, ['qty', 'quantity', 'count', 'units', 'unit', 'rate', 'pct', 'percent', 'discount', 'tax', 'date', 'profit', 'cost', 'margin', 'id', 'target', 'budget', 'rep', 'person', 'channel', 'manager', 'team', 'region'])) return 0
    if (has(t, ['sales', 'revenue', 'turnover', 'subtotal'])) return 3
    if (has(t, ['amount', 'total', 'gross', 'net'])) return t.includes('price') ? 3 : 2
    if (has(t, ['value']) && has(t, ['order', 'line', 'sale', 'transaction'])) return 2
    return 0
  },
  unitPrice: (t) => {
    if (has(t, ['total', 'amount', 'sales', 'revenue'])) return 0
    if (t.includes('price')) return has(t, ['unit', 'selling', 'list', 'retail']) || t.length === 1 ? 3 : 2
    return joined(t) === 'unitprice' ? 3 : 0
  },
  quantity: (t) => {
    if (has(t, ID)) return 0
    if (has(t, ['quantity', 'qty'])) return 3
    if (t.length === 1 && t[0] === 'units') return 2
    return 0
  },
  orderId: (t) => {
    if (has(t, ['date', 'time', 'line'])) return 0
    if (has(t, ['order', 'invoice', 'transaction', 'txn', 'receipt', 'basket', 'bill'])) {
      if (has(t, ID)) return 3
      if (t.length === 1) return 2
    }
    return 0
  },
  productId: (t) => {
    if (has(t, ['sku', 'asin', 'upc', 'ean', 'barcode'])) return 3
    if (has(t, ['product', 'item', 'stock', 'article']) && has(t, ID)) return 3
    return 0
  },
  productName: (t) => {
    if (has(t, ID) || has(t, ['category', 'type', 'count', 'qty', 'quantity', 'price', 'group'])) return 0
    if (has(t, ['product', 'item', 'article']) && has(t, ['name', 'title', 'description', 'desc'])) return 3
    if (t.length === 1 && has(t, ['product', 'item', 'title', 'description'])) return 2
    return 0
  },
  customerId: (t) =>
    has(t, ['customer', 'client', 'buyer', 'member', 'user', 'shopper', 'account']) && has(t, ID) ? 3 : 0,
  customerName: (t) =>
    has(t, ['customer', 'client', 'buyer', 'shopper']) && has(t, ['name']) ? 3 : 0,
  category: (t) => {
    if (t.includes('sub') || joined(t).startsWith('sub') || has(t, ID)) return 0
    if (has(t, ['category', 'department', 'dept'])) return 3
    if (t.length === 1 && t[0] === 'cat') return 2
    return 0
  },
  subcategory: (t) =>
    joined(t) === 'subcategory' || joined(t) === 'subcat' || (t.includes('sub') && has(t, ['category', 'cat'])) ? 3 : 0,
  region: (t) => {
    if (has(t, ID)) return 0
    if (t.includes('region')) return 3
    if (t.length === 1 && has(t, ['zone', 'area', 'territory'])) return 2
    return 0
  },
  segment: (t) => (t.includes('segment') && !has(t, ID) ? 3 : 0),
  state: (t) => (has(t, ['state', 'province']) && !has(t, ID) && !t.includes('postal') ? 3 : 0),
  city: (t) => (has(t, ['city', 'town']) && !has(t, ID) ? 3 : 0),
  profit: (t) => (t.includes('profit') && !has(t, ['pct', 'percent', 'ratio', 'rate', 'margin']) ? 3 : 0),
  discount: (t) => (t.includes('discount') ? 3 : 0),
  cost: (t) => (has(t, ['cost', 'cogs']) && !has(t, ['shipping', 'freight']) ? 3 : 0),
}

const NUMERIC: Role[] = ['revenue', 'unitPrice', 'quantity', 'profit', 'discount', 'cost']
const DATES: Role[] = ['orderDate', 'shipDate']

function share(values: unknown[], ok: (v: unknown) => boolean): number {
  const filled = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  if (!filled.length) return 0
  return filled.filter(ok).length / filled.length
}

export function detectColumns(columns: string[], sample: Record<string, unknown>[]): Detection {
  const mapping: Mapping = {}
  const confidence: Detection['confidence'] = {}
  const rejected: Detection['rejected'] = []
  const used = new Set<string>()

  for (const role of ROLE_ORDER) {
    const candidates = columns
      .map((c) => ({ c, score: SCORERS[role](tokenize(c)) }))
      .filter((x) => x.score > 0 && !used.has(x.c))
      .sort((a, b) => b.score - a.score)

    for (const { c, score } of candidates) {
      const values = sample.map((r) => r[c])
      if (NUMERIC.includes(role)) {
        const ratio = share(values, (v) => !Number.isNaN(parseNumber(v)))
        if (ratio < 0.9) {
          rejected.push({ column: c, role, reason: `only ${Math.round(ratio * 100)}% of values are numbers` })
          continue
        }
      }
      if (DATES.includes(role)) {
        const ratio = share(values, (v) => !Number.isNaN(parseDay(v, 'dmy')) || !Number.isNaN(parseDay(v, 'mdy')))
        if (ratio < 0.9) {
          rejected.push({ column: c, role, reason: `only ${Math.round(ratio * 100)}% of values are dates` })
          continue
        }
      }
      mapping[role] = c
      confidence[role] = (score >= 3 ? 'exact' : score === 2 ? 'likely' : 'guess') as Confidence
      used.add(c)
      break
    }
  }
  return { mapping, confidence, rejected }
}
