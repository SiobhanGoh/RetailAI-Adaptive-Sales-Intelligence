// Product suggestions built from order baskets (not customer-level spend), with explicit
// backfill tiers so every list says why each item is there.
import type { Row } from './types'

export type Reason = 'bought-together' | 'same-subcategory' | 'same-category' | 'popular' | 'similar-name'

export const REASON_LABEL: Record<Reason, string> = {
  'bought-together': 'Bought in the same order',
  'same-subcategory': 'Popular in the same sub-category',
  'same-category': 'Popular in the same category',
  popular: 'Popular overall',
  'similar-name': 'Similar description',
}

export interface Suggestion {
  product: string
  name: string
  reason: Reason
  /** Orders containing both items (bought-together) or orders containing the item (popularity tiers). */
  evidence: number
  score: number
}

export interface ProductInfo {
  id: string
  name: string
  category?: string
  subcategory?: string
  orders: number
  net: number
}

export interface RecIndex {
  products: Map<string, ProductInfo>
  popular: string[]
  bySub: Map<string, string[]>
  byCat: Map<string, string[]>
  pairs: Map<string, Map<string, number>>
  customerItems: Map<string, Set<string>>
  tfidf: { vectors: Map<string, Map<string, number>>; postings: Map<string, string[]> }
  orders: number
}

const STOP = new Set(['the', 'and', 'for', 'with', 'of', 'a', 'an', 'in', 'to', 'by', 'x', 'pack', 'set', 'per'])

function terms(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t))
}

export function buildIndex(rows: Row[]): RecIndex {
  const products = new Map<string, ProductInfo>()
  const baskets = new Map<string, Set<string>>()
  const customerItems = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.revenue <= 0) continue
    let p = products.get(r.product)
    if (!p) products.set(r.product, (p = { id: r.product, name: r.productName, category: r.category, subcategory: r.subcategory, orders: 0, net: 0 }))
    p.net += r.revenue
    let b = baskets.get(r.order)
    if (!b) baskets.set(r.order, (b = new Set()))
    b.add(r.product)
    if (r.customer) {
      let c = customerItems.get(r.customer)
      if (!c) customerItems.set(r.customer, (c = new Set()))
      c.add(r.product)
    }
  }
  const pairs = new Map<string, Map<string, number>>()
  for (const items of baskets.values()) {
    for (const id of items) products.get(id)!.orders++
    if (items.size < 2) continue
    const list = [...items]
    for (const a of list) {
      let m = pairs.get(a)
      if (!m) pairs.set(a, (m = new Map()))
      for (const b of list) if (a !== b) m.set(b, (m.get(b) ?? 0) + 1)
    }
  }
  const rank = (ids: string[]) =>
    ids.sort((a, b) => products.get(b)!.orders - products.get(a)!.orders || products.get(b)!.net - products.get(a)!.net)
  const popular = rank([...products.keys()])
  const bySub = new Map<string, string[]>()
  const byCat = new Map<string, string[]>()
  for (const id of popular) {
    const p = products.get(id)!
    if (p.subcategory) (bySub.get(p.subcategory) ?? bySub.set(p.subcategory, []).get(p.subcategory)!).push(id)
    if (p.category) (byCat.get(p.category) ?? byCat.set(p.category, []).get(p.category)!).push(id)
  }

  // TF-IDF over name + sub-category + category, with an inverted index so a query only
  // touches products that share a term (no products × products matrix).
  const docs = new Map<string, string[]>()
  const df = new Map<string, number>()
  for (const p of products.values()) {
    const t = terms(`${p.name} ${p.subcategory ?? ''} ${p.category ?? ''}`)
    docs.set(p.id, t)
    for (const term of new Set(t)) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const N = products.size
  const vectors = new Map<string, Map<string, number>>()
  const postings = new Map<string, string[]>()
  for (const [id, t] of docs) {
    const tf = new Map<string, number>()
    for (const term of t) tf.set(term, (tf.get(term) ?? 0) + 1)
    let norm = 0
    const v = new Map<string, number>()
    for (const [term, c] of tf) {
      const w = (1 + Math.log(c)) * (Math.log((1 + N) / (1 + df.get(term)!)) + 1)
      v.set(term, w)
      norm += w * w
    }
    norm = Math.sqrt(norm) || 1
    for (const [term, w] of v) {
      v.set(term, w / norm)
      ;(postings.get(term) ?? postings.set(term, []).get(term)!).push(id)
    }
    vectors.set(id, v)
  }
  return { products, popular, bySub, byCat, pairs, customerItems, tfidf: { vectors, postings }, orders: baskets.size }
}

