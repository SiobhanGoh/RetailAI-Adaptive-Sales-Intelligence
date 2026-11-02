import { useMemo, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Empty, Panel } from '../ui/primitives'
import { Heat } from '../charts/misc'
import { cohorts, customerStats, quarterLabel, repeatStats, rfGrid, segmentSummary, type SegmentId } from '../engine/customers'
import { buildIndex, suggestForCustomer, REASON_LABEL } from '../engine/recommend'
import { downloadCsv, fmtDay, money, pct, plural } from '../format'
import evaluation from '../../verification/web_evaluation.json'

export function Customers() {
  const { ds, rows, rowsAllDates, filters, currency, source } = useApp()
  const [seg, setSeg] = useState<SegmentId>('at-risk')
  const [who, setWho] = useState('')
  const asOf = (ds?.capabilities.dates ? filters.to : 0) + 1
  const stats = useMemo(() => (ds?.capabilities.customers && ds.capabilities.dates ? customerStats(rows, asOf) : []), [rows, ds, asOf])
  const segments = useMemo(() => segmentSummary(stats), [stats])
  const grid = useMemo(() => rfGrid(stats), [stats])
  const coh = useMemo(() => (stats.length ? cohorts(rowsAllDates.filter((r) => r.day <= filters.to), filters.to) : []), [rowsAllDates, filters.to, stats.length])
  const rep = useMemo(() => repeatStats(stats), [stats])
  const history = useMemo(() => rowsAllDates.filter((r) => r.day <= filters.to), [rowsAllDates, filters.to])
  const idx = useMemo(() => (stats.length ? buildIndex(history) : null), [history, stats.length])
  const picked = segments.find((s) => s.id === seg)!
  const person = stats.find((c) => c.id === who || c.name === who)
  const ideas = useMemo(() => (idx && person ? suggestForCustomer(idx, person.id, 5) : []), [idx, person])

  const champions = segments.find((s) => s.id === 'champions')!
  const atRisk = segments.find((s) => s.id === 'at-risk')!

  usePrint(
    stats.length
      ? {
          title: 'Customer health',
          lines: [
            { label: 'Customers in period', value: String(stats.length) },
            { label: 'Bought more than once', value: pct(rep.repeatShare, 0) },
            ...(rep.medianGapDays !== null ? [{ label: 'Median days between orders', value: rep.medianGapDays.toFixed(0) }] : []),
            { label: 'Champions', value: `${champions.customers}, ${pct(champions.share, 0)} of sales` },
            { label: 'At risk', value: `${atRisk.customers}, ${pct(atRisk.share, 0)} of sales`, tone: atRisk.customers ? 'down' : undefined },
          ],
          notes: [
            `Recency and frequency are scored 1–5 by rank within this period, so the grid always spreads customers across all five levels.`,
            atRisk.customers ? `${atRisk.customers} frequent buyers have gone quiet. ${atRisk.action}` : 'No frequent buyer has gone quiet in this period.',
          ],
        }
      : null,
    `cu|${stats.length}|${filters.from}|${filters.to}|${currency}|${champions.customers}`,
  )

  if (!ds) return null
  if (!ds.capabilities.customers) return <Empty title="Customer views need a customer column">Map a customer ID or name on the Data screen.</Empty>
  if (!ds.capabilities.dates) return <Empty title="Customer views need dates">Recency and retention are measured over time. Map an order date column on the Data screen.</Empty>
  if (stats.length < 5) return <Empty title="Too few customers here">Widen the period or clear some filters to see segments.</Empty>

  const maxQ = Math.max(...coh.map((c) => c.retention.length))
  const quarters = Math.min(8, maxQ)
  const custEval = evaluation.customers as { test: { metrics: Record<string, { hit_rate_at_5_pct: number }> }; chosen_on_validation: string }

  return (
    <div className="mod mod-customers">
      <header className="mod-head">
        <div>
          <h2>Customers</h2>
          <p className="mod-sub">{plural(stats.length, 'customer')} bought in this period, scored as of {fmtDay(asOf - 1)}</p>
        </div>
      </header>

      <div className="cust-layout">
        <Panel title="Who is still buying" className="panel-rf">
          <div className="rf">
            <span className="rf-y">More recent</span>
            <Heat cells={[...grid].reverse()} rows={['5', '4', '3', '2', '1']} cols={['1', '2', '3', '4', '5']} format={(v) => String(v)} label="Customers by recency score (rows) and frequency score (columns)" />
            <span className="rf-x">Order more often</span>
          </div>
        </Panel>

        <Panel title="Segments" className="panel-segs">
          <div className="segs" role="tablist" aria-label="Customer segments">
            {segments.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={s.id === seg} className={`seg seg-${s.id} ${s.id === seg ? 'on' : ''}`} onClick={() => setSeg(s.id)}>
                <span className="seg-name">{s.label}</span>
                <span className="seg-count">{s.customers}</span>
                <span className="seg-share">{pct(s.share, 0)} of sales</span>
              </button>
            ))}
          </div>
          <div className="seg-detail" role="tabpanel">
            <p>
              <strong>{picked.rule}.</strong> {picked.action}
            </p>
            {picked.members.length ? (
              <>
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
                      <th scope="col" className="num">Orders</th>
                      <th scope="col" className="num">Sales</th>
                      <th scope="col" className="num">Last order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picked.members.slice(0, 6).map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button type="button" className="linkish" onClick={() => setWho(c.id)}>{c.name ?? c.id}</button>
                        </td>
                        <td className="num">{c.orders}</td>
                        <td className="num">{money(c.net, currency)}</td>
                        <td className="num">{fmtDay(c.lastDay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv(`customers-${picked.id}`, picked.members.map((c) => ({ customer_id: c.id, name: c.name ?? '', orders: c.orders, net_sales: c.net.toFixed(2), first_order: new Date(c.firstDay * 86_400_000).toISOString().slice(0, 10), last_order: new Date(c.lastDay * 86_400_000).toISOString().slice(0, 10), recency_score: c.r, frequency_score: c.f, monetary_score: c.m })))}>
                  Download all {picked.members.length}
                </button>
              </>
            ) : (
              <p className="quiet">Nobody falls in this segment for the current view.</p>
            )}
          </div>
        </Panel>

        {coh.length > 1 && (
          <Panel title="Return rate by first-purchase quarter" className="panel-cohort">
            <Heat
              cells={coh.slice(-10).map((c) => Array.from({ length: quarters }, (_, k) => (k < c.retention.length ? c.retention[k] : null)))}
              rows={coh.slice(-10).map((c) => `${quarterLabel(c.quarter)} (${c.size})`)}
              cols={Array.from({ length: quarters }, (_, k) => (k === 0 ? 'Start' : `+${k}`))}
              format={(v) => pct(v, 0)}
              max={0.6}
              label="Share of each quarter's new customers who bought again in later quarters"
            />
            <p className="fine">Each row is customers whose first order fell in that quarter, with how many there were. Columns are quarters after their first order. Blank cells are still in the future.</p>
          </Panel>
        )}

        <Panel title="Next purchase ideas" className="panel-next">
          <label className="select-wrap">
            <span>Customer</span>
            <input className="field" list="customer-list" value={who} placeholder="Type a name or ID" onChange={(e) => setWho(e.target.value)} />
            <datalist id="customer-list">
              {stats.slice(0, 2000).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </datalist>
          </label>
          {person ? (
            <>
              <p className="quiet">
                {person.name ?? person.id}: {plural(person.orders, 'order')}, {money(person.net, currency)}, last bought {fmtDay(person.lastDay)}. Segment: {segments.find((s) => s.id === person.segment)!.label}.
              </p>
              <ol className="tags">
                {ideas.map((s) => (
                  <li key={s.product} className="tag">
                    <span className="tag-name">{s.name}</span>
                    <span className="tag-why">{REASON_LABEL[s.reason]}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="quiet">Pick a customer to see items they have not bought yet, starting with best sellers in the sub-categories they buy most.</p>
          )}
          {source?.bundled && (
            <p className="fine">
              Tested on this sample store: these ideas matched a later purchase for {custEval.test.metrics[custEval.chosen_on_validation].hit_rate_at_5_pct}% of customers, below the {custEval.test.metrics.popular.hit_rate_at_5_pct}% for simply showing best sellers. Treat them as conversation starters.
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}
