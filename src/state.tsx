import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Dataset, Mapping, CleanOptions } from './engine/types'
import { buildDataset, type RawRecord } from './engine/clean'
import { parseCsvText } from './engine/load'
import { filterRows, kpis, comparisons, weeklySeries, type Filters, type Kpis, type Comparison, type Week } from './engine/aggregate'
import { guessCurrency, type Currency } from './format'

export type ModuleId = 'overview' | 'sales' | 'forecast' | 'customers' | 'products' | 'data'

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
}

interface AppState {
  source: Source | null
  ds: Dataset | null
  loading: string | null
  error: string | null
  filters: Filters
  setFilters: (f: Filters) => void
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
    // Open on the latest 52 weeks when there is at least two years of data, so every
    // figure has a comparison from the first glance. Shorter files open on everything.
    const long = Number.isFinite(next.minDay) && next.maxDay - next.minDay >= 2 * 364
    setFiltersRaw({ from: long ? next.maxDay - 363 : next.minDay, to: next.maxDay, dims: {} })
    setPrintSeq((s) => s + 1)
  }, [])

  const loadTable = useCallback(
    (name: string, records: RawRecord[], columns: string[], bundled = false) => {
      const next = buildDataset(name, records, columns)
      setSource({ name, records, columns, bundled })
      const revCol = next.mapping.revenue ?? next.mapping.unitPrice
      const guessed = revCol ? guessCurrency(records.map((r) => r[revCol])) : null
      setCurrency(bundled ? 'USD' : guessed ?? 'NONE')
      adopt(next)
      setError(null)
      setLoading(null)
      setReport(false)
      setModuleRaw(bundled ? 'overview' : 'data')
    },
    [adopt],
  )

  const loadBundled = useCallback(() => {
    setLoading('Loading the sample store')
    import('../data/superstore_sales.csv?raw')
      .then((m) => {
        const t = parseCsvText(m.default)
        loadTable('Superstore sample (US office supplies, 2015–2018)', t.records, t.columns, true)
      })
      .catch((e) => {
        setError(`The sample dataset could not be loaded: ${e instanceof Error ? e.message : String(e)}`)
        setLoading(null)
      })
  }, [loadTable])

  useEffect(() => {
    loadBundled()
  }, [loadBundled])

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
    source, ds, loading, error, filters, setFilters, resetFilters, module, setModule, report, setReport,
    compare, setCompare, currency, setCurrency, theme, setTheme, loadTable, loadBundled, remap,
    setLoading, setError, printSeq, ...derived,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
