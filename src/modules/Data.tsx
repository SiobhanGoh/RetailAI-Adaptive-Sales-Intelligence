import { useEffect, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Details, Fig, Headline, Panel, Segmented, openDetails } from '../ui/primitives'
import { KIND_LABEL, SAMPLES } from '../samples'
import { ROLE_LABEL, ROLE_ORDER } from '../engine/mapping'
import type { DateConvention, Mapping, Role } from '../engine/types'
import { CURRENCIES, fmtDay, money, plural, type Currency } from '../format'
import evaluation from '../../verification/web_evaluation.json'

const KEY_ROLES: Role[] = ['orderDate', 'revenue', 'unitPrice', 'quantity', 'productName', 'productId', 'customerId', 'category', 'region']

const CONF_LABEL = { exact: 'Matched', likely: 'Likely', guess: 'Best guess' } as const

export function Data({ onOpen }: { onOpen: () => void }) {
  const { ds, source, remap, currency, setCurrency, loadBundled, sampleId, setModule } = useApp()
  const sample = SAMPLES.find((s) => s.id === sampleId)
  const [draft, setDraft] = useState<Mapping>({})
  useEffect(() => setDraft(ds?.mapping ?? {}), [ds])
  const changed = ds ? ROLE_ORDER.some((r) => (draft[r] ?? '') !== (ds.mapping[r] ?? '')) : false

  usePrint(
    ds
      ? {
          title: 'Data check',
          lines: [
            { label: 'Dates read as', value: ds.options.dateConvention === 'dmy' ? 'day/month/year' : 'month/day/year' },
            { label: 'Revenue from', value: ds.revenueSource === 'revenue' ? (ds.mapping.revenue ?? '') : ds.revenueSource },
          ],
          notes: ['Nothing leaves this browser tab.'],
        }
      : null,
    `data|${ds?.rows.length}|${ds?.quality.length}|${JSON.stringify(ds?.mapping)}|${ds?.options.dateConvention}|${ds?.options.dropExactDuplicates}`,
  )

  if (!ds) return null
  const used = new Set(Object.values(draft))
  const warnings = ds.quality.filter((q) => q.level !== 'info').length
  const hint = ds.dateHint === 'dmy' ? 'The dates can only be day/month/year.' : ds.dateHint === 'mdy' ? 'The dates can only be month/day/year.' : ds.dateHint === 'iso' ? 'Dates are year-month-day, which reads the same either way.' : 'Dates like 08/11 could be either. Check a date you know.'

  return (
    <div className="mod mod-data">
      <header className="mod-head">
        <Headline k={`${ds.rows.length}|${Object.keys(ds.mapping).length}`}>
          <p className="hl-line">
            <Fig value={Object.keys(ds.mapping).length} format={(v) => String(Math.round(v))} /> of {ds.columns.length} columns understood, <Fig value={ds.rows.length} format={(v) => Math.round(v).toLocaleString('en')} /> rows ready.
          </p>
          <p className="hl-line hl-sub">
            {warnings ? `${plural(warnings, 'thing')} to check below. ` : 'Nothing needs fixing. '}
            Your file is read in this browser tab and never uploaded anywhere.
          </p>
        </Headline>
        <div className="row-actions">
          <button type="button" className="btn btn-sticker" onClick={onOpen}>Open a file</button>
          {!source?.bundled && (
            <button type="button" className="btn btn-ghost" onClick={loadBundled}>Back to a sample store</button>
          )}
        </div>
      </header>

      {/* How the file became numbers, as four connected steps. */}
      <ol className="flow" aria-label="How your file was read">
        <li className="flow-step">
          <span className="flow-dot" aria-hidden>1</span>
          <h3>Your file</h3>
          <p className="flow-big flow-name">{ds.name}</p>
          <p className="quiet">
            {plural(ds.rawRowCount, 'row')} and {plural(ds.columns.length, 'column')} read
          </p>
          {sample ? (
            <>
              <p className="flow-note">
                <span className={`kind kind-${sample.kind}`}>{KIND_LABEL[sample.kind]}</span> {sample.shows}
              </p>
              <p className="fine">
                {sample.credit.text}{' '}
                {sample.credit.href && (
                  <a href={sample.credit.href} target="_blank" rel="noreferrer">Source</a>
                )}
                {sample.credit.licence && (
                  <>
                    {' '}Licence:{' '}
                    <a href={sample.credit.licenceHref} target="_blank" rel="noreferrer">{sample.credit.licence}</a>.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="flow-note">Read in this browser tab only. Nothing is uploaded.</p>
          )}
        </li>

        <li className="flow-step">
          <span className="flow-dot" aria-hidden>2</span>
          <h3>Columns understood</h3>
          <p className="flow-big">
            {Object.keys(ds.mapping).length} <small>of {ds.columns.length}</small>
          </p>
          <span className="flow-bar" aria-hidden>
            <i style={{ width: `${(Object.keys(ds.mapping).length / Math.max(1, ds.columns.length)) * 100}%` }} />
          </span>
          <ul className="flow-maps">
            {KEY_ROLES.filter((r) => ds.mapping[r]).slice(0, 5).map((r) => (
              <li key={r}>
                <span>{ROLE_LABEL[r]}</span>
                <svg viewBox="0 0 16 8" width="16" height="8" aria-hidden>
                  <path d="M15 4H1m3-3L1 4l3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <b>{ds.mapping[r]}</b>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetails('columns')}>Check the matching</button>
        </li>

        <li className="flow-step">
          <span className="flow-dot" aria-hidden>3</span>
          <h3>Checks</h3>
          <p className="flow-big">
            {warnings ? (
              <>
                {warnings} <small>{warnings === 1 ? 'thing to check' : 'things to check'}</small>
              </>
            ) : (
              <>
                All clear
              </>
            )}
          </p>
          <ul className="flow-checks">
            {ds.quality.length ? (
              ds.quality.slice(0, 4).map((q) => (
                <li key={q.text} className={`check-${q.level}`}>
                  <span className="check-mark" aria-hidden>{q.level === 'info' ? '✓' : '!'}</span>
                  <span>
                    {q.text}
                    {q.count ? <b> {q.count.toLocaleString('en')}</b> : null}
                  </span>
                </li>
              ))
            ) : (
              <li className="check-info">
                <span className="check-mark" aria-hidden>✓</span>
                <span>No blank dates, unreadable amounts or duplicate rows found.</span>
              </li>
            )}
          </ul>
        </li>

        <li className="flow-step flow-ready">
          <span className="flow-dot" aria-hidden>4</span>
          <h3>Ready</h3>
          <p className="flow-big">
            {ds.rows.length.toLocaleString('en')} <small>rows</small>
          </p>
          <dl className="flow-facts">
            {ds.capabilities.dates && (
              <div>
                <dt>From</dt>
                <dd>{fmtDay(ds.minDay)} to {fmtDay(ds.maxDay)}</dd>
              </div>
            )}
            <div>
              <dt>Dates</dt>
              <dd>{ds.options.dateConvention === 'dmy' ? 'day/month/year' : 'month/day/year'}</dd>
            </div>
            <div>
              <dt>Revenue</dt>
              <dd>{ds.revenueSource === 'revenue' ? `from ${ds.mapping.revenue}` : `price × quantity`}</dd>
            </div>
          </dl>
          <div className="flow-actions">
            <button type="button" className="btn btn-sticker btn-sm" onClick={() => setModule('overview')}>See the overview</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDetails('rows')}>See the cleaned rows</button>
          </div>
        </li>
      </ol>

      <Details label="Show and fix the column matching" title="Column matching" icon="columns" openKey="columns" inline={!source?.bundled} defaultOpen={!source?.bundled}>
        <div className="data-layout">
        <Panel title="What each column means" className="panel-map">
          <p className="quiet">Columns are matched by whole words and then checked against their values. Change any match and apply.</p>
          <div className="maptable" role="table" aria-label="Column mapping">
            {ROLE_ORDER.map((role: Role) => {
              const conf = ds.detection.confidence[role]
              const mine = (draft[role] ?? '') !== (ds.detection.mapping[role] ?? '')
              return (
                <div role="row" key={role} className="maprow">
                  <span role="rowheader" className="map-role">{ROLE_LABEL[role]}</span>
                  <span role="cell">
                    <select
                      className="field"
                      aria-label={`Column for ${ROLE_LABEL[role]}`}
                      value={draft[role] ?? ''}
                      onChange={(e) => {
                        const next = { ...draft }
                        if (e.target.value) next[role] = e.target.value
                        else delete next[role]
                        setDraft(next)
                      }}
                    >
                      <option value="">Not in this file</option>
                      {ds.columns.map((c) => (
                        <option key={c} value={c} disabled={used.has(c) && draft[role] !== c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span role="cell" className={`map-conf ${mine ? 'mine' : conf ?? 'none'}`}>{mine ? 'Set by you' : conf ? CONF_LABEL[conf] : ''}</span>
                </div>
              )
            })}
          </div>
          {ds.detection.rejected.length > 0 && (
            <ul className="fine-list">
              {ds.detection.rejected.slice(0, 4).map((r) => (
                <li key={r.column + r.role}>
                  Skipped “{r.column}” as {ROLE_LABEL[r.role].toLowerCase()}: {r.reason}.
                </li>
              ))}
            </ul>
          )}
          <div className="row-actions">
            <button type="button" className="btn btn-sticker" disabled={!changed} onClick={() => remap(draft, {})}>Apply mapping</button>
            <button type="button" className="btn btn-ghost" disabled={!changed} onClick={() => setDraft(ds.mapping)}>Undo changes</button>
          </div>
        </Panel>

        <Panel title="How to read it" className="panel-opts">
          <div className="opt">
            <span className="opt-label">Date order</span>
            <Segmented<DateConvention>
              label="Date order"
              value={ds.options.dateConvention}
              onChange={(v) => remap(ds.mapping, { dateConvention: v })}
              options={[
                { id: 'dmy', label: 'Day / month / year' },
                { id: 'mdy', label: 'Month / day / year' },
              ]}
              size="sm"
            />
            <span className="fine">{hint}</span>
          </div>
          <div className="opt">
            <span className="opt-label">Exact duplicate rows</span>
            <Segmented
              label="Exact duplicate rows"
              value={ds.options.dropExactDuplicates ? 'drop' : 'keep'}
              onChange={(v) => remap(ds.mapping, { dropExactDuplicates: v === 'drop' })}
              options={[
                { id: 'keep', label: 'Keep' },
                { id: 'drop', label: 'Remove' },
              ]}
              size="sm"
            />
          </div>
          <label className="opt">
            <span className="opt-label">Currency</span>
            <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        </Panel>

        </div>
      </Details>

      <Details title="Cleaned rows and how numbers are made" icon="rows" openKey="rows">
        <Panel title="First rows after cleaning" className="panel-preview">
          <div className="scroll-x">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Order</th>
                  <th scope="col">Product</th>
                  {ds.capabilities.customers && <th scope="col">Customer</th>}
                  {ds.capabilities.dimensions.slice(0, 2).map((d) => (
                    <th scope="col" key={d}>{d}</th>
                  ))}
                  <th scope="col" className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {ds.rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td>{Number.isFinite(r.day) ? fmtDay(r.day) : '—'}</td>
                    <td>{r.order}</td>
                    <td className="clip">{r.productName}</td>
                    {ds.capabilities.customers && <td>{r.customerName ?? r.customer}</td>}
                    {ds.capabilities.dimensions.slice(0, 2).map((d) => (
                      <td key={d}>{r[d]}</td>
                    ))}
                    <td className="num">{money(r.revenue, currency, 'exact')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="How the numbers are made" className="panel-methods">
          <dl className="methods">
            <div>
              <dt>Comparisons</dt>
              <dd>The previous period is the same number of days just before; last year is the same days 52 weeks earlier, so weekdays line up. A comparison is skipped when the data does not reach that far back.</dd>
            </div>
            <div>
              <dt>Weeks</dt>
              <dd>Weeks end on Sunday. A week the data only partly covers is shown but never used to train or score a forecast.</dd>
            </div>
            <div>
              <dt>Forecast</dt>
              <dd>Four models are replayed from past weeks using only the history available at the time. The lowest-error one is used, and the 80% band comes from its past errors. The TypeScript port reproduces the original Python model's archived error exactly ({evaluation.parity.mae.toLocaleString('en')} MAE).</dd>
            </div>
            <div>
              <dt>Customers</dt>
              <dd>Recency and frequency are ranked into five equal groups within the selected period, then named by simple rules you can read on the Customers screen.</dd>
            </div>
            <div>
              <dt>Products</dt>
              <dd>Bought-together counts come from shared orders. Similar description uses word overlap (TF-IDF). Both were tested against later orders; see verification/web_evaluation.json in the repository.</dd>
            </div>
          </dl>
        </Panel>
      </Details>
    </div>
  )
}
