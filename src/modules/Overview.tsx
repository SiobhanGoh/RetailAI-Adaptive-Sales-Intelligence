import { useMemo } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Delta, Empty, Panel, Readout, Segmented, Ticket } from '../ui/primitives'
import { Scope } from '../charts/Scope'
import { ShareStack } from '../charts/misc'
import { breakdown, pctChange, shareOfTop, weekEnd } from '../engine/aggregate'
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

  const c = activeComp?.kpis ?? null
  const cl = activeComp?.label ?? 'comparison'
  const best = weeks.filter((w) => w.complete).sort((a, b) => b.net - a.net)[0]

  usePrint(
    k && ds
      ? {
          title: 'Period summary',
          lines: [
            { label: 'Net sales', value: money(k.net, currency, 'whole') },
            { label: compare === 'previous' ? 'vs previous' : 'vs last year', value: c ? signedPct(pctChange(k.net, c.net)) : 'n/a', tone: (pctChange(k.net, c?.net) ?? 0) >= 0 ? 'up' : 'down' },
            { label: 'Orders', value: count(k.orders) },
            { label: 'Average order', value: money(k.aov, currency, 'exact') },
            ...(k.returns < 0 ? [{ label: 'Returns', value: money(k.returns, currency, 'whole'), tone: 'down' as const }] : []),
            ...(k.margin !== undefined ? [{ label: 'Margin', value: pct(k.margin) }] : []),
            ...(mix[0] ? [{ label: `${mix[0].key.slice(0, 18)} share`, value: pct(mix[0].share, 0) }] : []),
            ...(top20 !== undefined ? [{ label: 'Top 20% items', value: pct(top20, 0) }] : []),
            { label: 'Unusual weeks', value: String(anomalies.length) },
          ],
          notes: [
            ...(best ? [`Best full week ended ${fmtDay(best.end)} at ${money(best.net, currency, 'whole')}.`] : []),
            ...(anomalies[0]?.drivers[0] ? [`Latest unusual week (${fmtDay(anomalies[anomalies.length - 1].end)}) was led by ${anomalies[anomalies.length - 1].drivers[0]?.key ?? 'several segments'}.`] : []),
            ...(weeks.some((w) => !w.complete) ? ['Weeks cut off by the period edges are drawn as hollow dots and left out of weekly comparisons.'] : []),
          ],
        }
      : null,
    `ov|${k?.net}|${c?.net}|${compare}|${anomalies.length}|${currency}`,
  )

  if (!ds || !k) return null
  if (!rows.length) return <Empty title="No rows in this view">Widen the period on the tuning band or clear some filters.</Empty>

  return (
    <div className="mod mod-overview">
      <header className="mod-head">
        <div>
          <h2>Overview</h2>
          <p className="mod-sub">{ds.capabilities.dates ? `${fmtDay(filters.from)} to ${fmtDay(filters.to)}` : 'All rows (no dates in this file)'}</p>
        </div>
        {ds.capabilities.dates && (
          <Segmented
            label="Compare with"
            value={compare}
            onChange={setCompare}
            options={[
              { id: 'previous', label: 'Previous period' },
              { id: 'lastYear', label: 'Same period last year' },
            ]}
          />
        )}
      </header>

      <div className="deck">
        <Ticket hero label="Net sales" stub={ds.capabilities.dates ? <Delta value={pctChange(k.net, c?.net)} label={cl} /> : undefined}>
          <Readout value={k.net} currency={currency} size="xl" label={`Net sales ${money(k.net, currency, 'whole')}`} />
          {k.returns < 0 && <span className="ticket-foot">{money(k.gross, currency)} gross, {money(k.returns, currency)} returns</span>}
        </Ticket>
        <Ticket label="Orders" stub={ds.capabilities.dates ? <Delta value={pctChange(k.orders, c?.orders)} label={cl} /> : undefined}>
          <Readout value={k.orders} kind="count" size="md" label={`${k.orders} orders`} />
        </Ticket>
        <Ticket label="Average order" stub={ds.capabilities.dates ? <Delta value={pctChange(k.aov, c?.aov)} label={cl} /> : undefined}>
          <Readout value={k.aov} currency={currency} size="md" label={`Average order ${money(k.aov, currency, 'exact')}`} />
        </Ticket>
        {ds.capabilities.customers && (
          <Ticket label="Customers" stub={ds.capabilities.dates ? <Delta value={pctChange(k.customers, c?.customers)} label={cl} /> : undefined}>
            <Readout value={k.customers} kind="count" size="md" label={`${k.customers} customers`} />
          </Ticket>
        )}
        {k.margin !== undefined ? (
          <Ticket label="Margin">
            <Readout value={k.margin} kind="pct" size="md" label={`Margin ${pct(k.margin)}`} />
          </Ticket>
        ) : k.units !== undefined ? (
          <Ticket label="Units" stub={ds.capabilities.dates ? <Delta value={pctChange(k.units, c?.units)} label={cl} /> : undefined}>
            <Readout value={k.units} kind="count" size="md" label={`${k.units} units`} />
          </Ticket>
        ) : null}
      </div>

      {ds.capabilities.dates && weeks.length > 1 && (
        <Panel
          glass
          className="panel-scope"
          title="Weekly net sales"
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

      <div className="split">
        {mix.length > 1 && (
          <Panel glass title={`Share by ${DIMENSION_LABEL[mixDim!].toLowerCase()}`}>
            <ShareStack items={mix} label={`Revenue share by ${DIMENSION_LABEL[mixDim!]}`} />
          </Panel>
        )}
        {top20 !== undefined && (
          <Panel title="How concentrated sales are" className="panel-tagcard">
            <div className="pricetag">
              <span className="pricetag-hole" aria-hidden />
              <b>{pct(top20, 0)}</b>
              <span>of net sales come from the top 20% of products ({Math.ceil(products.length * 0.2).toLocaleString('en')} of {plural(products.length, 'product')}).</span>
            </div>
            <p className="fine">Around 80% is typical for retail. Much higher means a few items carry the store, so their stock matters most.</p>
          </Panel>
        )}
        <Panel title="Unusual weeks" className="panel-anoms">
          {anomalies.length ? (
            <ul className="anoms">
              {anomalies.slice(-5).reverse().map((a) => (
                <li key={a.end} className={`anom anom-${a.direction}`}>
                  <span className="anom-date">{fmtDay(a.end)}</span>
                  <span className="anom-move">
                    {money(a.net, currency)} <small>vs usual {money(a.baseline, currency)}</small>
                  </span>
                  {a.drivers.length > 0 && (
                    <span className="anom-drivers">
                      Most of the {a.direction === 'spike' ? 'rise' : 'drop'}: {a.drivers.map((d) => `${d.key} (${money(d.delta, currency)})`).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet">No week in this view sits far outside the 13 weeks before it.</p>
          )}
          <p className="fine">A week is unusual when it is at least 4 robust deviations (median absolute deviation) from the median of the previous 13 full weeks.</p>
        </Panel>
      </div>
    </div>
  )
}
