import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { createPortal } from 'react-dom'
import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX } from 'd3-shape'
import { MODULES, useApp, type ModuleId } from '../state'
import { KIND_LABEL, SAMPLES } from '../samples'
import { useReceiptContent } from '../receipt'
import { Barcode, reducedMotion, useSize } from './primitives'
import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from '../engine/types'
import { fmtDay, fmtMonth, plural, rangeLabel } from '../format'
import { parseCsvText, tableFromMatrix } from '../engine/load'
import { dayToISO, weekday } from '../engine/values'

// ------------------------------------------------------------------ status chips

export function DisplayBand({ onPickSample }: { onPickSample: () => void }) {
  const { ds, filters, sampleId } = useApp()
  const sample = SAMPLES.find((s) => s.id === sampleId)
  return (
    <div className="band" role="status" aria-live="polite">
      <button type="button" className="band-cell band-store" title="Switch to another sample store" onClick={onPickSample}>
        <i className="lamp" aria-hidden />
        <span className="band-store-name">{ds ? ds.name : 'No data loaded'}</span>
        {sample && <span className={`kind kind-${sample.kind}`}>{KIND_LABEL[sample.kind]}</span>}
        <span className="band-chev" aria-hidden />
      </button>
      <span className="band-cell">{ds?.capabilities.dates ? rangeLabel(filters.from, filters.to) : 'Undated rows'}</span>
    </div>
  )
}

// ------------------------------------------------------------------ ticket rail (screens) and header actions

