import { useMemo, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Details, Empty, Fig, Headline, Hint, Panel, Term } from '../ui/primitives'
import { Heat } from '../charts/misc'
import { SearchBox } from '../ui/SearchBox'
import { SEGMENTS, cohorts, customerStats, quarterLabel, repeatStats, rfGrid, segmentSummary, type SegmentId } from '../engine/customers'
import { buildIndex, suggestForCustomer, REASON_LABEL } from '../engine/recommend'
import { count, downloadCsv, fmtDay, money, pct, plural } from '../format'
import { customerStory } from '../explain'
import evaluation from '../../verification/web_evaluation.json'

const SEGMENT_LABELS = SEGMENTS.map((s) => [s.id, s.label] as const)

export function Customers() {
  const { ds, rows, rowsAllDates, filters, currency, sampleId } = useApp()
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
  const person = stats.find((c) => c.id === who || c.name === who) ?? (who ? undefined : picked?.members[0])
  const custItems = useMemo(() => {
    const label = new Map(SEGMENT_LABELS)
    return [...stats].sort((a, b) => b.net - a.net).map((c) => ({ id: c.id, label: c.name ?? c.id, sub: `${label.get(c.segment) ?? ''}${c.name && c.name !== c.id ? `, ${c.id}` : ''}`, meta: money(c.net, currency) }))
  }, [stats, currency])
  const ideas = useMemo(() => (idx && person ? suggestForCustomer(idx, person.id, 5) : []), [idx, person])

  const champions = segments.find((s) => s.id === 'champions')!
  const atRisk = segments.find((s) => s.id === 'at-risk')!
  const story = customerStory({ customers: stats.length, atRiskCustomers: atRisk.customers, atRiskShare: atRisk.share, champions: champions.customers })

  usePrint(
    stats.length
      ? {
          title: 'Customer health',
          lines: [
            ...(rep.medianGapDays !== null ? [{ label: 'Days between orders', value: `${rep.medianGapDays.toFixed(0)} (median)` }] : []),
            { label: 'At-risk share of sales', value: pct(atRisk.share, 0), tone: atRisk.customers ? 'down' : undefined },
          ],
          notes: [atRisk.customers ? atRisk.action : 'No regular buyer has gone quiet in this period.'],
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
        <Headline k={`${stats.length}|${champions.customers}|${atRisk.customers}`}>
          {story === 'at-risk' ? (
            <>
              <p className="hl-line">
                <Fig value={atRisk.customers} format={(v) => count(Math.round(v))} tone="down" /> regular {atRisk.customers === 1 ? 'buyer has' : 'buyers have'} gone quiet.
              </p>
              <p className="hl-line hl-sub">
                They brought {pct(atRisk.share, 0)} of sales. A win-back message now costs less than finding new customers; {champions.customers ? (
                  <>
                    {count(champions.customers)}{' '}
                    <Term tip="Champions bought recently and often. They are your most valuable regulars: thank them, and ask for reviews or referrals.">champions</Term> still bring {pct(champions.share, 0)}.
                  </>
                ) : (
                  'start with the At risk list below.'
                )}
              </p>
            </>
          ) : story === 'champions' ? (
            <>
              <p className="hl-line">
                <Fig value={champions.customers} format={(v) => count(Math.round(v))} />{' '}
                <Term tip="Champions bought recently and often. They are your most valuable regulars: thank them, and ask for reviews or referrals.">champions</Term> bring {pct(champions.share, 0)} of sales.
              </p>
              <p className="hl-line hl-sub">
                {atRisk.customers ? `${plural(atRisk.customers, 'regular buyer')} ${atRisk.customers === 1 ? 'has' : 'have'} gone quiet and ${atRisk.customers === 1 ? 'is' : 'are'} worth a win-back message. ` : ''}
                {pct(rep.repeatShare, 0)} of the {plural(stats.length, 'customer')} in this period bought more than once.
              </p>
            </>
          ) : (
            <>
              <p className="hl-line">Most customers here are new or occasional.</p>
              <p className="hl-line hl-sub">
                {pct(rep.repeatShare, 0)} of the {plural(stats.length, 'customer')} in this period bought more than once, so a reason to come back matters more than loyalty perks.
              </p>
            </>
          )}
        </Headline>
      </header>

      <Hint id="customers-flow">Tip: pick a group of customers, then a person in it, to see what to offer them next.</Hint>

      {/* One flow, left to right: pick a segment, then a customer in it, then see what to offer them. */}
      <div className="seg-strip" role="tablist" aria-label="Customer segments">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === seg}
            className={`seg seg-${s.id} ${s.id === seg ? 'on' : ''}`}
            onClick={() => {
              setSeg(s.id)
              setWho('')
            }}
          >
            <span className="seg-name">{s.label}</span>
            <span className="seg-count">{count(s.customers)}</span>
            <span className="seg-share">{pct(s.share, 0)} of sales</span>
            <span className="seg-bar" aria-hidden>
              <i style={{ width: `${Math.min(100, s.share * 100)}%` }} />
            </span>
          </button>
        ))}
      </div>

      <section className="cust-flow" role="tabpanel" aria-label={`${picked.label} customers and what to offer them`}>
        <div className="cust-pane">
          <header className="cust-pane-head">
            <h3>{picked.label}</h3>
            <p className="quiet">
              {picked.rule}. {picked.action}
            </p>
          </header>
          <div className="cust-find">
            <SearchBox
              items={custItems}
              onPick={setWho}
              label="Find any customer"
              placeholder={`Find any of ${plural(stats.length, 'customer')} by name or ID`}
              idleTitle="Biggest customers in this period"
              emptyHint="No customer name or ID matches. Try fewer letters."
            />
          </div>
          {picked.members.length ? (
            <>
              <div className="who-list" role="list">
                <div className="who-row who-head" aria-hidden>
                  <span className="who-name">Customer</span>
                  <span>Orders</span>
                  <span>Sales</span>
                  <span>Last order</span>
                </div>
                {picked.members.slice(0, 8).map((c) => (
                  <button key={c.id} type="button" role="listitem" className={`who-row ${person?.id === c.id ? 'on' : ''}`} aria-current={person?.id === c.id} onClick={() => setWho(c.id)}>
                    <span className="who-name">{c.name ?? c.id}</span>
                    <span>{c.orders}</span>
                    <span>{money(c.net, currency)}</span>
                    <span>{fmtDay(c.lastDay)}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv(`customers-${picked.id}`, picked.members.map((c) => ({ customer_id: c.id, name: c.name ?? '', orders: c.orders, net_sales: c.net.toFixed(2), first_order: new Date(c.firstDay * 86_400_000).toISOString().slice(0, 10), last_order: new Date(c.lastDay * 86_400_000).toISOString().slice(0, 10), recency_score: c.r, frequency_score: c.f, monetary_score: c.m })))}>
                Download all {count(picked.members.length)} {picked.label.toLowerCase()}
              </button>
            </>
          ) : (
            <p className="quiet">Nobody falls in this segment for the current view.</p>
          )}
        </div>

        <div className="cust-pane cust-ideas" aria-live="polite">
          {person ? (
            <>
              <header className="cust-pane-head">
                <h3>What to offer {person.name ?? person.id}</h3>
                <p className="quiet">
                  {plural(person.orders, 'order')}, {money(person.net, currency)} in total, last bought {fmtDay(person.lastDay)}.
                  {person.segment !== seg ? ` In ${segments.find((s) => s.id === person.segment)!.label}.` : ''}
                </p>
              </header>
              <ol className="tags tags-swing" key={person.id}>
                {ideas.map((s, i) => (
                  <li key={s.product} className="tag" style={{ ['--n' as string]: String(i) }}>
                    <span className="tag-name">{s.name}</span>
                    <span className="tag-why">{REASON_LABEL[s.reason]}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="quiet">Pick a customer on the left to see items they have not bought yet, starting with best sellers in the sub-categories they buy most.</p>
          )}
          {sampleId === 'superstore' && (
            <p className="fine">
              Tested on this sample store: these ideas matched a later purchase for {custEval.test.metrics[custEval.chosen_on_validation].hit_rate_at_5_pct}% of customers, below the {custEval.test.metrics.popular.hit_rate_at_5_pct}% for simply showing best sellers. Treat them as conversation starters.
            </p>
          )}
        </div>
      </section>

      <Details title="Recency and retention" icon="users">
        <div className="cust-layout">
        <Panel glass title="Who is still buying" className="panel-rf">
          <div className="rf">
            <span className="rf-y">More recent</span>
            <Heat cells={[...grid].reverse()} rows={['5', '4', '3', '2', '1']} cols={['1', '2', '3', '4', '5']} format={(v) => String(v)} label="Customers by recency score (rows) and frequency score (columns)" />
            <span className="rf-x">Order more often</span>
          </div>
        </Panel>

        {coh.length > 1 && (
          <Panel glass title="Return rate by first-purchase quarter" className="panel-cohort">
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

        </div>
      </Details>
    </div>
  )
}
