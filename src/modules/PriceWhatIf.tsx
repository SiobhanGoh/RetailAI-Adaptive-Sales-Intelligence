import { useEffect, useMemo, useState } from 'react'
import { Panel, Term } from '../ui/primitives'
import { elasticityBy, isEstimate, whatIf, type Elasticity } from '../engine/price'
import { money, plural } from '../format'
import type { Currency } from '../format'
import type { Row } from '../engine/types'
import type { SampleId } from '../samples'
import evaluation from '../../verification/web_evaluation.json'

const pctText = (m: number) => {
  const v = (m - 1) * 100
  const r = Math.round(v)
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)}%`
}
const epsText = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`

/** One small range bar per group: the 95% range of ε on a shared −2.5…0.25 axis (clipped at the ends). */
function RangeBar({ e, active }: { e: Elasticity; active: boolean }) {
  const lo = -2.5
  const hi = 0.25
  const x = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100
  return (
    <svg className={`pw-bar ${active ? 'on' : ''}`} viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden>
      <line x1={x(0)} x2={x(0)} y1="0" y2="12" className="pw-zero" />
      <rect x={x(e.lo)} y="4" width={Math.max(0.8, x(e.hi) - x(e.lo))} height="4" rx="2" className="pw-span" />
      <circle cx={x(e.elasticity)} cy="6" r="3" className="pw-dot" />
    </svg>
  )
}

