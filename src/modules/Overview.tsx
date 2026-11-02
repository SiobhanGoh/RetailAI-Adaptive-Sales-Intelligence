import { useMemo } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Delta, Details, Empty, Fig, Headline, Hint, Panel, Pill, Readout, Segmented, Spark, Ticket } from '../ui/primitives'
import { Scope } from '../charts/Scope'
import { ShareStack } from '../charts/misc'
import { breakdown, filterRows, pctChange, shareOfTop, weekEnd } from '../engine/aggregate'
import { findAnomalies } from '../engine/anomalies'
import { DIMENSION_LABEL } from '../engine/types'
import { count, fmtDay, money, pct, plural, signedPct } from '../format'

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

  // Weekly series for the small trend lines on each ticket.
  const sparks = useMemo(() => {
    const full = weeks.filter((w) => w.complete).slice(-26)
    const customers = new Map<number, Set<string>>()
    for (const r of rows) {
      if (!r.customer) continue
      const e = weekEnd(r.day)
      ;(customers.get(e) ?? customers.set(e, new Set()).get(e)!).add(r.customer)
    }
    return {
      net: full.map((w) => w.net),
      orders: full.map((w) => w.orders),
      aov: full.map((w) => (w.orders ? w.net / w.orders : 0)),
      customers: full.map((w) => customers.get(w.end)?.size ?? 0),
    }
  }, [weeks, rows])

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

  usePrint(
    k && ds
      ? {
          title: 'Period summary',
          lines: [
            { label: 'Net sales', value: money(k.net, currency, 'whole') },
            { label: compare === 'previous' ? 'vs previous' : 'vs last year', value: c ? signedPct(netChange) : 'n/a', tone: (netChange ?? 0) >= 0 ? 'up' : 'down' },
            { label: 'Orders', value: count(k.orders) },
            { label: 'Average order', value: money(k.aov, currency, 'exact') },
            ...(k.returns < 0 ? [{ label: 'Returns', value: money(k.returns, currency, 'whole'), tone: 'down' as const }] : []),
            ...(k.margin !== undefined ? [{ label: 'Margin', value: pct(k.margin) }] : []),
            ...(mix[0] ? [{ label: `${mix[0].key.slice(0, 18)} share`, value: pct(mix[0].share, 0) }] : []),
            ...(top20 !== undefined ? [{ label: 'Top 20% items', value: pct(top20, 0) }] : []),
            { label: 'Unusual weeks', value: String(anomalies.length) },
          ],
          notes: [
            ...(latestAnomaly?.drivers[0] ? [`Latest unusual week (${fmtDay(latestAnomaly.end)}) was led by ${latestAnomaly.drivers[0].key}.`] : []),
            ...(weeks.some((w) => !w.complete) ? ['Weeks cut off by the period edges are drawn as hollow dots and left out of weekly comparisons.'] : []),
          ],
        }
      : null,
    `ov|${k?.net}|${c?.net}|${compare}|${anomalies.length}|${currency}`,
  )

  if (!ds || !k) return null
  if (!rows.length) return <Empty title="No rows in this view">Widen the period on the strip at the bottom or clear some filters.</Empty>

  const hasDates = ds.capabilities.dates
  const stub = (now: number, before: number | undefined) => (hasDates ? <Delta value={pctChange(now, before)} label={cl} /> : undefined)

  return (
    <div className="mod mod-overview">
      <header className="mod-head">
        <Headline k={`${k.net}|${filters.from}|${filters.to}|${compare}`}>
          <p className="hl-line">
            <Fig value={k.net} format={(v) => money(v, currency)} /> from <Fig value={k.orders} format={(v) => count(Math.round(v))} /> orders
            {hasDates ? `, ${fmtDay(filters.from)} to ${fmtDay(filters.to)}` : ''}.
          </p>
          <p className="hl-line hl-sub">
            {netChange !== undefined && <Pill value={netChange} label={cl} />}
            {mix[0] ? <span> {mix[0].key} brings the most, at {pct(mix[0].share, 0)} of sales.</span> : null}
          </p>
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

      <Hint id="period">Drag the amber handles on the strip at the bottom to choose any period. Every screen, ticket and receipt updates to match.</Hint>

      <div className="deck">
        <Ticket hero label="Net sales" stub={stub(k.net, c?.net)}>
          <Readout value={k.net} currency={currency} size="xl" label={`Net sales ${money(k.net, currency, 'whole')}`} />
          <Spark values={sparks.net} label="Weekly net sales, last 26 weeks" />
          {k.returns < 0 && <span className="ticket-foot">{money(k.gross, currency)} gross, {money(k.returns, currency)} returns</span>}
        </Ticket>
        <Ticket label="Orders" stub={stub(k.orders, c?.orders)}>
          <Readout value={k.orders} kind="count" size="md" label={`${k.orders} orders`} />
          <Spark values={sparks.orders} label="Weekly orders, last 26 weeks" />
        </Ticket>
        <Ticket label="Average order" stub={stub(k.aov, c?.aov)}>
          <Readout value={k.aov} currency={currency} size="md" label={`Average order ${money(k.aov, currency, 'exact')}`} />
          <Spark values={sparks.aov} label="Weekly average order, last 26 weeks" />
        </Ticket>
        {ds.capabilities.customers && (
          <Ticket label="Customers" stub={stub(k.customers, c?.customers)}>
            <Readout value={k.customers} kind="count" size="md" label={`${k.customers} customers`} />
            <Spark values={sparks.customers} label="Weekly customers, last 26 weeks" />
          </Ticket>
        )}
        {k.margin !== undefined ? (
          <Ticket label="Margin">
            <Readout value={k.margin} kind="pct" size="md" label={`Margin ${pct(k.margin)}`} />
          </Ticket>
        ) : null}
      </div>

      {hasDates && weeks.length > 1 && (
        <Panel
          glass
          className="panel-scope"
          title="Week by week"
          aside={
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
          }
        >
          <Scope
            points={weeks.map((w) => ({ end: w.end, y: w.net, partial: !w.complete }))}
            compare={compareSeries}
            markers={anomalies.map((a) => ({ end: a.end, kind: a.direction, label: `${a.direction === 'spike' ? 'Spike' : 'Dip'}: ${money(a.net, currency)} vs usual ${money(a.baseline, currency)}` }))}
            currency={currency}
            label="Weekly net sales line chart"
          />
        </Panel>
      )}

      <div className="standouts" aria-label="What stands out">
        {mover && mover.delta !== 0 && (
          <article className="standout">
            <span className="standout-kicker">Biggest change</span>
            <p>
              <b>{mover.key}</b> {mover.delta > 0 ? 'grew' : 'fell'} by {money(Math.abs(mover.delta), currency)}
              {mover.pct !== undefined ? ` (${signedPct(mover.pct)})` : ''} against the {cl}.
            </p>
          </article>
        )}
        {latestAnomaly && (
          <article className="standout">
            <span className="standout-kicker">Unusual week</span>
            <p>
              The week ending <b>{fmtDay(latestAnomaly.end)}</b> sold {money(latestAnomaly.net, currency)}, against a usual {money(latestAnomaly.baseline, currency)}
              {latestAnomaly.drivers[0] ? `, mostly ${latestAnomaly.drivers[0].key}` : ''}.
            </p>
          </article>
        )}
        {top20 !== undefined && (
          <article className="standout">
            <span className="standout-kicker">Few items, most sales</span>
            <p>
              The top 20% of products bring <b>{pct(top20, 0)}</b> of sales, so their stock matters most.
            </p>
          </article>
        )}
      </div>

      <Details>
        <div className="split">
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
            <Panel title="Products in this view">
              <p className="quiet">{plural(products.length, 'product')} sold. Around 80% from the top fifth is typical for retail; much higher means a few items carry the store.</p>
            </Panel>
          )}
        </div>
      </Details>
    </div>
  )
}
