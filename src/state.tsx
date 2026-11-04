import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Dataset, Mapping, CleanOptions } from './engine/types'
import { buildDataset, type RawRecord } from './engine/clean'
import { parseCsvText } from './engine/load'
import { filterRows, kpis, comparisons, weeklySeries, type Filters, type Kpis, type Comparison, type Week } from './engine/aggregate'
import { guessCurrency, type Currency } from './format'
import { SAMPLES, type Sample, type SampleId } from './samples'
import { decodeView, encodeView } from './share'
import { nameForUrl, readLink } from './live'
import { DIMENSIONS, type Dimension } from './engine/types'

export type ModuleId = 'overview' | 'sales' | 'forecast' | 'customers' | 'products' | 'data'

/** Set by the command palette just before switching screens; the target screen reads and clears it. */
export const jumpBox: { product?: string; customer?: string } = {}

/** The view a shared link asked for, applied once the sample it names has loaded. */
let pendingView = typeof location !== 'undefined' ? decodeView(location.hash) : null

export const MODULES: { id: ModuleId; label: string; key: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', key: '1', hint: 'Headline numbers for the selected period' },
  { id: 'sales', label: 'Sales mix', key: '2', hint: 'Where revenue comes from, and when' },
  { id: 'forecast', label: 'Forecast', key: '3', hint: 'Weekly outlook with error bands' },
  { id: 'customers', label: 'Customers', key: '4', hint: 'Segments, retention and next purchases' },
  { id: 'products', label: 'Products', key: '5', hint: 'Baskets, look-alikes and best sellers' },
  { id: 'data', label: 'Data', key: '6', hint: 'Columns, quality and methods' },
]

export type CompareMode = 'previous' | 'lastYear'

interface Source {
  name: string
  records: RawRecord[]
  columns: string[]
  bundled: boolean
  sample?: SampleId
  /** Set when the data comes from a live link; it is read again on every visit. */
  url?: string
  readAt?: number
}

