import { useMemo, useState } from 'react'
import { useApp } from '../state'
import { usePrint } from '../receipt'
import { Details, Empty, Fig, Headline, Hint, Panel, Pill, Segmented, Term } from '../ui/primitives'
import { Scope } from '../charts/Scope'
import { modelWeeks, weeklySeries } from '../engine/aggregate'
import { forecastTrust } from '../explain'
import { MAX_H, MODEL_LABEL, availableModels, backtest, runForecast, type ModelId } from '../engine/forecast'
import { DIMENSION_LABEL, type Dimension } from '../engine/types'
import { downloadCsv, fmtDay, money, pct } from '../format'
import evaluation from '../../verification/web_evaluation.json'

type Horizon = '4' | '8' | '12'

// The receipt names the method in plain words; the details sheet keeps the technical names.
const PLAIN_METHOD: Record<ModelId, string> = { seasonal: 'Same weeks last year', recent: 'Recent average', holtwinters: 'Trend and season', knn: 'Similar past weeks' }

export function Forecast() {
  const { ds, rowsAllDates, filters, currency, sampleId } = useApp()
  const [horizon, setHorizon] = useState<Horizon>('4')
  const [focus, setFocus] = useState<string>('all')
  const H = Number(horizon)
  const dims = (ds?.capabilities.dimensions ?? []).filter((d) => d !== 'city')

  const focusOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [{ id: 'all', label: 'Everything in the current filters' }]
    for (const d of dims.slice(0, 4)) {
      const keys = [...new Set(rowsAllDates.map((r) => r[d]).filter(Boolean) as string[])].sort()
      if (keys.length > 1 && keys.length <= 25) for (const k of keys) out.push({ id: `${d}\u0001${k}`, label: `${DIMENSION_LABEL[d]}: ${k}` })
    }
    return out
  }, [rowsAllDates, dims])

  const seriesRows = useMemo(() => {
    if (focus === 'all') return rowsAllDates
    const [d, k] = focus.split('\u0001') as [Dimension, string]
    return rowsAllDates.filter((r) => r[d] === k)
  }, [rowsAllDates, focus])

  const { history, after } = useMemo(() => {
    if (!ds?.capabilities.dates) return { history: [], after: [] }
    const weeks = weeklySeries(seriesRows, ds.minDay, ds.maxDay)
    // History ends at the last complete week inside the chosen period.
    const hist = modelWeeks(weeks.filter((w) => w.end <= filters.to))
    const later = weeks.filter((w) => w.end > (hist[hist.length - 1]?.end ?? Infinity) && w.complete)
    return { history: hist.map((w) => ({ end: w.end, y: w.net })), after: later.map((w) => ({ end: w.end, y: w.net })) }
  }, [seriesRows, ds, filters.to])

  const bt = useMemo(() => {
    if (history.length < 30) return null
    const models = availableModels(history.length)
    return { key: '', ...backtest(history, models, MAX_H), models }
  }, [history])

  const result = useMemo(() => runForecast(history, H, bt), [history, H, bt])
  const shownHistory = history.slice(-Math.max(52, H * 6))
  const actualAfter = result.ok ? after.slice(0, H) : []

  const chosenScore = result.ok ? result.scores.find((s) => s.model === result.chosen)! : null
  const evalH = H <= 4 ? evaluation.forecast.h4 : evaluation.forecast.h12
  const lateWapes = evalH.late_origin_scores.map((s) => s.wape_pct)
  const spread = Math.max(...lateWapes) - Math.min(...lateWapes)
  const total = result.ok ? result.forecast.reduce((a, p) => a + p.y, 0) : 0
  const lastActual = history.slice(-H).reduce((a, p) => a + p.y, 0)
  const lastYear = history.length >= 52 ? history.slice(history.length - 52, history.length - 52 + H).reduce((a, p) => a + p.y, 0) : null
  const base = lastYear ?? lastActual
  const baseLabel = lastYear !== null ? 'Same weeks last year' : `Previous ${H} weeks`

  usePrint(
    result.ok
      ? {
          title: `${H}-week outlook`,
          lines: [
            { label: baseLabel, value: money(base, currency, 'whole') },
            { label: `Last ${H} weeks`, value: money(lastActual, currency, 'whole') },
            { label: 'Method', value: PLAIN_METHOD[result.chosen] },
          ],
          notes: [
            ...((total - base) / Math.max(1, base) <= -0.1
              ? [`Order less or run a promotion: ${pct(Math.abs((total - base) / Math.max(1, base)), 0)} below the ${baseLabel.toLowerCase()}.`]
              : (total - base) / Math.max(1, base) >= 0.1
                ? [`Stock up: ${pct((total - base) / Math.max(1, base), 0)} above the ${baseLabel.toLowerCase()}.`]
                : [`Keep orders as they are: the outlook is close to the ${baseLabel.toLowerCase()}.`]),
            ...(chosenScore && chosenScore.wape >= 0.35 ? ['Plan for the low end of the range: weeks here swing a lot.'] : []),
            ...(actualAfter.length ? ['Compare with what happened next: your period ends before the data does, and the chart shows it.'] : []),
          ],
        }
      : null,
    `fc|${H}|${focus}|${history.length}|${filters.to}|${currency}|${result.ok ? result.chosen : 'x'}`,
  )

  if (!ds) return null
  if (!ds.capabilities.dates) return <Empty title="Forecasts need dates">Map an order date column on the Data screen to turn this on.</Empty>

  return (
    <div className="mod mod-forecast">
      <header className="mod-head">
        <Headline k={`${H}|${focus}|${total}`}>
          {result.ok ? (
            <>
              <p className="hl-line">
                Next {H} weeks: about <Fig value={total} format={(v) => money(v, currency)} />.
              </p>
              {lastYear !== null && (
                <p className="hl-line hl-sub">
                  <Pill value={(total - base) / Math.max(1, base)} label="the same weeks last year" />
                </p>
              )}
              <p className="hl-line hl-sub">
                <Term tip="8 in 10 past weeks landed inside this range when the same method was replayed on your data. A wider range means less certainty.">Likely range {money(result.forecast.reduce((a, p) => a + p.lo, 0), currency)} to {money(result.forecast.reduce((a, p) => a + p.hi, 0), currency)}</Term> {chosenScore ? forecastTrust(chosenScore.wape) : ''}
              </p>
            </>
          ) : (
            <p className="hl-line">Forecast</p>
          )}
        </Headline>
        <div className="fc-controls">
          <label className="select-wrap">
            <span>Forecast for</span>
            <select className="field" value={focus} onChange={(e) => setFocus(e.target.value)}>
              {focusOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <Segmented<Horizon>
            label="Weeks ahead"
            value={horizon}
            onChange={setHorizon}
            options={[
              { id: '4', label: '4 weeks' },
              { id: '8', label: '8 weeks' },
              { id: '12', label: '12 weeks' },
            ]}
          />
        </div>
      </header>
      <Hint id="forecast-how">Tip: choose 4, 8 or 12 weeks ahead. The shaded band is the likely range, and the dashed line is the forecast.</Hint>

      {!result.ok ? (
        <Empty title="No forecast for this selection">{result.reason}</Empty>
      ) : (
        <>
          <Panel
            glass
            className="panel-scope"
            title="History and outlook"
            aside={
              <span className="legend-inline">
                <i className="sw sw-line" /> Actual
                <i className="sw sw-forecast" /> Forecast
                <i className="sw sw-band" /> Likely range
                {actualAfter.length > 0 && (
                  <>
                    <i className="sw sw-compare" /> What happened next
                  </>
                )}
              </span>
            }
          >
            <Scope points={shownHistory} forecast={result.forecast} compare={actualAfter.length ? [shownHistory[shownHistory.length - 1], ...actualAfter] : undefined} currency={currency} height={300} label={`Weekly sales with a ${H}-week forecast`} />
          </Panel>

          <Details title="How the forecast was made" icon="flask">
          <div className="split split-fc">
            <Panel title="Model replay" className="panel-board">
              <ol className="board" aria-label="Models ranked by backtest error">
                {result.scores.map((s, i) => (
                  <li key={s.model} className={s.model === result.chosen ? 'on' : ''}>
                    <span className="board-pos">{i + 1}</span>
                    <span className="board-name">{MODEL_LABEL[s.model as ModelId]}</span>
                    <span className="board-score">{pct(s.wape)}</span>
                    <span className="board-spark" aria-hidden>
                      {s.byHorizon.map((b) => (
                        <i key={b.h} style={{ height: `${Math.min(100, (b.wape / 0.8) * 100)}%` }} title={`Week ${b.h}: ${pct(b.wape)}`} />
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="fine">Lower is better. WAPE is total absolute error divided by total actual sales, over {H}-week replays from {result.origins} past weeks. The small bars show error growing with the horizon.</p>
            </Panel>

            <Panel
              title="Weekly outlook"
              className="panel-fctable"
              aside={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv('forecast', result.forecast.map((p) => ({ week_ending: new Date(p.end * 86_400_000).toISOString().slice(0, 10), forecast: p.y.toFixed(2), low_80: p.lo.toFixed(2), high_80: p.hi.toFixed(2) })))}>
                  Download CSV
                </button>
              }
            >
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Week ending</th>
                    <th scope="col" className="num">Forecast</th>
                    <th scope="col" className="num">Likely range (8 in 10)</th>
                    {actualAfter.length > 0 && <th scope="col" className="num">Actual</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.forecast.map((p, i) => (
                    <tr key={p.end}>
                      <td>{fmtDay(p.end)}</td>
                      <td className="num">{money(p.y, currency, 'whole')}</td>
                      <td className="num muted">
                        {money(p.lo, currency)} – {money(p.hi, currency)}
                      </td>
                      {actualAfter.length > 0 && <td className="num">{actualAfter[i] ? money(actualAfter[i].y, currency, 'whole') : '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          {sampleId === 'superstore' && focus === 'all' && !Object.values(filters.dims).some((v) => v?.length) && (
            <p className="note">
              Checked on this sample store with the model picked on earlier weeks and scored on later ones: {H <= 4 ? '4' : '12'}-week WAPE was {evalH.chosen_model_late_wape_pct}% and the 80% band held {evalH.band_80_coverage_on_late_origins_pct}% of outcomes, so the band is narrower than it should be. On those later weeks the four models were within {spread.toFixed(1)} points of each other, so no model is clearly better than the simple ones.
            </p>
          )}
          </Details>
        </>
      )}
    </div>
  )
}
