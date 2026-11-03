import { useMemo, useState } from 'react'
import { PairWeb } from '../charts/misc'
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
  const { ds, rows, currency, sampleId } = useApp()
  const idx = useMemo(() => (ds?.capabilities.products ? buildIndex(rows) : null), [rows, ds])
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')
  const [sub, setSub] = useState('')
  // Narrowing by category and sub-category shortens the name list and jumps to that group's best seller.
  const cats = useMemo(() => (idx ? [...idx.byCat.keys()].sort() : []), [idx])
  const subs = useMemo(() => {
    if (!idx) return []
    const set = new Set<string>()
    for (const p of idx.products.values()) if (p.subcategory && (!cat || p.category === cat)) set.add(p.subcategory)
    return [...set].sort()
  }, [idx, cat])
  const pool = useMemo(() => (idx ? [...idx.products.values()].filter((p) => (!cat || p.category === cat) && (!sub || p.subcategory === sub)).sort((a, b) => b.net - a.net) : []), [idx, cat, sub])
  const byName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of pool) if (!m.has(p.name)) m.set(p.name, p.id)
    return m
  }, [pool])
  const seed = idx ? (byName.get(query) ?? (idx.products.has(query) ? query : (cat || sub) && pool[0] ? pool[0].id : idx.popular[0])) : undefined
  const [hoverPair, setHoverPair] = useState<number | null>(null)
  const info = seed && idx ? idx.products.get(seed) : undefined

  const together = useMemo(() => (idx && seed ? togetherWith(idx, [seed], new Set([seed])).slice(0, 5) : []), [idx, seed])
  const sameSub = useMemo(() => (idx && seed ? suggestFor(idx, seed, 5, ['subcategory']) : []), [idx, seed])
  const similar = useMemo(() => (idx && seed ? similarProducts(idx, seed, 5) : []), [idx, seed])
  const pairs = useMemo(() => (idx ? topPairs(idx, 8) : []), [idx])
  const affinity = useMemo(() => (ds?.capabilities.orders ? subcategoryAffinity(rows, 7) : []), [rows, ds])
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
          notes: [sampleId === 'superstore' ? 'These are ideas to browse, not predictions: on later orders in this sample, none beat plain best sellers.' : 'Lists come from shared orders and similar wording, not from a trained model.'],
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
        <div className="finder">
          <label className="select-wrap">
            <span>Look up any product</span>
            <input className="field" list="product-list" value={query} placeholder={cat || sub ? `Type a name, ${plural(pool.length, 'product')} in ${sub || cat}` : 'Type a product name'} onChange={(e) => setQuery(e.target.value)} />
            <datalist id="product-list">
              {[...byName.keys()].slice(0, 3000).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          {cats.length > 0 && (
            <div className="finder-filters">
              <div className="finder-cats" role="group" aria-label="Narrow by category">
                {['', ...cats].map((c) => (
                  <button
                    key={c || 'all'}
                    type="button"
                    className={`chip ${cat === c ? 'on' : ''}`}
                    aria-pressed={cat === c}
                    onClick={() => {
                      setCat(c)
                      setSub('')
                      setQuery('')
                    }}
                  >
                    {c || 'All categories'}
                  </button>
                ))}
              </div>
              {subs.length > 1 && (
                <select
                  className="field field-sm"
                  aria-label="Narrow by sub-category"
                  value={sub}
                  onChange={(e) => {
                    setSub(e.target.value)
                    setQuery('')
                  }}
                >
                  <option value="">Any sub-category</option>
                  {subs.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
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

      <Details label="Show what sells together">
        <Panel title="What sells together" className="panel-together">
          {affinity.length > 0 ? (
            <div className="together">
              <PairWeb pairs={affinity} active={hoverPair} onHover={setHoverPair} label="Sub-categories joined by how often they share an order" />
              <div className="together-list">
                <div className="link-row link-head" aria-hidden>
                  <span>Sub-categories bought in the same order</span>
                  <span>vs chance</span>
                </div>
                <ol className="links">
                  {affinity.map((p, i) => (
                    <li key={`${p.a}${p.b}`} className={`link-row ${hoverPair === i ? 'on' : ''}`} onPointerEnter={() => setHoverPair(i)} onPointerLeave={() => setHoverPair(null)}>
                      <span className="link-pair">
                        <span className="link-pill">{p.a}</span>
                        <span className="link-wire" aria-hidden>
                          <em>{plural(p.together, 'order')}</em>
                        </span>
                        <span className="link-pill">{p.b}</span>
                      </span>
                      <b className="link-lift" title="How many times more often they share an order than if people bought them independently">{p.lift.toFixed(1)}×</b>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <p className="quiet">No two sub-categories in this view share orders more often than chance would suggest. Widen the period or clear filters to find pairs.</p>
          )}

          {pairs.length > 0 && (
            <div className="together-items">
              <div className="link-row link-head" aria-hidden>
                <span>Single items bought together more than once</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv('item-pairs', topPairs(idx, 10_000).map((p) => ({ item_a: idx.products.get(p.a)!.name, item_b: idx.products.get(p.b)!.name, orders_together: p.together, lift: p.lift.toFixed(2) })))}>
                  Download CSV
                </button>
              </div>
              <ol className="links">
                {pairs.map((p) => (
                  <li key={`${p.a}${p.b}`} className="link-row">
                    <span className="link-pair">
                      <span className="link-pill">{shorten(idx.products.get(p.a)!.name, 34)}</span>
                      <span className="link-wire" aria-hidden>
                        <em>{plural(p.together, 'order')}</em>
                      </span>
                      <span className="link-pill">{shorten(idx.products.get(p.b)!.name, 34)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <footer className="together-foot">
            {pairs.length === 0 && <p className="fine">No two single items appear together in more than one order here, so pairs are shown by sub-category.</p>}
            {sampleId === 'superstore' ? (
              <p className="fine">
                How well this works here: on later orders, bought-together guessed another item in the basket {evalProducts['together+popular'].hit_rate_at_5_pct}% of the time, against {evalProducts.popular.hit_rate_at_5_pct}% for plain best sellers. Baskets rarely repeat in this store, so use pairs as ideas to browse, not predictions.
              </p>
            ) : (
              <p className="fine">2× means two sub-categories land in the same order twice as often as they would if people picked them independently.</p>
            )}
          </footer>
        </Panel>
      </Details>
    </div>
  )
}
