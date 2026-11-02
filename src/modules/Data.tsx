import { useEffect, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Panel, Segmented } from '../ui/primitives'
import { ROLE_LABEL, ROLE_ORDER } from '../engine/mapping'
import type { DateConvention, Mapping, Role } from '../engine/types'
import { CURRENCIES, fmtDay, money, plural, type Currency } from '../format'
import evaluation from '../../verification/web_evaluation.json'

const CONF_LABEL = { exact: 'Matched', likely: 'Likely', guess: 'Best guess' } as const

export function Data({ onOpen }: { onOpen: () => void }) {
  const { ds, source, remap, currency, setCurrency, loadBundled } = useApp()
  const [draft, setDraft] = useState<Mapping>({})
  useEffect(() => setDraft(ds?.mapping ?? {}), [ds])
  const changed = ds ? ROLE_ORDER.some((r) => (draft[r] ?? '') !== (ds.mapping[r] ?? '')) : false

  usePrint(
    ds
      ? {
          title: 'Data check',
          lines: [
            { label: 'Rows read', value: ds.rawRowCount.toLocaleString('en') },
            { label: 'Rows used', value: ds.rows.length.toLocaleString('en') },
            { label: 'Columns', value: String(ds.columns.length) },
            { label: 'Columns mapped', value: String(Object.keys(ds.mapping).length) },
            { label: 'Dates read as', value: ds.options.dateConvention === 'dmy' ? 'day/month/year' : 'month/day/year' },
            { label: 'Revenue from', value: ds.revenueSource === 'revenue' ? (ds.mapping.revenue ?? '') : ds.revenueSource },
          ],
          notes: ds.quality.length ? ds.quality.map((q) => (q.count ? `${q.text} (${q.count.toLocaleString('en')})` : q.text)) : ['No problems found while reading this file.'],
        }
      : null,
    `data|${ds?.rows.length}|${ds?.quality.length}|${JSON.stringify(ds?.mapping)}|${ds?.options.dateConvention}|${ds?.options.dropExactDuplicates}`,
  )

  if (!ds) return null
  const used = new Set(Object.values(draft))
  const hint = ds.dateHint === 'dmy' ? 'The dates can only be day/month/year.' : ds.dateHint === 'mdy' ? 'The dates can only be month/day/year.' : ds.dateHint === 'iso' ? 'Dates are year-month-day, which reads the same either way.' : 'Dates like 08/11 could be either. Check a date you know.'

  return (
    <div className="mod mod-data">
      <header className="mod-head">
        <div>
          <h2>Data</h2>
          <p className="mod-sub">{source?.name}</p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-sticker" onClick={onOpen}>Open a file</button>
          {!source?.bundled && (
            <button type="button" className="btn btn-ghost" onClick={loadBundled}>Back to the sample store</button>
          )}
        </div>
      </header>

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
          <p className="fine">Your file is read in this browser tab and never uploaded anywhere.</p>
        </Panel>

        <Panel title="What we found" className="panel-quality">
          <ul className="quality">
            <li className="q-info">
              {plural(ds.rows.length, 'row')} used of {ds.rawRowCount.toLocaleString('en')} read
              {ds.capabilities.dates ? `, from ${fmtDay(ds.minDay)} to ${fmtDay(ds.maxDay)}` : ''}.
            </li>
            {ds.quality.map((q) => (
              <li key={q.text} className={`q-${q.level}`}>
                {q.text}
                {q.count ? <b> {q.count.toLocaleString('en')}</b> : null}
              </li>
            ))}
          </ul>
        </Panel>

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
      </div>
    </div>
  )
}
