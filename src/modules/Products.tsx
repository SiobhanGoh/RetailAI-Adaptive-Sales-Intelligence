import { useMemo, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Details, Empty, Fig, Headline, Panel } from '../ui/primitives'
import { buildIndex, similarProducts, subcategoryAffinity, suggestFor, togetherWith, topPairs, type Suggestion } from '../engine/recommend'
import { downloadCsv, money, plural, shorten } from '../format'
import evaluation from '../../verification/web_evaluation.json'

function TagList({ items, empty, why }: { items: Suggestion[]; empty: string; why: (s: Suggestion) => string }) {
  if (!items.length) return <p className="quiet">{empty}</p>
  return (
    <ol className="tags">
      {items.map((s) => (
        <li key={s.product} className="tag">
          <span className="tag-name">{s.name}</span>
          <span className="tag-why">{why(s)}</span>
        </li>
      ))}
    </ol>
  )
}

export function Products() {
  const { ds, rows, currency, source } = useApp()
  const idx = useMemo(() => (ds?.capabilities.products ? buildIndex(rows) : null), [rows, ds])
  const [query, setQuery] = useState('')
  const byName = useMemo(() => {
    const m = new Map<string, string>()
    if (idx) for (const p of idx.products.values()) if (!m.has(p.name)) m.set(p.name, p.id)
    return m
  }, [idx])
  const seed = idx ? (byName.get(query) ?? (idx.products.has(query) ? query : idx.popular[0])) : undefined
  const info = seed && idx ? idx.products.get(seed) : undefined

  const together = useMemo(() => (idx && seed ? togetherWith(idx, [seed], new Set([seed])).slice(0, 5) : []), [idx, seed])
  const sameSub = useMemo(() => (idx && seed ? suggestFor(idx, seed, 5, ['subcategory']) : []), [idx, seed])
  const similar = useMemo(() => (idx && seed ? similarProducts(idx, seed, 5) : []), [idx, seed])
  const pairs = useMemo(() => (idx ? topPairs(idx, 8) : []), [idx])
  const affinity = useMemo(() => (ds?.capabilities.orders ? subcategoryAffinity(rows, 8) : []), [rows, ds])
  const multiShare = useMemo(() => {
    if (!idx) return 0
    const sizes = new Map<string, Set<string>>()
    for (const r of rows) if (r.revenue > 0) (sizes.get(r.order) ?? sizes.set(r.order, new Set()).get(r.order)!).add(r.product)
    return [...sizes.values()].filter((s) => s.size > 1).length / Math.max(1, sizes.size)
  }, [rows, idx])

  const evalProducts = evaluation.products.test.metrics as Record<string, { hit_rate_at_5_pct: number }>

  usePrint(
    idx && info
      ? {
          title: 'Product finder',
          lines: [
            { label: 'Products sold', value: String(idx.products.size) },
            { label: 'Orders with 2+ items', value: `${(multiShare * 100).toFixed(0)}%` },
          ],
          notes: ['These are ideas to browse, not predictions: on later orders in the sample, none beat plain best sellers.'],
        }
      : null,
    `pr|${seed}|${rows.length}|${currency}`,
  )

  if (!ds) return null
  if (!idx || !idx.products.size) return <Empty title="Product views need a product column">Map a product name or ID on the Data screen.</Empty>

  return (
    <div className="mod mod-products">
      <header className="mod-head">
        <Headline k={`${seed}`}>
          {info ? (
            <>
              <p className="hl-line">
                <b className="fig fig-name">{shorten(info.name, 40)}</b> sold <Fig value={info.net} format={(v) => money(v, currency)} /> in {plural(info.orders, 'order')}.
              </p>
              <p className="hl-line hl-sub">
                {together[0] ? `People who bought it also picked up ${together[0].name}.` : `No other order contains it yet, so the lists lean on its ${info.subcategory ? 'sub-category' : 'description'}.`}
              </p>
            </>
          ) : null}
        </Headline>
        <label className="select-wrap select-wide">
          <span>Look up any product</span>
          <input className="field" list="product-list" value={query} placeholder="Type a product name" onChange={(e) => setQuery(e.target.value)} />
          <datalist id="product-list">
            {[...byName.keys()].slice(0, 3000).map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
      </header>

      <div className="trio">
        <Panel bare title="Bought in the same order">
          <TagList items={together} empty="No other order contains this item yet." why={(s) => `Together in ${plural(s.evidence, 'order')}`} />
        </Panel>
        <Panel bare title={`Best sellers in ${info?.subcategory ?? 'its sub-category'}`}>
          <TagList items={sameSub} empty="This item has no sub-category to compare within." why={(s) => `In ${plural(s.evidence, 'order')}`} />
        </Panel>
        <Panel bare title="Similar description">
          <TagList items={similar} empty="No other product shares words with this one." why={(s) => `${Math.round(s.score * 100)}% word overlap`} />
        </Panel>
      </div>

      <Details label="Show pairs that sell together">
      <div className="split">
        <Panel
          title="Item pairs seen more than once"
          aside={
            pairs.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv('item-pairs', topPairs(idx, 10_000).map((p) => ({ item_a: idx.products.get(p.a)!.name, item_b: idx.products.get(p.b)!.name, orders_together: p.together, lift: p.lift.toFixed(2) })))}>
                Download CSV
              </button>
            )
          }
        >
          {pairs.length ? (
            <ul className="pairs">
              {pairs.map((p) => (
                <li key={`${p.a}${p.b}`}>
                  <span>{idx.products.get(p.a)!.name}</span>
                  <span className="pair-plus" aria-hidden>+</span>
                  <span>{idx.products.get(p.b)!.name}</span>
                  <b>{p.together}×</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet">No pair of items appears together in more than one order. Baskets in this view are too varied for item-level pairing; the sub-category view is more useful.</p>
          )}
        </Panel>
        {affinity.length > 0 && (
          <Panel title="Sub-categories that travel together">
            <ul className="pairs">
              {affinity.map((p) => (
                <li key={`${p.a}${p.b}`}>
                  <span>{p.a}</span>
                  <span className="pair-plus" aria-hidden>+</span>
                  <span>{p.b}</span>
                  <b title="Lift: how much more often they share an order than chance">{p.lift.toFixed(2)}×</b>
                </li>
              ))}
            </ul>
            <p className="fine">Lift above 1 means the pair shares orders more often than if purchases were independent. Only pairs seen in at least five orders are listed.</p>
          </Panel>
        )}
      </div>

      {source?.bundled && (
        <p className="note">
          On later orders in this sample store, guessing the other items in a basket from one item worked {evalProducts.popular.hit_rate_at_5_pct}% of the time with plain best sellers, {evalProducts['together+popular'].hit_rate_at_5_pct}% with bought-together and {evalProducts.similar.hit_rate_at_5_pct}% with similar descriptions. Baskets here rarely repeat, so use these lists for browsing ideas rather than as predictions.
        </p>
      )}
      </Details>
    </div>
  )
}
