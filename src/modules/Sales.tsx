import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Details, Empty, Fig, Headline, Panel, SaveCsv, Segmented } from '../ui/primitives'
import { Heat, Pareto, ShipBars, TagBars } from '../charts/misc'
import { breakdown, filterRows, paretoCurve, rhythm, shareOfTop, shippingDays } from '../engine/aggregate'
import { DIMENSION_LABEL, DIMENSION_PLURAL, type Dimension } from '../engine/types'
import { downloadCsv, money, pct, shorten } from '../format'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function Sales() {
  const { ds, rows, currency, filters, pickDims } = useApp()
  const dims = ds?.capabilities.dimensions ?? []
  const [dim, setDim] = useState<Dimension | 'product'>(dims.includes('subcategory') ? 'subcategory' : dims[0] ?? 'product')
  const active = dims.includes(dim as Dimension) || dim === 'product' ? dim : dims[0] ?? 'product'
  // The bars for the grouping on screen ignore that grouping's own picks, so every row stays in
  // place and the picked ones are lit, rather than the list collapsing to the one you picked.
  const picked = active === 'product' ? [] : (filters.dims[active as Dimension] ?? [])
  const pool = useMemo(() => {
    if (!ds || !picked.length) return rows
    const dims = { ...filters.dims }
    delete dims[active as Dimension]
    return filterRows(ds.rows, { ...filters, dims })
  }, [ds, rows, filters, active, picked.length])
  const slices = useMemo(() => breakdown(pool, active), [pool, active])
  const products = useMemo(() => (ds?.capabilities.products ? breakdown(rows, 'product') : []), [rows, ds])
  const names = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) if (!m.has(r.product)) m.set(r.product, r.productName)
    return m
  }, [rows])
  const shown = active === 'product' ? slices.map((s) => ({ ...s, key: names.get(s.key) ?? s.key })) : slices
  const grid = useMemo(() => (ds?.capabilities.dates ? rhythm(rows) : null), [rows, ds])
  const ship = useMemo(() => shippingDays(rows), [rows])
  const curve = useMemo(() => paretoCurve(products), [products])
  const top20 = products.length >= 10 ? shareOfTop(products, 0.2) : undefined
  const profitable = ds?.capabilities.profit ? slices.filter((s) => s.profit !== undefined) : []

  const bestCell = useMemo(() => {
    if (!grid) return null
    let best = { w: 0, m: 0, v: -Infinity }
    grid.grid.forEach((row, w) => row.forEach((v, m) => v > best.v && (best = { w, m, v })))
    return best.v > 0 ? best : null
  }, [grid])

  const pickFilter = (key: string) => {
    if (active === 'product') return
    const d = active as Dimension
    const cur = filters.dims[d] ?? []
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    const dims = { ...filters.dims }
    if (next.length) dims[d] = next
    else delete dims[d]
    pickDims(dims)
  }
  const showAll = () => {
    const dims = { ...filters.dims }
    delete dims[active as Dimension]
    pickDims(dims)
  }
  useEffect(() => {
    if (!picked.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[role="dialog"]')) return
      showAll()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const pickedSlices = shown.filter((s) => picked.includes(s.key))
  const pickedShare = pickedSlices.reduce((a, s) => a + s.share, 0)

  usePrint(
    ds
      ? {
          title: 'Sales mix notes',
          lines: [
            ...(top20 !== undefined ? [{ label: 'Top 20% of products', value: pct(top20, 0) }] : []),
            ...(ship ? [{ label: 'Median days to ship', value: String(ship.median) }] : []),
          ],
          notes: [
            ...(shown.length > 1
              ? shown[0].net >= 2 * Math.max(1, shown[shown.length - 1].net)
                ? [`${shown[0].key} sells ${(shown[0].net / Math.max(1, shown[shown.length - 1].net)).toFixed(0)}× as much as ${shown[shown.length - 1].key}.`]
                : [`The ${shown.length} groups are within ${((shown[0].share - shown[shown.length - 1].share) * 100).toFixed(0)} points of each other.`]
              : []),
          ],
        }
      : null,
    `sales|${active}|${shown[0]?.net}|${rows.length}|${currency}`,
  )

  if (!ds) return null
  if (!rows.length) return <Empty title="No rows in this view">Widen the period or clear some filters.</Empty>

  const options = [...dims.map((d) => ({ id: d as Dimension | 'product', label: DIMENSION_LABEL[d] })), ...(ds.capabilities.products ? [{ id: 'product' as const, label: 'Product' }] : [])]

  const unit = active === 'product' ? 'products' : DIMENSION_PLURAL[active as Dimension]
  const lead = shown[0]
  const second = shown[1]
  return (
    <div className="mod mod-sales">
      <header className="mod-head">
        <Headline k={`${active}|${lead?.key}|${rows.length}|${picked.join()}`}>
          {pickedSlices.length === 1 ? (
            <p className="hl-line">
              <b className="fig fig-name">{shorten(pickedSlices[0].key, 40)}</b> brings <Fig value={pickedSlices[0].share} format={(v) => pct(v, 1)} /> of sales{shown.indexOf(pickedSlices[0]) === 0 ? `, the most of ${shown.length}` : `, number ${shown.indexOf(pickedSlices[0]) + 1} of ${shown.length}`}.
            </p>
          ) : pickedSlices.length > 1 ? (
            <p className="hl-line">
              The {pickedSlices.length} you picked bring <Fig value={pickedShare} format={(v) => pct(v, 1)} /> of sales.
            </p>
          ) : lead && (
            <p className="hl-line">
              <Fig value={lead.share} format={(v) => pct(v, 0)} /> of sales came from <b className="fig fig-name">{shorten(lead.key, 56)}</b>.
            </p>
          )}
          <p className="hl-line hl-sub">
            {picked.length ? 'Every screen now shows only this. ' : second ? `${second.key} is next with ${pct(second.share, 0)}. ` : ''}
            {bestCell ? `Sales run highest on ${DAY_NAMES[bestCell.w]}s in ${MONTH_NAMES[bestCell.m]}.` : ''}
          </p>
        </Headline>
        {options.length > 1 && <Segmented label="Group sales by" value={active} onChange={setDim} options={options} size="sm" />}
      </header>

      <Panel
        title={shown.length > 20 ? `Top 20 of ${shown.length.toLocaleString('en')} ${unit}` : `All ${shown.length} ${unit}`}
        aside={
          <span className="row-actions">
            {active !== 'product' &&
              (picked.length ? (
                <span className="pick-chip" role="status">
                  <span>
                    <b>{picked.length === 1 ? shorten(picked[0], 28) : `${picked.length} ${unit}`}</b> only, {pct(pickedShare, 1)} of sales
                  </span>
                  <button type="button" onClick={showAll}>Show all</button>
                  <kbd aria-label="or press Escape">Esc</kbd>
                </span>
              ) : (
                <span className="fine" style={{ margin: 0 }}>Pick a bar to filter every screen</span>
              ))}
            <SaveCsv label={`Save sales by ${unit} as a CSV`} onClick={() => downloadCsv(`sales-by-${active}`, shown.map((s) => ({ [active]: s.key, net_sales: s.net.toFixed(2), share: s.share.toFixed(4), orders: s.orders, ...(s.profit !== undefined ? { profit: s.profit.toFixed(2) } : {}) })))} />
          </span>
        }
      >
        <TagBars items={shown} currency={currency} max={20} onPick={active === 'product' ? undefined : pickFilter} picked={picked} />
      </Panel>

      <Details title="When and how concentrated" icon="calendar">
        <div className="sales-layout">
          {grid && (
            <Panel glass title="Average daily sales by weekday and month" className="panel-rhythm">
              <div className="heat-quiet">
                <Heat
                  cells={grid.grid}
                  rows={DAYS}
                  cols={MONTHS.map((m) => m[0])}
                  format={(v) => money(v, currency)}
                  label="Average daily sales by weekday and month"
                  tip={(i, j, v) => ({ title: `${DAY_NAMES[i]}s in ${MONTH_NAMES[j]}`, value: v === null ? 'No sales on these days yet' : `${money(v, currency)} on an average day` })}
                />
              </div>
              <p className="fine">Brighter means more sales on an average day. Point at a square for the amount.</p>
            </Panel>
          )}
          {curve.length > 10 && (
            <Panel glass title="Sales concentration across products" className="panel-pareto">
              <Pareto curve={curve} count={products.length} label="Cumulative share of sales by ranked products" />
              <p className="fine">The top 20% of products bring {pct(top20, 0)} of sales. The dashed line is what an even spread would look like. Point along the curve to read any share.</p>
            </Panel>
          )}
          {profitable.length > 0 && (
            <Panel title={`Margin by ${DIMENSION_LABEL[active as Dimension]?.toLowerCase() ?? 'group'}`}>
              <ol className="margins">
                {profitable.slice(0, 8).map((s) => {
                  const m = s.net ? s.profit! / s.net : 0
                  return (
                    <li key={s.key} className={m < 0 ? 'neg' : ''}>
                      <span>{s.key}</span>
                      <b>{pct(m)}</b>
                      <small>{money(s.profit!, currency)} profit</small>
                    </li>
                  )
                })}
              </ol>
            </Panel>
          )}
          {ship && (
            <Panel title="How long orders take to ship" className="panel-ship">
              <div className="ship">
                <div className="ship-lead">
                  <p className="big-stat">
                    <b>{ship.median}</b> {ship.median === 1 ? 'day' : 'days'}
                  </p>
                  <p className="quiet">
                    Half of {ship.orders.toLocaleString('en')} orders ship within {ship.median} {ship.median === 1 ? 'day' : 'days'} of being placed, and nine in ten within {ship.p90}.
                  </p>
                </div>
                <ShipBars counts={ship.counts} orders={ship.orders} />
              </div>
            </Panel>
          )}
        </div>
      </Details>
    </div>
  )
}