const press = (el: HTMLElement) => {
  if (reducedMotion()) return
  gsap.fromTo(el, { rotate: -3, y: 4 }, { rotate: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' })
}

export function TicketRail() {
  const { module, setModule, report } = useApp()
  return (
    <nav className="rail" aria-label="Screens">
      <span className="rail-bar" aria-hidden />
      <div className="rail-tickets">
        {MODULES.map((m) => {
          const on = module === m.id && !report
          return (
            <button
              key={m.id}
              type="button"
              className={`order ${on ? 'on' : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={(e) => (press(e.currentTarget), setModule(m.id))}
              title={`${m.hint}. Shortcut: ${m.key}`}
            >
              <span className="order-clip" aria-hidden />
              <span className="order-label">{m.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function useFilterChips() {
  const { ds, filters, pickDims } = useApp()
  const chips = (Object.entries(filters.dims) as [Dimension, string[] | undefined][]).flatMap(([d, vals]) => (vals ?? []).map((v) => ({ d, v })))
  const remove = (d: Dimension, v: string) => {
    const dims = { ...filters.dims }
    const next = (dims[d] ?? []).filter((x) => x !== v)
    if (next.length) dims[d] = next
    else delete dims[d]
    pickDims(dims)
  }
  return { ds, chips, remove, clear: () => pickDims({}) }
}

/** The filter button sits in the tab row right above the receipt, where it is hard to miss. */
export function FilterCard({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { ds, chips } = useFilterChips()
  if (!ds?.capabilities.dimensions.length) return <div className="filtercard filtercard-empty" aria-hidden />
  const names = ds.capabilities.dimensions.slice(0, 2).map((d) => DIMENSION_LABEL[d].toLowerCase())
  return (
    <div className={`filtercard ${chips.length ? 'on' : ''}`}>
      <button type="button" className="filtercard-btn" onClick={open ? onClose : onOpen} aria-expanded={open} aria-haspopup="dialog" title={`Choose ${names.join(', ')} and more. Shortcut: F`}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
          <path d="M3 4.5h14l-5.5 6.5v4.5l-3 1.5v-6z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
        <span>{chips.length ? `Filtered by ${plural(chips.length, 'choice')}` : 'Filter the data'}</span>
        {chips.length ? <b className="filtercard-count">{chips.length}</b> : <kbd aria-hidden>F</kbd>}
      </button>
      {open && <FilterDrop onClose={onClose} />}
    </div>
  )
}

/** Active filters, as chips across the top of the receipt column; each can be removed on the spot. */
export function FilterChips({ onOpen }: { onOpen: () => void }) {
  const { chips, remove, clear } = useFilterChips()
  if (!chips.length) return null
  return (
    <div className="filterchips" role="group" aria-label="Active filters">
      {chips.slice(0, 4).map((c) => (
        <span key={c.d + c.v} className="fchip" title={`${DIMENSION_LABEL[c.d]}: ${c.v}`}>
          <span className="fchip-name">{c.v}</span>
          <button type="button" aria-label={`Remove ${c.v}`} onClick={() => remove(c.d, c.v)}>
            <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>
              <path d="M2.5 2.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      {chips.length > 4 && (
        <button type="button" className="fchip fchip-more" onClick={onOpen}>
          +{chips.length - 4} more
        </button>
      )}
      <button type="button" className="fchip-clear" onClick={clear}>Show all</button>
    </div>
  )
}

export function Utilities({ onUpload }: { onUpload: () => void }) {
  const { setReport, report, theme, setTheme } = useApp()
  return (
    <div className="utils">
      <button type="button" className={`btn btn-metal ${report ? 'on' : ''}`} aria-pressed={report} onClick={() => setReport(!report)} title="Open the printable report. Shortcut: P">
        Report
      </button>
      <button type="button" className="btn btn-amber" onClick={onUpload} title="Open your own CSV or Excel file. Shortcut: U">
        Open a file
      </button>
      <button
        type="button"
        className="btn btn-metal btn-icon"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
          {theme === 'light' ? <path d="M13.5 3.5a7 7 0 1 0 3 9.6A6 6 0 0 1 13.5 3.5Z" fill="currentColor" /> : <circle cx="10" cy="10" r="4.5" fill="currentColor" />}
        </svg>
      </button>
    </div>
  )
}

export function useShortcuts(handlers: { filters: () => void; upload: () => void }) {
  const { setModule, setReport, report } = useApp()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable], dialog[open]')) return
      const m = MODULES.find((x) => x.key === e.key)
      if (m) return setModule(m.id as ModuleId)
      if (e.key === 'f' || e.key === 'F') handlers.filters()
      if (e.key === 'u' || e.key === 'U') handlers.upload()
      if (e.key === 'p' || e.key === 'P') setReport(!report)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setModule, setReport, report, handlers])
}

// ------------------------------------------------------------------ receipt printer

export function ReceiptPrinter() {
  const content = useReceiptContent()
  const { printSeq } = useApp()
  const paper = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)
  const key = content ? `${content.title}|${content.lines.map((l) => l.value).join('|')}|${printSeq}` : ''

  useLayoutEffect(() => {
    const el = paper.current
    if (!el || !content) return
    if (reducedMotion()) return
    setPrinting(true)
    const tl = gsap.timeline({ onComplete: () => setPrinting(false) })
    tl.fromTo(el, { yPercent: -100 }, { yPercent: -18, duration: 0.55, ease: 'steps(9)' }).to(el, { yPercent: 0, duration: 0.45, ease: 'power2.out' })
    return () => {
      tl.kill()
      gsap.set(el, { yPercent: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const stamp = useMemo(() => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), [key])

  return (
    <aside className={`printer ${printing ? 'printing' : ''}`} aria-label="Notes for this screen">
      <div className="printer-slot" aria-hidden>
        <span className="printer-light" />
      </div>
      <div className="printer-feed">
        <div className="paper" ref={paper}>
          {content ? (
            <>
              <p className="paper-store">RetailAI</p>
              <p className="paper-title">{content.title}</p>
              <p className="paper-meta">Printed {stamp}</p>
              <dl className="paper-lines">
                {content.lines.map((l) => (
                  <div key={l.label} className={l.tone ? `tone-${l.tone}` : ''}>
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                  </div>
                ))}
              </dl>
              {content.notes.length > 0 && (
                <ul className="paper-notes">
                  {content.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <p className="paper-foot">Worked out from your rows</p>
              <Barcode seed={key} />
            </>
          ) : (
            <p className="paper-title">Waiting for data</p>
          )}
        </div>
      </div>
    </aside>
  )
}

// ------------------------------------------------------------------ tuning band (date range)

const isoToDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)
const yearStart = (yr: number) => Math.floor(Date.UTC(yr, 0, 1) / 86_400_000)
const yearOf = (d: number) => new Date(d * 86_400_000).getUTCFullYear()

export function TuningBand() {
  const { ds, filters, setFilters, weeksAll } = useApp()
  const [ref, { w }, dialRef] = useSize<HTMLDivElement>()
  const drag = useRef<null | 'from' | 'to' | 'move'>(null)
  const start = useRef({ x: 0, from: 0, to: 0 })
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null)
  const [custom, setCustom] = useState(false)
  // A click on the timeline moves the dates, which is easy to do by accident, so it offers Undo.
  const [undo, setUndo] = useState<{ from: number; to: number; label: string } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), 7000)
    return () => clearTimeout(t)
  }, [undo])
  const width = Math.max(w, 200)
  const H = 64
  const min = ds?.minDay ?? 0
  const max = ds?.maxDay ?? 1
  const x = useMemo(() => scaleLinear().domain([min, max]).range([10, width - 10]).clamp(true), [min, max, width])
  const cur = draft ?? { from: filters.from, to: filters.to }

  const commit = useCallback(
    (from: number, to: number) => {
      setFilters({ ...filters, from: Math.round(Math.max(min, from)), to: Math.round(Math.min(max, to)) })
    },
    [filters, setFilters, min, max],
  )

  if (!ds || !ds.capabilities.dates) return <div className="tuning tuning-off">Add an order date column to choose a period.</div>

  const yMax = Math.max(1, ...weeksAll.map((w) => w.net))
  const y = scaleLinear().domain([Math.min(0, ...weeksAll.map((w) => w.net)), yMax]).range([H - 6, 8])
  const spark = area<{ end: number; net: number }>().x((p) => x(p.end - 3)).y0(H - 6).y1((p) => y(p.net)).curve(curveMonotoneX)

  // Every calendar year the data touches, so a year can be picked with one click.
  const years: { yr: number; from: number; to: number }[] = []
  for (let yr = yearOf(min); yr <= yearOf(max); yr++) years.push({ yr, from: Math.max(min, yearStart(yr)), to: Math.min(max, yearStart(yr + 1) - 1) })

  const toDay = (clientX: number) => {
    const r = (dialRef.current as HTMLDivElement).getBoundingClientRect()
    return x.invert(((clientX - r.left) / r.width) * width)
  }

  const onDown = (which: 'from' | 'to' | 'move') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = which
    start.current = { x: toDay(e.clientX), from: cur.from, to: cur.to }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const d = toDay(e.clientX)
    let { from, to } = start.current
    if (drag.current === 'from') from = Math.min(d, to - 6)
    if (drag.current === 'to') to = Math.max(d, from + 6)
    if (drag.current === 'move') {
      const shift = Math.max(min - from, Math.min(max - to, d - start.current.x))
      from += shift
      to += shift
    }
    setDraft({ from: Math.max(min, from), to: Math.min(max, to) })
  }
  const onUp = () => {
    if (drag.current && draft) commit(draft.from, draft.to)
    drag.current = null
    setDraft(null)
  }
  // Clicking the timeline outside the window moves the window there, keeping its length.
  const onTrack = (e: React.PointerEvent) => {
    if (drag.current) return
    const d = toDay(e.clientX)
    const len = filters.to - filters.from
    let from = d - len / 2
    from = Math.max(min, Math.min(max - len, from))
    setUndo({ from: filters.from, to: filters.to, label: rangeLabel(Math.round(from), Math.round(from + len)) })
    commit(from, from + len)
  }
  const onKey = (which: 'from' | 'to') => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 28 : 7
    let delta = 0
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step
    if (!delta) return
    e.preventDefault()
    if (which === 'from') commit(Math.max(min, Math.min(filters.from + delta, filters.to - 6)), filters.to)
    else commit(filters.from, Math.min(max, Math.max(filters.to + delta, filters.from + 6)))
  }

  // One control for recent periods: "Last [n] weeks", with every week count the data covers.
  const totalWeeks = Math.max(1, Math.floor((max - min + 1) / 7))
  const isAll = filters.from === min && filters.to === max
  const span = filters.to - filters.from + 1
  const lastN = !isAll && filters.to === max && span % 7 === 0 && span / 7 <= totalWeeks ? span / 7 : null
  const isCustom = !isAll && lastN === null

  return (
    <div className="tuning">
      <div className="tuning-presets" role="group" aria-label="Choose a period">
        <label className={`tuning-last ${lastN ? 'on' : ''}`}>
          <span>Last</span>
          <select
            id="period-last-weeks"
            value={lastN ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (n) commit(max - n * 7 + 1, max)
            }}
            aria-label="Number of recent weeks to show"
          >
            <option value="" disabled>
              {' '}
            </option>
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>{lastN === 1 ? 'week' : 'weeks'}</span>
        </label>
        <button type="button" className={isAll ? 'on' : ''} aria-pressed={isAll} onClick={() => commit(min, max)}>
          Everything
        </button>
        <button type="button" className={`tuning-custom ${isCustom ? 'on' : ''}`} aria-expanded={custom} aria-haspopup="dialog" onClick={() => setCustom((v) => !v)}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
            <rect x="1.5" y="3" width="13" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {isCustom ? rangeLabel(filters.from, filters.to) : 'Custom dates'}
        </button>
      </div>
      <div className="tuning-dial" ref={ref} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={onTrack} title="Drag an edge to change the dates, drag the lit window to slide it, or click anywhere on the timeline to move there">
        <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} aria-hidden>
          <path d={spark(weeksAll) ?? ''} className="tuning-spark" />
          {years.slice(1).map((yr) => (
            <line key={yr.yr} x1={x(yr.from)} x2={x(yr.from)} y1={4} y2={H - 4} className="tuning-year" />
          ))}
          <rect x={x(cur.from)} y={2} width={Math.max(2, x(cur.to) - x(cur.from))} height={H - 4} className="tuning-window" />
        </svg>
        {years.map((yr) =>
          x(yr.to) - x(yr.from) > 34 ? (
            <button
              key={yr.yr}
              type="button"
              className={`tuning-yearbtn ${filters.from === yr.from && filters.to === yr.to ? 'on' : ''}`}
              style={{ left: x(yr.from) + 3 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => commit(yr.from, yr.to)}
              title={`Show all of ${yr.yr}`}
            >
              {yr.yr}
            </button>
          ) : null,
        )}
        <div className="tuning-drag" style={{ left: x(cur.from), width: Math.max(2, x(cur.to) - x(cur.from)) }} onPointerDown={onDown('move')} aria-hidden />
        {(['from', 'to'] as const).map((which) => (
          <div
            key={which}
            className={`tuning-handle tuning-${which}`}
            style={{ left: x(cur[which]) }}
            role="slider"
            tabIndex={0}
            aria-label={which === 'from' ? 'Period start' : 'Period end'}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={Math.round(cur[which])}
            aria-valuetext={fmtDay(Math.round(cur[which]))}
            onPointerDown={onDown(which)}
            onKeyDown={onKey(which)}
          >
            <span className="tuning-needle" />
            <span className="tuning-grip" aria-hidden />
            <span className="tuning-cap">{draft ? fmtDay(Math.round(cur[which])) : fmtMonth(Math.round(cur[which]))}</span>
          </div>
        ))}
      </div>
      <span className="tuning-hint" aria-hidden>Drag an edge or the lit window to change the dates</span>
      {undo && (
        <div className="tuning-undo" role="status">
          <span>Moved to {undo.label}.</span>
          <button
            type="button"
            onClick={() => {
              commit(undo.from, undo.to)
              setUndo(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
      {custom && <CustomPeriod min={min} max={max} from={filters.from} to={filters.to} years={years} onApply={(f, t) => { commit(f, t); setCustom(false) }} onClose={() => setCustom(false)} />}
    </div>
  )
}

/** Exact dates, a number of recent weeks, or a whole year. */
function CustomPeriod({ min, max, from, to, years, onApply, onClose }: { min: number; max: number; from: number; to: number; years: { yr: number; from: number; to: number }[]; onApply: (from: number, to: number) => void; onClose: () => void }) {
  const [a, setA] = useState(dayToISO(from))
  const [b, setB] = useState(dayToISO(to))
  const box = useRef<HTMLDivElement>(null)
  const fa = isoToDay(a)
  const fb = isoToDay(b)
  const problem = !Number.isFinite(fa) || !Number.isFinite(fb) ? 'Enter both dates.' : fa > fb ? 'The start date needs to be on or before the end date.' : fa < min || fb > max ? `Your data runs from ${fmtDay(min)} to ${fmtDay(max)}.` : null

  useEffect(() => {
    box.current?.querySelector('input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    const onAway = (e: PointerEvent) => {
      const t = e.target as Element
      if (!box.current?.contains(t) && !t.closest('.tuning-custom')) onClose()
    }
    addEventListener('keydown', onKey)
    addEventListener('pointerdown', onAway)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('pointerdown', onAway)
    }
  }, [onClose])

  return (
    <div className="period-pop" role="dialog" aria-label="Choose dates" ref={box}>
      <form
        className="pp-dates"
        onSubmit={(e) => {
          e.preventDefault()
          if (!problem) onApply(fa, fb)
        }}
      >
        <label>
          <span>From</span>
          <input id="period-from" type="date" className="field" min={dayToISO(min)} max={dayToISO(max)} value={a} onChange={(e) => setA(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input id="period-to" type="date" className="field" min={dayToISO(min)} max={dayToISO(max)} value={b} onChange={(e) => setB(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-sticker btn-sm" disabled={!!problem}>Show these dates</button>
      </form>
      {problem && <p className="pp-problem">{problem}</p>}
      <div className="pp-years" role="group" aria-label="A whole year">
        <span>Or a whole year</span>
        {years.map((yr) => (
          <button key={yr.yr} type="button" className={`pp-year ${from === yr.from && to === yr.to ? 'on' : ''}`} onClick={() => onApply(yr.from, yr.to)}>
            {yr.yr}
          </button>
        ))}
      </div>
      <p className="fine">Your data runs from {fmtDay(min)} to {fmtDay(max)}.</p>
    </div>
  )
}

// ------------------------------------------------------------------ filter sheet

/** Filters open as a liquid-glass dropdown under the filter button (a bottom sheet on phones).
 *  Each group is one line with its picks; open one group at a time to choose. */
export function FilterDrop({ onClose }: { onClose: () => void }) {
  const { ds, filters, pickDims, rowsAllDates } = useApp()
  const box = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const dims = ds?.capabilities.dimensions ?? []
  const firstPicked = dims.find((d) => (filters.dims[d] ?? []).length)
  const [openDim, setOpenDim] = useState<Dimension | null>(firstPicked ?? dims[0] ?? null)

  const options = useMemo(() => {
    const out: Partial<Record<Dimension, { key: string; n: number }[]>> = {}
    if (!ds) return out
    for (const d of ds.capabilities.dimensions) {
      const counts = new Map<string, number>()
      for (const r of ds.rows) {
        const v = r[d]
        if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      out[d] = [...counts.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n)
    }
    return out
  }, [ds])

  const toggle = (d: Dimension, key: string) => {
    const cur = filters.dims[d] ?? []
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    const all = { ...filters.dims }
    if (next.length) all[d] = next
    else delete all[d]
    pickDims(all)
  }

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.querySelector<HTMLElement>('.fd-group-btn')?.focus()
    if (reducedMotion()) return
    const t = gsap.fromTo(el, { opacity: 0, y: -10, scale: 0.96, filter: 'blur(6px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: 'back.out(1.5)', clearProps: 'transform,filter' })
    return () => {
      t.kill()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    const onAway = (e: PointerEvent) => {
      const t = e.target as Element
      if (!box.current?.contains(t) && !t.closest('.filtercard-btn, .fchip-more')) onClose()
    }
    addEventListener('keydown', onKey, true)
    addEventListener('pointerdown', onAway)
    return () => {
      removeEventListener('keydown', onKey, true)
      removeEventListener('pointerdown', onAway)
    }
  }, [onClose])

  const picked = Object.values(filters.dims).reduce((a, v) => a + (v?.length ?? 0), 0)

  // The dropdown lives on the page root, so nothing on the page can sit over it; it is placed
  // right under the filter button and follows it if the window changes size.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const r = document.querySelector('.filtercard-btn')?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 12, right: Math.max(16, window.innerWidth - r.right) })
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [])

  return createPortal(
    <>
      <div className="fd-backdrop" aria-hidden onClick={onClose} />
      <div className="filterdrop" ref={box} role="dialog" aria-label="Filters" style={pos ? ({ '--fd-top': `${pos.top}px`, '--fd-right': `${pos.right}px` } as React.CSSProperties) : undefined}>
        <div className="fd-body">
          {DIMENSIONS.filter((d) => options[d]).map((d) => {
            const all = options[d]!
            const sel = filters.dims[d] ?? []
            const isOpen = openDim === d
            const q = isOpen ? query.toLowerCase() : ''
            const list = all.filter((o) => !q || o.key.toLowerCase().includes(q)).slice(0, q ? 80 : all.length > 30 ? 24 : all.length)
            return (
              <section key={d} className={`fd-group ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="fd-group-btn"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpenDim(isOpen ? null : d)
                    setQuery('')
                  }}
                >
                  <span className="fd-name">{DIMENSION_LABEL[d]}</span>
                  <span className="fd-count">{all.length}</span>
                  <span className="fd-picks">
                    {sel.slice(0, 2).map((s) => (
                      <i key={s}>{s}</i>
                    ))}
                    {sel.length > 2 && <i className="more">+{sel.length - 2}</i>}
                  </span>
                  <span className="fd-chev" aria-hidden />
                </button>
                {isOpen && (
                  <div className="fd-panel">
                    {all.length > 12 && <input className="field" type="search" placeholder={`Find a ${DIMENSION_LABEL[d].toLowerCase()} among ${all.length}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${DIMENSION_LABEL[d]}`} />}
                    <div className="chips">
                      {sel.filter((s) => !list.some((o) => o.key === s)).map((s) => (
                        <button key={s} type="button" className="chip on" aria-pressed onClick={() => toggle(d, s)}>{s}</button>
                      ))}
                      {list.map((o) => (
                        <button key={o.key} type="button" className={`chip ${sel.includes(o.key) ? 'on' : ''}`} aria-pressed={sel.includes(o.key)} onClick={() => toggle(d, o.key)}>
                          {o.key}
                        </button>
                      ))}
                      {!q && all.length > list.length && <span className="chip-more">Search to see all {all.length}</span>}
                      {q && !list.length && <span className="chip-more">Nothing matches “{query}”.</span>}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
        <footer className="fd-foot">
          <p>
            {plural(rowsAllDates.length, 'row')} match{rowsAllDates.length === 1 ? 'es' : ''}, before the date range is applied.
          </p>
          <div className="fd-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => pickDims({})} disabled={!picked}>Clear all</button>
            <button type="button" className="btn btn-sticker btn-sm" onClick={onClose}>Done</button>
          </div>
        </footer>
      </div>
    </>,
    document.body,
  )
}

// ------------------------------------------------------------------ file opening

const MAX_BYTES = 60 * 1024 * 1024

export function useFileOpener() {
  const { loadTable, setLoading, setError } = useApp()
  const input = useRef<HTMLInputElement | null>(null)

  const openFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is ${(file.size / 1048576).toFixed(0)} MB. Files up to 60 MB open smoothly in the browser; filter or split larger exports first.`)
        return
      }
      setLoading(`Reading ${file.name}`)
      try {
        const lower = file.name.toLowerCase()
        let table
        if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) table = parseCsvText(await file.text())
        else if (lower.endsWith('.xlsx')) {
          const { readSheet } = await import('read-excel-file/browser')
          table = tableFromMatrix((await readSheet(file)) as unknown[][])
        } else {
          throw new Error('Open a .csv or .xlsx file. Older .xls workbooks need saving as .xlsx first.')
        }
        if (!table.records.length) throw new Error(`${file.name} has a header but no data rows.`)
        // Let the loading state paint before the synchronous clean-up runs.
        await new Promise((r) => setTimeout(r, 30))
        loadTable(file.name, table.records, table.columns)
      } catch (e) {
        setLoading(null)
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [loadTable, setLoading, setError],
  )

  const pick = useCallback(() => {
    if (!input.current) {
      const el = document.createElement('input')
      el.type = 'file'
      el.accept = '.csv,.tsv,.txt,.xlsx'
      el.onchange = () => el.files?.[0] && openFile(el.files[0])
      input.current = el
    }
    input.current.value = ''
    input.current.click()
  }, [openFile])

  return { pick, openFile }
}

export function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [over, setOver] = useState(false)
  useEffect(() => {
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setOver(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setOver(false)
    }
    const overFn = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setOver(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) onFile(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', overFn)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', overFn)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])
  if (!over) return null
  return (
    <div className="dropzone" aria-hidden>
      <div>
        <strong>Drop to open</strong>
        <span>CSV or Excel. The file stays on this device.</span>
      </div>
    </div>
  )
}

export function weekdayName(day: number) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday(day)]
}

// ------------------------------------------------------------------ sample store picker

export function SamplePicker({ open, onClose, onOpenFile }: { open: boolean; onClose: () => void; onOpenFile: () => void }) {
  const { sampleId, loadSample } = useApp()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={dialog} className="sheet sheet-samples" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()} aria-labelledby="samples-title">
      <div className="sheet-body">
        <header className="sheet-head">
          <h2 id="samples-title">Sample stores</h2>
          <p>Try the app on a ready-made store, or open your own file.</p>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </header>
        <ul className="samples">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`sample ${s.id === sampleId ? 'on' : ''}`}
                aria-pressed={s.id === sampleId}
                onClick={() => {
                  loadSample(s.id)
                  onClose()
                }}
              >
                <span className={`kind kind-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
                <strong>{s.name}</strong>
                <span>{s.blurb}</span>
                <span className="sample-shows">{s.shows}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-amber"
          onClick={() => {
            onClose()
            onOpenFile()
          }}
        >
          Open my own file
        </button>
      </div>
    </dialog>
  )
}