export type Tier = 'together' | 'subcategory' | 'category' | 'popular' | 'similar'

/** Generic fallback chain. The Products screen shows each tier as its own labelled list instead. */
export const DEFAULT_CHAIN: Tier[] = ['together', 'subcategory', 'popular']

function fill(out: Suggestion[], seen: Set<string>, ids: Iterable<string>, idx: RecIndex, reason: Reason, k: number) {
  for (const id of ids) {
    if (out.length >= k) return
    if (seen.has(id)) continue
    seen.add(id)
    const p = idx.products.get(id)!
    out.push({ product: id, name: p.name, reason, evidence: p.orders, score: p.orders / Math.max(1, idx.orders) })
  }
}

export function similarProducts(idx: RecIndex, seed: string, k: number, exclude = new Set<string>()): Suggestion[] {
  const v = idx.tfidf.vectors.get(seed)
  if (!v) return []
  const scores = new Map<string, number>()
  for (const [term, w] of v) {
    for (const id of idx.tfidf.postings.get(term) ?? []) {
      if (id === seed || exclude.has(id)) continue
      scores.set(id, (scores.get(id) ?? 0) + w * idx.tfidf.vectors.get(id)!.get(term)!)
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || idx.products.get(b[0])!.orders - idx.products.get(a[0])!.orders)
    .slice(0, k)
    .map(([id, s]) => ({ product: id, name: idx.products.get(id)!.name, reason: 'similar-name' as Reason, evidence: idx.products.get(id)!.orders, score: s }))
}

export function togetherWith(idx: RecIndex, seeds: string[], exclude: Set<string>): Suggestion[] {
  const agg = new Map<string, { score: number; count: number }>()
  for (const s of seeds) {
    const m = idx.pairs.get(s)
    if (!m) continue
    const ns = idx.products.get(s)?.orders ?? 1
    for (const [id, c] of m) {
      if (exclude.has(id)) continue
      const nj = idx.products.get(id)!.orders
      const cur = agg.get(id) ?? { score: 0, count: 0 }
      cur.score += c / Math.sqrt(ns * nj)
      cur.count += c
      agg.set(id, cur)
    }
  }
  return [...agg.entries()]
    .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count)
    .map(([id, s]) => ({ product: id, name: idx.products.get(id)!.name, reason: 'bought-together' as Reason, evidence: s.count, score: s.score }))
}

/** Suggestions for one product, walking the tier chain until k items are found. */
export function suggestFor(idx: RecIndex, seed: string, k = 5, chain: Tier[] = DEFAULT_CHAIN): Suggestion[] {
  const p = idx.products.get(seed)
  const out: Suggestion[] = []
  const seen = new Set<string>([seed])
  for (const tier of chain) {
    if (out.length >= k) break
    if (tier === 'together') for (const s of togetherWith(idx, [seed], seen)) if (out.length < k) (out.push(s), seen.add(s.product))
    if (tier === 'similar') for (const s of similarProducts(idx, seed, k, seen)) if (out.length < k) (out.push(s), seen.add(s.product))
    if (tier === 'subcategory' && p?.subcategory) fill(out, seen, idx.bySub.get(p.subcategory) ?? [], idx, 'same-subcategory', k)
    if (tier === 'category' && p?.category) fill(out, seen, idx.byCat.get(p.category) ?? [], idx, 'same-category', k)
    if (tier === 'popular') fill(out, seen, idx.popular, idx, 'popular', k)
  }
  return out
}