export function PriceWhatIf({ rows, focus, currency, sampleId, hasQuantity, hasCategory }: { rows: Row[]; focus?: string; currency: Currency; sampleId: SampleId | null; hasQuantity: boolean; hasCategory: boolean }) {
  const all = useMemo(() => (hasQuantity ? elasticityBy(rows, hasCategory ? 'category' : 'all') : []), [rows, hasQuantity, hasCategory])
  const ests = all.filter(isEstimate)
  const [group, setGroup] = useState('')
  const [change, setChange] = useState(-10)
  // Follow the product picked above, when its category has an estimate.
  useEffect(() => {
    if (focus && ests.some((e) => e.group === focus)) setGroup(focus)
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps
  const est = ests.find((e) => e.group === group) ?? ests[0]

  const weekly = useMemo(() => {
    if (!est) return null
    let rev = 0
    let units = 0
    let min = Infinity
    let max = -Infinity
    for (const r of rows) {
      if (hasCategory && (r.category ?? 'Uncategorised') !== est.group) continue
      if (!(r.revenue > 0) || !(r.qty && r.qty > 0)) continue
      rev += r.revenue
      units += r.qty
      if (r.day < min) min = r.day
      if (r.day > max) max = r.day
    }
    const weeks = Math.max(1, (max - min + 1) / 7)
    return { rev: rev / weeks, units: units / weeks }
  }, [rows, est, hasCategory])

  if (!hasQuantity) {
    return (
      <Panel className="pw" title="Price what-if">
        <p className="quiet">This needs a quantity column, so it can see how many units sold at each price. This file only has sales totals.</p>
      </Panel>
    )
  }
  if (!est) {
    const reason = all[0] && !isEstimate(all[0]) ? all[0].reason : 'Not enough lines with a quantity in this view.'
    return (
      <Panel className="pw" title="Price what-if">
        <p className="quiet">{reason} Widen the period or clear filters.</p>
      </Panel>
    )
  }

  const w = whatIf(est, change / 100)
  const unitsDelta = weekly ? weekly.units * (w.units.mid - 1) : 0
  const revDelta = weekly ? weekly.rev * (w.revenue.mid - 1) : 0

  return (
    <Panel className="pw" title="Price what-if" aside={<span className="pw-sub">How units and sales might move if prices change</span>}>
      <div className="pw-grid">
        <div className="pw-desk panel-glass">
          <div className="pw-tag" aria-hidden>
            <span className="pw-tag-hole" />
            <span className="pw-tag-group">{est.group}</span>
            <span className="pw-tag-price">{change === 0 ? 'Usual price' : `${change > 0 ? '+' : '−'}${Math.abs(change)}%`}</span>
          </div>
          <label className="pw-slider">
            <span>Price change</span>
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={change}
              onChange={(e) => setChange(+e.target.value)}
              aria-valuetext={`${change > 0 ? 'plus' : change < 0 ? 'minus' : ''} ${Math.abs(change)} percent`}
            />
            <span className="pw-ticks" aria-hidden>
              <i>−30%</i>
              <i>0</i>
              <i>+30%</i>
            </span>
          </label>
          <div className="pw-out" aria-live="polite">
            <div>
              <span className="pw-k">Units</span>
              <b className="pw-v">{pctText(w.units.mid)}</b>
              <span className="pw-r">likely {pctText(w.units.lo)} to {pctText(w.units.hi)}</span>
            </div>
            <div>
              <span className="pw-k">Sales</span>
              <b className="pw-v">{pctText(w.revenue.mid)}</b>
              <span className="pw-r">likely {pctText(w.revenue.lo)} to {pctText(w.revenue.hi)}</span>
            </div>
          </div>
          {weekly && change !== 0 && sampleId !== 'online-retail' && (
            <p className="pw-week">
              About {Math.abs(Math.round(unitsDelta)).toLocaleString('en')} {unitsDelta >= 0 ? 'more' : 'fewer'} units and {money(Math.abs(revDelta), currency)} {revDelta >= 0 ? 'more' : 'less'} in sales a week, if shoppers react the way they did to past discounts.
            </p>
          )}
          {w.extrapolated && (
            <p className="pw-warn" role="note">
              {change > 0
                ? 'Guesswork: prices in this data were only ever at or below the regular price, so a rise is outside anything seen.'
                : 'Guesswork: this cut is deeper than any discount seen in this data.'}
            </p>
          )}
        </div>

        <div className="pw-list">
          <p className="pw-explain">
            <Term tip="Elasticity: the % change in units for a 1% change in price. −1.5 means a 10% price cut has gone with about 15% more units.">Price sensitivity</Term> by {hasCategory ? 'category' : 'shop'}. Pick one to test it.
          </p>
          <ol className="pw-rows">
            {ests.map((e) => (
              <li key={e.group}>
                <button type="button" className={`pw-row ${e.group === est.group ? 'on' : ''}`} aria-pressed={e.group === est.group} onClick={() => setGroup(e.group)}>
                  <span className="pw-name">{e.group}</span>
                  <RangeBar e={e} active={e.group === est.group} />
                  <span className="pw-eps">{epsText(e.elasticity)}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="fine">
            In {est.group} the sensitivity is {epsText(est.elasticity)} (likely {epsText(est.lo)} to {est.hi > 0 ? `+${est.hi.toFixed(2)}` : epsText(est.hi)}){est.hi > 0 ? ', so it may not react to price at all' : ''}. Learned from {plural(est.lines, 'line')} across {plural(est.products, 'product')}; {Math.round(est.belowUsualShare * 100)}% of them sold below the regular price.
          </p>
          {all.some((e) => !isEstimate(e)) && <p className="fine">Not enough price changes to estimate: {all.filter((e) => !isEstimate(e)).map((e) => e.group).join(', ')}.</p>}
          {sampleId === 'online-retail' ? (
            <p className="fine pw-caution">Read with care: in this wholesale shop, bigger orders get a lower price per unit, so low prices and big quantities go together for a reason that has nothing to do with shoppers reacting to price. The sensitivity here is exaggerated.</p>
          ) : sampleId === 'kedai-amber' ? (
            <p className="fine">Kedai Amber is made up with a known true sensitivity per category, so the estimates can be checked against it: the true value fell inside the likely range for {evaluation.price_elasticity.kedai_amber.inside_range} categories.</p>
          ) : (
            <p className="fine">Learned from the same product selling at different prices, mostly discounts. It assumes those discounts were not timed to busy weeks, and it ignores shoppers stocking up and buying less later.</p>
          )}
        </div>
      </div>
    </Panel>
  )
}
