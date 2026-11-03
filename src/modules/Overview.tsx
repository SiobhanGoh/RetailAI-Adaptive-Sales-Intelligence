import { useMemo } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Delta, Details, Empty, Headline, MiniBars, Panel, Readout, Segmented, SplitBar, Ticket } from '../ui/primitives'
import { Scope } from '../charts/Scope'
import { ShareStack } from '../charts/misc'
import { breakdown, filterRows, pctChange, shareOfTop, weekEnd } from '../engine/aggregate'
import { findAnomalies } from '../engine/anomalies'
import { DIMENSION_LABEL, DIMENSION_PLURAL } from '../engine/types'
import { count, fmtDay, money, pct, plural } from '../format'

export function Overview() {
  const { ds, rows, k, activeComp, compare, setCompare, currency, weeks, filters } = useApp()
  const dims = ds?.capabilities.dimensions ?? []
  const mixDim = dims.includes('category') ? 'category' : dims[0]
  const mix = useMemo(() => (mixDim ? breakdown(rows, mixDim) : []), [rows, mixDim])
  const products = useMemo(() => (ds?.capabilities.products ? breakdown(rows, 'product') : []), [rows, ds])
  const top20 = products.length >= 10 ? shareOfTop(products, 0.2) : undefined
  const anomalies = useMemo(() => (weeks.length > 14 ? findAnomalies(weeks, rows, dims.filter((d) => d === 'category' || d === 'region' || d === 'segment')) : []), [weeks, rows, dims])
  const compareSeries = useMemo(() => {
    if (compare !== 'lastYear' || !ds) return undefined
    const prior = ds.rows.filter((r) => r.day >= filters.from - 364 && r.day <= filters.to - 364)
    const byWeek = new Map<number, number>()
    for (const r of prior) {
      const end = weekEnd(r.day + 364)
      byWeek.set(end, (byWeek.get(end) ?? 0) + r.revenue)
    }
    return weeks.map((w) => ({ end: w.end, y: byWeek.get(w.end) ?? 0 }))
  }, [compare, ds, filters, weeks])

  // What each small ticket shows under its number.
  const figs = useMemo(() => {
    const full = weeks.filter((w) => w.complete)
    // How order values spread: bars up to the 95th percentile, so one huge order doesn't flatten the rest.
    const totals = new Map<string, number>()
    for (const r of rows) if (r.revenue >= 0) totals.set(r.order, (totals.get(r.order) ?? 0) + r.revenue)
    const values = [...totals.values()].sort((x, y) => x - y)
    const BINS = 16
    const cap = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] || 1 : 1
    const spread = new Array<number>(BINS).fill(0)
    for (const v of values) spread[Math.min(BINS - 1, Math.floor((v / cap) * BINS))]++
    return {
      weeklyOrders: full.slice(-26).map((w) => w.orders),
      perWeek: full.length ? full.reduce((a, w) => a + w.orders, 0) / full.length : undefined,
      spread,
      cap,
      median: values.length ? values[Math.floor(values.length / 2)] : undefined,
    }
  }, [weeks, rows])

  // A customer is new when their first purchase in the whole file falls inside this period.
  const firstSeen = useMemo(() => {
    const m = new Map<string, number>()
    if (ds?.capabilities.customers) for (const r of ds.rows) if (r.customer && !(r.day >= (m.get(r.customer) ?? Infinity))) m.set(r.customer, r.day)
    return m
  }, [ds])
  const custSplit = useMemo(() => {
    if (!ds?.capabilities.customers || !ds.capabilities.dates) return null
    const seen = new Set<string>()
    let fresh = 0
    for (const r of rows) {
      if (!r.customer || seen.has(r.customer)) continue
      seen.add(r.customer)
      if ((firstSeen.get(r.customer) ?? -Infinity) >= filters.from) fresh++
    }
    return { fresh, back: seen.size - fresh }
  }, [ds, rows, firstSeen, filters.from])

  // Which group moved the most against the comparison window.
  const mover = useMemo(() => {
    if (!ds || !activeComp?.kpis || !mixDim) return null
    const before = new Map(breakdown(filterRows(ds.rows, { ...filters, from: activeComp.from, to: activeComp.to }), mixDim).map((s) => [s.key, s.net]))
    let best: { key: string; delta: number; pct?: number } | null = null
    for (const s of mix) {
      const b = before.get(s.key) ?? 0
      const d = s.net - b
      if (!best || Math.abs(d) > Math.abs(best.delta)) best = { key: s.key, delta: d, pct: pctChange(s.net, b) }
    }
    return best
  }, [ds, activeComp, mixDim, mix, filters])

  const c = activeComp?.kpis ?? null
  const cl = activeComp?.label ?? 'comparison'
  const netChange = pctChange(k?.net ?? 0, c?.net)
  const latestAnomaly = anomalies[anomalies.length - 1]

  // The receipt carries the notes: things worth knowing that the tickets and chart don't already say.
  const notes: string[] = []
  if (mover && mover.delta !== 0) notes.push(`${mover.key} ${mover.delta > 0 ? 'grew' : 'fell'} the most: ${mover.delta > 0 ? '+' : '−'}${money(Math.abs(mover.delta), currency)} against the ${cl}.`)
  if (latestAnomaly) notes.push(`Unusual week ending ${fmtDay(latestAnomaly.end)}: ${money(latestAnomaly.net, currency)} against a usual ${money(latestAnomaly.baseline, currency)}${latestAnomaly.drivers[0] ? `, mostly ${latestAnomaly.drivers[0].key}` : ''}.`)
  if (top20 !== undefined) notes.push(`The top 20% of products bring ${pct(top20, 0)} of sales, so their stock matters most.`)
  usePrint(
    k && ds
      ? {
          title: 'What stands out',
          lines: [
            ...(k.returns < 0 ? [{ label: 'Returns', value: money(k.returns, currency, 'whole'), tone: 'down' as const }] : []),
            ...(k.margin !== undefined ? [{ label: 'Margin', value: pct(k.margin) }] : []),
            ...(mix[0] ? [{ label: `${mix[0].key.slice(0, 18)} share`, value: pct(mix[0].share, 0) }] : []),
            { label: 'Unusual weeks', value: String(anomalies.length) },
          ],
          notes,
        }
      : null,
    `ov|${k?.net}|${c?.net}|${compare}|${anomalies.length}|${currency}|${mover?.key}`,
  )

  if (!ds || !k) return null
  if (!rows.length) return <Empty title="No rows in this view">Widen the period on the strip at the bottom or clear some filters.</Empty>

  const hasDates = ds.capabilities.dates
  const stub = (now: number, before: number | undefined, was: string | undefined) => (hasDates ? <Delta value={pctChange(now, before)} label={cl} was={was} /> : undefined)
  const showChart = hasDates && weeks.length > 1
  const avgMark = figs.cap ? (k.aov / figs.cap) * figs.spread.length : undefined
  const fourth =
    k.margin !== undefined && k.profit !== undefined ? (
      <Ticket label="Margin" stub={<span className="delta delta-none">{money(k.profit / Math.max(1, k.orders), currency)} profit per order</span>}>
        <Readout value={k.margin} kind="pct" size="md" label={`Margin ${pct(k.margin)}`} />
        <SplitBar parts={[{ value: Math.max(0, k.net - k.profit), tone: 'a' }, { value: Math.max(0, k.profit), tone: 'b' }]} label={`${money(k.profit, currency)} profit from ${money(k.net, currency)} sales`} />
        <span className="ticket-cap">
          <b>{money(k.profit, currency)}</b> kept from {money(k.net, currency)}
        </span>
      </Ticket>
    ) : mix.length > 1 ? (
      <Ticket label="Where sales come from" stub={<span className="delta delta-none">{mix.length} {DIMENSION_PLURAL[mixDim!]}{mix.length > 3 ? ', top 3 shown' : ''}</span>}>
        <ol className="mini-mix">
          {mix.slice(0, 3).map((m) => (
            <li key={m.key}>
              <span>{m.key}</span>
              <b>{pct(m.share, 0)}</b>
              <i style={{ ['--w' as string]: `${(m.share * 100).toFixed(1)}%` }} />
            </li>
          ))}
        </ol>
      </Ticket>
    ) : null

  return (
    <div className="mod mod-overview">
      <header className="mod-head">
        <Headline k={`${k.net}|${filters.from}|${filters.to}|${compare}`}>
          <p className="hl-line">
            {netChange === undefined
              ? `Sales${hasDates ? ` from ${fmtDay(filters.from)} to ${fmtDay(filters.to)}` : ''}.`
              : `Sales are ${netChange >= 0 ? 'up' : 'down'} ${Math.abs(netChange * 100).toFixed(1)}% on the ${cl}.`}
          </p>
          {mix[0] && <p className="hl-line hl-sub">{mix[0].key} brings the most, at {pct(mix[0].share, 0)} of sales.</p>}
        </Headline>
        {hasDates && (
          <Segmented
            label="Compare with"
            value={compare}
            onChange={setCompare}
            options={[
              { id: 'previous', label: 'Previous period' },
              { id: 'lastYear', label: 'Same time last year' },
            ]}
            size="sm"
          />
        )}
      </header>

      {/* The anchor: net sales and its week-by-week line share one smoked-glass window. */}
      <section className={`anchor ${showChart ? '' : 'anchor-solo'}`} aria-label="Net sales">
        <div className="anchor-lead">
          <span className="anchor-label">Net sales</span>
          <Readout value={k.net} currency={currency} size="xl" label={`Net sales ${money(k.net, currency, 'whole')}`} />
          <div className="anchor-foot">
            {hasDates && <Delta value={netChange} label={cl} was={c ? money(c.net, currency) : undefined} />}
            {k.returns < 0 && (
              <span className="anchor-note">
                {money(k.gross, currency)} sold, {money(k.returns, currency)} returned
              </span>
            )}
          </div>
        </div>
        {showChart && (
          <div className="anchor-chart">
            <header className="anchor-chart-head">
              <h3>Week by week</h3>
              <span className="legend-inline">
                <i className="sw sw-line" /> This period
                {compareSeries && (
                  <>
                    <i className="sw sw-compare" /> Last year
                  </>
                )}
                {anomalies.length > 0 && (
                  <>
                    <i className="sw sw-marker" /> Unusual week
                  </>
                )}
              </span>
            </header>
            <Scope
              points={weeks.map((w) => ({ end: w.end, y: w.net, partial: !w.complete }))}
              compare={compareSeries}
              markers={[...anomalies].sort((x, y) => Math.abs(y.z) - Math.abs(x.z)).slice(0, 3).map((a) => ({ end: a.end, kind: a.direction, label: `${a.direction === 'spike' ? 'Spike' : 'Dip'}: ${money(a.net, currency)} vs usual ${money(a.baseline, currency)}` }))}
              currency={currency}
              height={230}
              label="Weekly net sales line chart"
            />
          </div>
        )}
      </section>

      <div className="deck deck-b">
        <Ticket label="Orders" stub={stub(k.orders, c?.orders, c ? count(c.orders) : undefined)}>
          <Readout value={k.orders} kind="count" size="md" label={`${k.orders} orders`} />
          <MiniBars values={figs.weeklyOrders} label="Orders each week, latest week lit" />
          {figs.perWeek !== undefined && (
            <span className="ticket-cap">
              About <b>{count(Math.round(figs.perWeek))}</b> a week
            </span>
          )}
        </Ticket>
        <Ticket label="Average order" stub={stub(k.aov, c?.aov, c ? money(c.aov, currency) : undefined)}>
          <Readout value={k.aov} currency={currency} size="md" label={`Average order ${money(k.aov, currency, 'exact')}`} />
          <MiniBars values={figs.spread} marker={avgMark} label={`How order values spread up to ${money(figs.cap, currency)}; the line marks the average`} />
          {figs.median !== undefined && (
            <span className="ticket-cap">
              Half are under <b>{money(figs.median, currency)}</b>
              {figs.median < k.aov * 0.7 ? '. A few big orders lift the average.' : ''}
            </span>
          )}
        </Ticket>
        {ds.capabilities.customers && (
          <Ticket label="Customers" stub={stub(k.customers, c?.customers, c ? count(c.customers) : undefined)}>
            <Readout value={k.customers} kind="count" size="md" label={`${k.customers} customers`} />
            {custSplit && (
              <>
                <SplitBar parts={[{ value: custSplit.back, tone: 'a' }, { value: custSplit.fresh, tone: 'b' }]} label={`${custSplit.back} returning and ${custSplit.fresh} new customers`} />
                <span className="ticket-cap">
                  <b>{count(custSplit.back)}</b> came back, <b>{count(custSplit.fresh)}</b> new
                </span>
              </>
            )}
          </Ticket>
        )}
        {fourth}
      </div>

      <Details title="Shares and unusual weeks" icon="pie">
        <div className="split split-glass">
          {mix.length > 1 && (
            <Panel glass title={`Share by ${DIMENSION_LABEL[mixDim!].toLowerCase()}`}>
              <ShareStack items={mix} label={`Revenue share by ${DIMENSION_LABEL[mixDim!]}`} />
            </Panel>
          )}
          <Panel title={`All unusual weeks (${anomalies.length})`} className="panel-anoms">
            {anomalies.length ? (
              <ul className="anoms">
                {anomalies.slice(-6).reverse().map((a) => (
                  <li key={a.end} className={`anom anom-${a.direction}`}>
                    <span className="anom-date">{fmtDay(a.end)}</span>
                    <span className="anom-move">
                      {money(a.net, currency)} <small>vs usual {money(a.baseline, currency)}</small>
                    </span>
                    {a.drivers.length > 0 && <span className="anom-drivers">Mostly {a.drivers.map((d) => `${d.key} (${money(d.delta, currency)})`).join(', ')}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet">No week in this view sits far outside the 13 weeks before it.</p>
            )}
            <p className="fine">A week counts as unusual when it is at least 4 robust deviations from the median of the previous 13 full weeks.</p>
          </Panel>
          {top20 !== undefined && (
            <Panel title="How much the top products carry" className="panel-carry">
              <div className="carry">
                <svg className="ring" viewBox="0 0 110 110" role="img" aria-label={`The top 20% of products bring ${pct(top20, 0)} of sales`}>
                  <circle className="ring-bg" cx="55" cy="55" r="44" />
                  <circle className="ring-fg" cx="55" cy="55" r="44" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - top20} />
                  <text x="55" y="62" textAnchor="middle">{pct(top20, 0)}</text>
                </svg>
                <p className="quiet">The top fifth of your {plural(products.length, 'product')} bring {pct(top20, 0)} of sales. Around 80% is typical for retail; much higher means a few items carry the store.</p>
              </div>
            </Panel>
          )}
        </div>
      </Details>
    </div>
  )
}
