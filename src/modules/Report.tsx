import { useMemo } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Scope } from '../charts/Scope'
import { breakdown, modelWeeks, pctChange, shareOfTop, weeklySeries } from '../engine/aggregate'
import { runForecast, MODEL_LABEL } from '../engine/forecast'
import { customerStats, segmentSummary } from '../engine/customers'
import { DIMENSION_LABEL } from '../engine/types'
import { count, fmtDay, money, pct, rangeLabel, signedPct } from '../format'

export function Report() {
  const { ds, rows, rowsAllDates, k, comps, filters, currency, weeks, setReport } = useApp()
  const dims = (ds?.capabilities.dimensions ?? []).filter((d) => d !== 'city').slice(0, 3)
  const fc = useMemo(() => {
    if (!ds?.capabilities.dates) return null
    const s = modelWeeks(weeklySeries(rowsAllDates, ds.minDay, ds.maxDay).filter((w) => w.end <= filters.to)).map((w) => ({ end: w.end, y: w.net }))
    return runForecast(s, 4)
  }, [ds, rowsAllDates, filters.to])
  const segs = useMemo(() => (ds?.capabilities.customers && ds.capabilities.dates ? segmentSummary(customerStats(rows, filters.to + 1)) : []), [rows, ds, filters.to])
  const products = useMemo(() => (ds?.capabilities.products ? breakdown(rows, 'product') : []), [rows, ds])
  const names = useMemo(() => new Map(rows.map((r) => [r.product, r.productName])), [rows])
  usePrint(
    k
      ? {
          title: 'Report ready',
          lines: [
            { label: 'Net sales', value: money(k.net, currency, 'whole') },
            { label: 'Sections', value: String(3 + dims.length + (fc?.ok ? 1 : 0) + (segs.length ? 1 : 0)) },
          ],
          notes: ['Use “Save as PDF or print” above. In the print dialog, choose “Save as PDF” as the destination.'],
        }
      : null,
    `rep|${k?.net}|${currency}|${filters.from}|${filters.to}`,
  )
  if (!ds || !k) return null
  const activeFilters = Object.entries(filters.dims).filter(([, v]) => v && v.length)

  return (
    <article className="report">
      <div className="report-tools no-print">
        <button type="button" className="btn btn-sticker" onClick={() => window.print()}>Save as PDF or print</button>
        <button type="button" className="btn btn-ghost" onClick={() => setReport(false)}>Back to the console</button>
        <span className="fine">Your browser's print dialog can save this page as a PDF.</span>
      </div>
      <header className="report-head">
        <p className="report-brand">RetailAI report</p>
        <h1>{ds.name}</h1>
        <p>
          {ds.capabilities.dates ? rangeLabel(filters.from, filters.to) : 'All rows'}
          {activeFilters.length ? `, filtered to ${activeFilters.map(([d, v]) => `${DIMENSION_LABEL[d as keyof typeof DIMENSION_LABEL]}: ${v!.join(', ')}`).join('; ')}` : ''}
        </p>
        <p className="fine">Generated {new Date().toLocaleString('en-GB')} from {count(rows.length)} line items. Every figure is calculated directly from the file with fixed rules.</p>
      </header>

      <section>
        <h2>Headline numbers</h2>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col" className="num">This period</th>
              {comps.map((c) => (
                <th key={c.label} scope="col" className="num">vs {c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ['Net sales', k.net, (x: typeof k) => x.net, (v: number) => money(v, currency, 'whole')],
              ['Orders', k.orders, (x: typeof k) => x.orders, (v: number) => count(v)],
              ['Average order', k.aov, (x: typeof k) => x.aov, (v: number) => money(v, currency, 'exact')],
              ...(ds.capabilities.customers ? [['Customers', k.customers, (x: typeof k) => x.customers, (v: number) => count(v)] as const] : []),
            ] as const).map(([label, v, pick, f]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td className="num">{f(v)}</td>
                {comps.map((c) => (
                  <td key={c.label} className="num">{c.kpis ? signedPct(pctChange(v, pick(c.kpis))) : 'not available'}</td>
                ))}
              </tr>
            ))}
            {k.returns < 0 && (
              <tr>
                <th scope="row">Returns</th>
                <td className="num">{money(k.returns, currency, 'whole')}</td>
                {comps.map((c) => <td key={c.label} />)}
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {weeks.length > 1 && (
        <section className="report-chart">
          <h2>Weekly net sales</h2>
          <Scope points={weeks.map((w) => ({ end: w.end, y: w.net, partial: !w.complete }))} currency={currency} height={220} label="Weekly net sales" />
        </section>
      )}

      <section className="report-cols">
        {dims.map((d) => {
          const b = breakdown(rows, d).slice(0, 6)
          return (
            <div key={d}>
              <h2>By {DIMENSION_LABEL[d].toLowerCase()}</h2>
              <table className="table table-compact">
                <tbody>
                  {b.map((s) => (
                    <tr key={s.key}>
                      <th scope="row">{s.key}</th>
                      <td className="num">{money(s.net, currency)}</td>
                      <td className="num">{pct(s.share, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </section>

      {products.length > 0 && (
        <section>
          <h2>Best-selling products</h2>
          <p>The top 20% of products bring {pct(shareOfTop(products, 0.2), 0)} of net sales.</p>
          <table className="table table-compact">
            <tbody>
              {products.slice(0, 8).map((s, i) => (
                <tr key={s.key}>
                  <td className="num">{i + 1}</td>
                  <th scope="row">{names.get(s.key)}</th>
                  <td className="num">{money(s.net, currency)}</td>
                  <td className="num">{count(s.orders)} orders</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {fc && fc.ok && (
        <section>
          <h2>Four-week outlook</h2>
          <p>
            Model: {MODEL_LABEL[fc.chosen]}. Replayed error (WAPE) {pct(fc.scores[0].wape)} over {fc.origins} past starting weeks. The band shows where 80% of past errors fell.
          </p>
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Week ending</th>
                <th scope="col" className="num">Forecast</th>
                <th scope="col" className="num">80% band</th>
              </tr>
            </thead>
            <tbody>
              {fc.forecast.map((p) => (
                <tr key={p.end}>
                  <td>{fmtDay(p.end)}</td>
                  <td className="num">{money(p.y, currency, 'whole')}</td>
                  <td className="num">
                    {money(p.lo, currency)} – {money(p.hi, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {segs.length > 0 && (
        <section>
          <h2>Customer segments</h2>
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col" className="num">Customers</th>
                <th scope="col" className="num">Share of sales</th>
                <th scope="col">Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {segs.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.label}</th>
                  <td className="num">{s.customers}</td>
                  <td className="num">{pct(s.share, 0)}</td>
                  <td>{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2>Data notes</h2>
        <ul>
          {ds.quality.map((q) => (
            <li key={q.text}>
              {q.text}
              {q.count ? ` (${q.count.toLocaleString('en')})` : ''}
            </li>
          ))}
          <li>Dates were read as {ds.options.dateConvention === 'dmy' ? 'day/month/year' : 'month/day/year'}.</li>
        </ul>
      </section>
    </article>
  )
}
