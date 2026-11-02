// Shared types for the RetailAI analytics engine. Everything here is plain data so it
// can run in the browser, in a worker, or in Node for evaluation scripts.

export type Role =
  | 'revenue'
  | 'unitPrice'
  | 'quantity'
  | 'orderDate'
  | 'shipDate'
  | 'productName'
  | 'productId'
  | 'customerId'
  | 'customerName'
  | 'orderId'
  | 'category'
  | 'subcategory'
  | 'region'
  | 'segment'
  | 'state'
  | 'city'
  | 'profit'
  | 'discount'
  | 'cost'

export type Mapping = Partial<Record<Role, string>>

export type Confidence = 'exact' | 'likely' | 'guess'

export interface Detection {
  mapping: Mapping
  confidence: Partial<Record<Role, Confidence>>
  /** Columns that looked like a role but failed the value check, with the reason. */
  rejected: { column: string; role: Role; reason: string }[]
}

export type DateConvention = 'dmy' | 'mdy'

export interface CleanOptions {
  dateConvention: DateConvention
  dropExactDuplicates: boolean
}

/** One cleaned line item. Dates are whole UTC days since 1970-01-01. */
export interface Row {
  day: number
  shipDay?: number
  revenue: number
  qty?: number
  profit?: number
  discount?: number
  product: string
  productName: string
  customer?: string
  customerName?: string
  order: string
  category?: string
  subcategory?: string
  region?: string
  segment?: string
  state?: string
  city?: string
}

export type Dimension = 'category' | 'subcategory' | 'region' | 'segment' | 'state' | 'city'

export const DIMENSIONS: Dimension[] = ['category', 'subcategory', 'region', 'segment', 'state', 'city']

export const DIMENSION_LABEL: Record<Dimension, string> = {
  category: 'Category',
  subcategory: 'Sub-category',
  region: 'Region',
  segment: 'Segment',
  state: 'State',
  city: 'City',
}

export const DIMENSION_PLURAL: Record<Dimension, string> = {
  category: 'categories',
  subcategory: 'sub-categories',
  region: 'regions',
  segment: 'segments',
  state: 'states',
  city: 'cities',
}

export interface QualityIssue {
  level: 'info' | 'warn' | 'error'
  text: string
  count?: number
}

export interface Capabilities {
  dates: boolean
  products: boolean
  customers: boolean
  orders: boolean // a real order/invoice column, not an inferred one
  quantity: boolean
  profit: boolean
  dimensions: Dimension[]
}

export interface Dataset {
  name: string
  rows: Row[]
  rawRowCount: number
  columns: string[]
  detection: Detection
  mapping: Mapping
  options: CleanOptions
  quality: QualityIssue[]
  capabilities: Capabilities
  minDay: number
  maxDay: number
  /** Suggested convention from the date values themselves, if they decide it. */
  dateHint: DateConvention | 'ambiguous' | 'iso'
  revenueSource: 'revenue' | 'price×quantity' | 'price'
}