interface AppState {
  source: Source | null
  ds: Dataset | null
  loading: string | null
  error: string | null
  filters: Filters
  setFilters: (f: Filters) => void
  /** Change the group filters as a step the browser's Back button can undo. */
  pickDims: (dims: Filters['dims']) => void
  resetFilters: () => void
  module: ModuleId
  setModule: (m: ModuleId) => void
  report: boolean
  setReport: (v: boolean) => void
  compare: CompareMode
  setCompare: (c: CompareMode) => void
  currency: Currency
  setCurrency: (c: Currency) => void
  theme: Theme
  setTheme: (t: Theme) => void
  loadTable: (name: string, records: RawRecord[], columns: string[], bundled?: boolean) => void
  loadBundled: () => void
  loadSample: (id: SampleId) => void
  /** Open a Google Sheet published as CSV, or any CSV link the browser may read. */
  /** Resolves to null when the sheet opened, or to the reason it could not. */
  loadUrl: (link: string) => Promise<string | null>
  /** True when the view can be written into a link: sample stores and live links. */
  shareable: boolean
  sampleId: SampleId | null
  remap: (mapping: Mapping, options: Partial<CleanOptions>) => void
  setLoading: (s: string | null) => void
  setError: (s: string | null) => void
  // derived
  rows: Dataset['rows']
  rowsAllDates: Dataset['rows']
  k: Kpis | null
  comps: Comparison[]
  activeComp: Comparison | null
  weeks: Week[]
  weeksAll: Week[]
  printSeq: number
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

export type Theme = 'light' | 'dark'

/** A saved choice wins, then an explicit host setting, then the device's light/dark preference. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('retailai-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage unavailable */
  }
  const host = document.documentElement.dataset.theme
  if (host === 'light' || host === 'dark') return host
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<Source | null>(null)
  const [ds, setDs] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState<string | null>('Loading the sample store')
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersRaw] = useState<Filters>({ from: NaN, to: NaN, dims: {} })
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const [module, setModuleRaw] = useState<ModuleId>('overview')
  const [report, setReport] = useState(false)
  const [compare, setCompare] = useState<CompareMode>('previous')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [theme, setThemeRaw] = useState<Theme>(initialTheme)
  const [printSeq, setPrintSeq] = useState(0)

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t)
    try {
      localStorage.setItem('retailai-theme', t)
    } catch {
      /* storage can be unavailable; the theme still applies for this visit */
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const adopt = useCallback((next: Dataset) => {
    setDs(next)
    // Open on a window that has an earlier window to compare with, so figures have a
    // comparison from the first glance: the latest 52 weeks with two years of data, the latest
    // 13 weeks with half a year, and everything for shorter files.
    const span = Number.isFinite(next.minDay) ? next.maxDay - next.minDay : 0
    const from = span >= 2 * 364 ? next.maxDay - 363 : span >= 182 ? next.maxDay - 90 : next.minDay
    setFiltersRaw({ from, to: next.maxDay, dims: {} })
    setPrintSeq((s) => s + 1)
  }, [])

  const loadTable = useCallback(
    (name: string, records: RawRecord[], columns: string[], bundled = false, sample?: Sample, url?: string) => {
      const next = buildDataset(name, records, columns)
      setSource({ name, records, columns, bundled, sample: sample?.id, url, readAt: url ? Date.now() : undefined })
      const revCol = next.mapping.revenue ?? next.mapping.unitPrice
      const guessed = revCol ? guessCurrency(records.map((r) => r[revCol])) : null
      setCurrency(sample ? sample.currency : guessed ?? 'NONE')
      adopt(next)
      setError(null)
      setLoading(null)
      setReport(false)
      setModuleRaw(bundled || url ? 'overview' : 'data')
      if ((bundled || url) && pendingView) {
        const pv = pendingView
        pendingView = null
        if (pv.from !== undefined && pv.to !== undefined) {
          const from = Math.max(next.minDay, Math.min(pv.from, next.maxDay))
          const to = Math.max(from, Math.min(pv.to, next.maxDay))
          setFiltersRaw((f) => ({ ...f, from, to }))
        }
        if (pv.dims) {
          const dims: Partial<Record<Dimension, string[]>> = {}
          for (const d of DIMENSIONS) if (pv.dims[d]?.length) dims[d] = pv.dims[d]
          if (Object.keys(dims).length) setFiltersRaw((f) => ({ ...f, dims }))
        }
        if (pv.compare === 'lastYear') setCompare('lastYear')
        if (pv.module && MODULES.some((m) => m.id === pv.module)) setModuleRaw(pv.module as ModuleId)
      }
    },
    [adopt],
  )

  const loadSample = useCallback(
    (id: SampleId) => {
      const sample = SAMPLES.find((s) => s.id === id) ?? SAMPLES[0]
      setLoading(`Opening ${sample.name}`)
      try {
        localStorage.setItem('retailai-sample', sample.id)
      } catch {
        /* the choice just isn't remembered */
      }
      fetch(new URL(sample.file, document.baseURI))
        .then((r) => {
          if (!r.ok) throw new Error(`${sample.file} returned ${r.status}`)
          return r.text()
        })
        .then((text) => {
          const t = parseCsvText(text)
          loadTable(sample.name, t.records, t.columns, true, sample)
        })
        .catch((e) => {
          setError(`The ${sample.name} sample could not be loaded: ${e instanceof Error ? e.message : String(e)}`)
          setLoading(null)
        })
    },
    [loadTable],
  )
  const loadBundled = useCallback(() => loadSample('superstore'), [loadSample])

  const hasData = useRef(false)
  hasData.current = !!ds
  const loadUrl = useCallback(
    async (link: string) => {
      setLoading('Reading the linked sheet')
      try {
        const text = await readLink(link)
        const t = parseCsvText(text)
        if (!t.records.length) throw new Error('The sheet has a header row but no data rows yet.')
        loadTable(nameForUrl(link), t.records, t.columns, false, undefined, link)
        try {
          localStorage.setItem('retailai-sample', 'live')
          localStorage.setItem('retailai-live-url', link)
        } catch {
          /* it just won't reopen by itself next time */
        }
        return null
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setLoading(null)
        // With nothing on screen yet, fall back to a sample so the console is never empty.
        if (!hasData.current) loadSample('superstore')
        return msg
      }
    },
    [loadTable, loadSample],
  )

  useEffect(() => {
    let first: SampleId = 'superstore'
    try {
      const saved = localStorage.getItem('retailai-sample') as SampleId | null
      if (saved && SAMPLES.some((s) => s.id === saved)) first = saved
    } catch {
      /* use the default */
    }
    if (pendingView?.sample && SAMPLES.some((s) => s.id === pendingView!.sample)) first = pendingView.sample as SampleId
    // A shared live link, or the live sheet opened last time, is read fresh.
    let live: string | null = pendingView?.src ?? null
    if (!live && !pendingView?.sample) {
      try {
        if (localStorage.getItem('retailai-sample') === 'live') live = localStorage.getItem('retailai-live-url')
      } catch {
        /* no saved link */
      }
    }
    if (live) loadUrl(live)
    else loadSample(first)
  }, [loadSample, loadUrl])

  const remap = useCallback(
    (mapping: Mapping, options: Partial<CleanOptions>) => {
      if (!source || !ds) return
      adopt(buildDataset(source.name, source.records, source.columns, { mapping, options: { ...ds.options, ...options }, detection: ds.detection }))
    },
    [source, ds, adopt],
  )

  const setFilters = useCallback((f: Filters) => {
    setFiltersRaw(f)
    setPrintSeq((s) => s + 1)
  }, [])

  // Picking a bar is a step you can go back from: each pick is a browser history entry, and Back
  // restores the groups that were picked before it. Dates are left as they are.
  const pickDims = useCallback((dims: Filters['dims']) => {
    try {
      if (!history.state?.retailaiDims) history.replaceState({ ...history.state, retailaiDims: filtersRef.current.dims }, '')
      history.pushState({ retailaiDims: dims }, '')
    } catch {
      /* history can be unavailable in some embeds; the pick still applies */
    }
    setFiltersRaw((f) => ({ ...f, dims }))
    setPrintSeq((s) => s + 1)
  }, [])
  useEffect(() => {
    const back = (e: PopStateEvent) => {
      const dims = e.state?.retailaiDims
      if (!dims) return
      setFiltersRaw((f) => ({ ...f, dims }))
      setPrintSeq((s) => s + 1)
    }
    addEventListener('popstate', back)
    return () => removeEventListener('popstate', back)
  }, [])

  // The link always carries the current view of a sample store, so a refresh keeps your place
  // and the address bar is always shareable. Views of uploaded files stay out of the link.
  useEffect(() => {
    if (!ds || !Number.isFinite(filters.from)) return
    if (!source?.bundled && !source?.url) {
      if (location.hash) history.replaceState(history.state, '', location.pathname + location.search)
      return
    }
    const h = encodeView({ sample: source.sample, src: source.url, module, from: filters.from, to: filters.to, dims: filters.dims as Record<string, string[]>, compare })
    history.replaceState(history.state, '', h ? `#${h}` : location.pathname + location.search)
  }, [ds, source, module, filters, compare])

  const resetFilters = useCallback(() => {
    if (ds) setFilters({ from: ds.minDay, to: ds.maxDay, dims: {} })
  }, [ds, setFilters])

  const setModule = useCallback((m: ModuleId) => {
    setModuleRaw(m)
    setReport(false)
    setPrintSeq((s) => s + 1)
  }, [])

  const derived = useMemo(() => {
    if (!ds) return { rows: [], rowsAllDates: [], k: null, comps: [], activeComp: null, weeks: [], weeksAll: [] }
    const rows = filterRows(ds.rows, filters)
    const rowsAllDates = filterRows(ds.rows, filters, true)
    const k = kpis(rows)
    const comps = ds.capabilities.dates ? comparisons(ds, filters) : []
    const activeComp = comps.length ? comps[compare === 'previous' ? 0 : 1] : null
    const weeks = ds.capabilities.dates ? weeklySeries(rows, filters.from, filters.to) : []
    const weeksAll = ds.capabilities.dates ? weeklySeries(rowsAllDates, ds.minDay, ds.maxDay) : []
    return { rows, rowsAllDates, k, comps, activeComp, weeks, weeksAll }
  }, [ds, filters, compare])

  const value: AppState = {
    source, ds, loading, error, filters, setFilters, pickDims, resetFilters, module, setModule, report, setReport,
    compare, setCompare, currency, setCurrency, theme, setTheme, loadTable, loadBundled, loadSample, loadUrl, shareable: !!(source?.bundled || source?.url), sampleId: source?.sample ?? null, remap,
    setLoading, setError, printSeq, ...derived,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
