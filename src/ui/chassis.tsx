import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { scaleLinear } from 'd3-scale'
import { area, curveMonotoneX } from 'd3-shape'
import { MODULES, useApp, type ModuleId } from '../state'
import { useReceiptContent } from '../receipt'
import { Barcode, reducedMotion, useSize } from './primitives'
import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from '../engine/types'
import { fmtDay, fmtMonth, plural, rangeLabel } from '../format'
import { parseCsvText, tableFromMatrix } from '../engine/load'
import { weekday } from '../engine/values'

// ------------------------------------------------------------------ status chips

export function DisplayBand() {
  const { ds, filters, rows } = useApp()
  const active = Object.values(filters.dims).reduce((a, v) => a + (v?.length ?? 0), 0)
  return (
    <div className="band" role="status" aria-live="polite">
      <span className="band-cell band-store" title={ds?.name}>
        <i className="lamp" aria-hidden />
        {ds ? ds.name : 'No data loaded'}
      </span>
      <span className="band-cell">{ds?.capabilities.dates ? rangeLabel(filters.from, filters.to) : 'Undated rows'}</span>
      <span className="band-cell">
        <i className={`lamp ${active ? 'lamp-on' : ''}`} aria-hidden />
        {active ? `${plural(active, 'filter')} on` : 'All segments'}
      </span>
      <span className="band-cell band-count">{plural(rows.length, 'line')}</span>
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
              <span className="order-hint">{m.hint}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function Utilities({ onFilters, onUpload }: { onFilters: () => void; onUpload: () => void }) {
  const { filters, setReport, report, theme, setTheme, ds } = useApp()
  const active = Object.values(filters.dims).reduce((a, v) => a + (v?.length ?? 0), 0)
  return (
    <div className="utils">
      <button type="button" className="btn btn-metal" onClick={onFilters} disabled={!ds?.capabilities.dimensions.length} title="Choose regions, categories and more. Shortcut: F">
        Filters
        {active > 0 && <span className="count">{active}</span>}
      </button>
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
  const { printSeq, ds, rows } = useApp()
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
              <p className="paper-meta">
                {ds?.name}
                <br />
                {plural(rows.length, 'line')}
                <br />
                Printed at {stamp}
              </p>
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
              <p className="paper-foot">Calculated from your rows with fixed rules. No text here is AI-written.</p>
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

export function TuningBand() {
  const { ds, filters, setFilters, weeksAll } = useApp()
  const [ref, { w }, dialRef] = useSize<HTMLDivElement>()
  const drag = useRef<null | 'from' | 'to' | 'move'>(null)
  const start = useRef({ x: 0, from: 0, to: 0 })
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null)
  const width = Math.max(w, 200)
  const H = 64
  const min = ds?.minDay ?? 0
  const max = ds?.maxDay ?? 1
  const x = useMemo(() => scaleLinear().domain([min, max]).range([10, width - 10]).clamp(true), [min, max, width])
  const cur = draft ?? { from: filters.from, to: filters.to }

  const commit = useCallback(
    (from: number, to: number) => {
      setFilters({ ...filters, from: Math.round(from), to: Math.round(to) })
    },
    [filters, setFilters],
  )

  if (!ds || !ds.capabilities.dates) return <div className="tuning tuning-off">Add an order date column to choose a period.</div>

  const yMax = Math.max(1, ...weeksAll.map((w) => w.net))
  const y = scaleLinear().domain([Math.min(0, ...weeksAll.map((w) => w.net)), yMax]).range([H - 6, 8])
  const spark = area<{ end: number; net: number }>().x((p) => x(p.end - 3)).y0(H - 6).y1((p) => y(p.net)).curve(curveMonotoneX)

  const years: number[] = []
  for (let yr = new Date(min * 86_400_000).getUTCFullYear() + 1; yr <= new Date(max * 86_400_000).getUTCFullYear(); yr++) years.push(Math.floor(Date.UTC(yr, 0, 1) / 86_400_000))

  const toDay = (clientX: number) => {
    const r = (dialRef.current as HTMLDivElement).getBoundingClientRect()
    return x.invert(((clientX - r.left) / r.width) * width)
  }

  const onDown = (which: 'from' | 'to' | 'move') => (e: React.PointerEvent) => {
    e.preventDefault()
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

  const lastYear = new Date(max * 86_400_000).getUTCFullYear()
  const presets = [
    { label: 'Last 13 weeks', from: Math.max(min, max - 90), to: max },
    { label: 'Last 52 weeks', from: Math.max(min, max - 363), to: max },
    { label: `${lastYear} so far`, from: Math.max(min, Math.floor(Date.UTC(lastYear, 0, 1) / 86_400_000)), to: max },
    { label: 'Everything', from: min, to: max },
  ]

  return (
    <div className="tuning">
      <div className="tuning-presets" role="group" aria-label="Quick periods">
        {presets.map((p) => (
          <button key={p.label} type="button" className={p.from === filters.from && p.to === filters.to ? 'on' : ''} onClick={() => commit(p.from, p.to)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="tuning-dial" ref={ref} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} aria-hidden>
          <path d={spark(weeksAll) ?? ''} className="tuning-spark" />
          {years.map((d) => (
            <g key={d}>
              <line x1={x(d)} x2={x(d)} y1={4} y2={H - 4} className="tuning-year" />
              <text x={x(d) + 4} y={14} className="tuning-year-label">{new Date(d * 86_400_000).getUTCFullYear()}</text>
            </g>
          ))}
          <rect x={x(cur.from)} y={2} width={Math.max(2, x(cur.to) - x(cur.from))} height={H - 4} className="tuning-window" />
        </svg>
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
            <span className="tuning-cap">{fmtMonth(Math.round(cur[which]))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ filter sheet

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ds, filters, setFilters, resetFilters, rowsAllDates } = useApp()
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState<Partial<Record<Dimension, string>>>({})

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

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
    setFilters({ ...filters, dims: { ...filters.dims, [d]: next } })
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()} aria-labelledby="sheet-title">
      <div className="sheet-body">
        <header className="sheet-head">
          <h2 id="sheet-title">Filters</h2>
          <p>{plural(rowsAllDates.length, 'line')} match outside the date range.</p>
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={resetFilters}>Clear all</button>
            <button type="button" className="btn btn-sticker" onClick={onClose}>Done</button>
          </div>
        </header>
        {DIMENSIONS.filter((d) => options[d]).map((d) => {
          const all = options[d]!
          const q = (query[d] ?? '').toLowerCase()
          const list = all.filter((o) => !q || o.key.toLowerCase().includes(q)).slice(0, q ? 60 : all.length > 30 ? 24 : all.length)
          const sel = filters.dims[d] ?? []
          return (
            <fieldset key={d} className="chipset">
              <legend>
                {DIMENSION_LABEL[d]} <span>{all.length}</span>
              </legend>
              {all.length > 12 && <input className="field" type="search" placeholder={`Find a ${DIMENSION_LABEL[d].toLowerCase()}`} value={query[d] ?? ''} onChange={(e) => setQuery({ ...query, [d]: e.target.value })} aria-label={`Search ${DIMENSION_LABEL[d]}`} />}
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
              </div>
            </fieldset>
          )
        })}
      </div>
    </dialog>
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