export type CustomerTier = 'together' | 'their-subcategories' | 'popular'
/** Picked on a validation window inside the training period (scripts/evaluate.ts). On the later
 * test window it did worse than plain popularity; the app says so next to the list. */
export const DEFAULT_CUSTOMER_CHAIN: CustomerTier[] = ['their-subcategories', 'popular']

/** Next-purchase ideas for a customer: items they have not bought yet. */
export function suggestForCustomer(idx: RecIndex, customer: string, k = 5, chain: CustomerTier[] = DEFAULT_CUSTOMER_CHAIN): Suggestion[] {
  const owned = idx.customerItems.get(customer) ?? new Set<string>()
  const out: Suggestion[] = []
  const seen = new Set(owned)
  for (const tier of chain) {
    if (out.length >= k) break
    if (tier === 'together') for (const s of togetherWith(idx, [...owned], seen)) if (out.length < k) (out.push(s), seen.add(s.product))
    if (tier === 'their-subcategories') {
      const counts = new Map<string, number>()
      for (const id of owned) {
        const sub = idx.products.get(id)?.subcategory
        if (sub) counts.set(sub, (counts.get(sub) ?? 0) + 1)
      }
      const subs = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
      // Interleave their sub-categories so one heavy sub-category does not take every slot.
      const lists = subs.map((s) => (idx.bySub.get(s) ?? []).filter((id) => !seen.has(id)))
      for (let i = 0; out.length < k && lists.some((l) => i < l.length); i++) {
        for (const l of lists) if (i < l.length) fill(out, seen, [l[i]], idx, 'same-subcategory', k)
      }
    }
    if (tier === 'popular') fill(out, seen, idx.popular, idx, 'popular', k)
  }
  return out
}

/** Most frequent product pairs across orders, with lift so common items do not dominate. */
export function topPairs(idx: RecIndex, limit = 12): { a: string; b: string; together: number; lift: number }[] {
  const out: { a: string; b: string; together: number; lift: number }[] = []
  for (const [a, m] of idx.pairs) {
    for (const [b, c] of m) {
      if (a >= b || c < 2) continue
      const pa = idx.products.get(a)!.orders / idx.orders
      const pb = idx.products.get(b)!.orders / idx.orders
      out.push({ a, b, together: c, lift: c / idx.orders / (pa * pb) })
    }
  }
  return out.sort((x, y) => y.together - x.together || y.lift - x.lift).slice(0, limit)
}

/** Sub-category pairs that share orders — denser than item pairs on sparse catalogues. */
export function subcategoryAffinity(rows: Row[], limit = 10): { a: string; b: string; together: number; lift: number }[] {
  const baskets = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.subcategory || r.revenue <= 0) continue
    ;(baskets.get(r.order) ?? baskets.set(r.order, new Set()).get(r.order)!).add(r.subcategory)
  }
  const single = new Map<string, number>()
  const pair = new Map<string, number>()
  for (const s of baskets.values()) {
    for (const a of s) single.set(a, (single.get(a) ?? 0) + 1)
    const l = [...s].sort()
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const key = `${l[i]}\u0001${l[j]}`
      pair.set(key, (pair.get(key) ?? 0) + 1)
    }
  }
  const N = baskets.size
  return [...pair.entries()]
    .map(([key, c]) => {
      const [a, b] = key.split('\u0001')
      return { a, b, together: c, lift: (c / N) / ((single.get(a)! / N) * (single.get(b)! / N)) }
    })
    .filter((p) => p.together >= 5)
    .sort((x, y) => y.lift - x.lift)
    .slice(0, limit)
}
