import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MODULES, jumpBox, useApp, type ModuleId } from '../state'
import { rankMatches, type SearchItem } from './SearchBox'
import { DIMENSION_LABEL, DIMENSIONS } from '../engine/types'
import { money } from '../format'

interface Entry extends SearchItem {
  group: string
  run: () => void
}

/** The jump bar: one box that reaches every screen, action, period, filter value, product and
 *  customer. Opens with Ctrl+K (or its button); type a few letters and press Enter. */
export function Palette({ onUpload, onFilters, onSamples }: { onUpload: () => void; onFilters: () => void; onSamples: () => void }) {
  const { ds, source, filters, setFilters, pickDims, setModule, setReport, theme, setTheme, currency } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const toggle = () => {
      setOpen((v) => !v)
      setQuery('')
      setActive(0)
    }
    addEventListener('retailai-palette', toggle)
    return () => removeEventListener('retailai-palette', toggle)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const entries = useMemo<Entry[]>(() => {
    if (!ds) return []
    const out: Entry[] = []
    for (const m of MODULES) out.push({ id: `screen-${m.id}`, label: m.label, sub: m.hint, group: 'Screens', run: () => setModule(m.id as ModuleId) })
    out.push({ id: 'screen-report', label: 'Report', sub: 'A printable summary of the current view', group: 'Screens', run: () => setReport(true) })
    out.push({ id: 'act-file', label: 'Open a file', sub: 'CSV or Excel, read in this tab only', group: 'Actions', run: onUpload })
    out.push({ id: 'act-filter', label: 'Filter the data', sub: 'Regions, categories and more', group: 'Actions', run: onFilters })
    out.push({ id: 'act-store', label: 'Switch sample store', sub: 'Superstore, UK online, Kedai Amber', group: 'Actions', run: onSamples })
    out.push({ id: 'act-theme', label: theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode', group: 'Actions', run: () => setTheme(theme === 'light' ? 'dark' : 'light') })
    if (source?.bundled)
      out.push({
        id: 'act-link',
        label: 'Copy a link to this view',
        sub: 'Anyone who opens it sees exactly this',
        group: 'Actions',
        run: () => {
          navigator.clipboard
            ?.writeText(location.href)
            .then(() => dispatchEvent(new CustomEvent('retailai-toast', { detail: 'Link copied. It opens this store, period, filters and screen.' })))
            .catch(() => dispatchEvent(new CustomEvent('retailai-toast', { detail: 'Copying was blocked; copy the address bar instead.' })))
        },
      })
    out.push({ id: 'act-reset', label: 'Show everything', sub: 'Clear the period and all filters', group: 'Actions', run: () => ds && setFilters({ from: ds.minDay, to: ds.maxDay, dims: {} }) })
    if (ds.capabilities.dates)
      for (const n of [4, 13, 26, 52]) {
        if (ds.maxDay - n * 7 + 1 >= ds.minDay) out.push({ id: `period-${n}`, label: `Last ${n} weeks`, group: 'Periods', run: () => setFilters({ ...filters, from: ds.maxDay - n * 7 + 1, to: ds.maxDay }) })
      }
    for (const d of DIMENSIONS) {
      if (!ds.capabilities.dimensions.includes(d)) continue
      const seen = new Set<string>()
      for (const r of ds.rows) {
        const v = r[d]
        if (!v || seen.has(v)) continue
        seen.add(v)
        out.push({
          id: `dim-${d}-${v}`,
          label: v,
          sub: `Filter by ${DIMENSION_LABEL[d].toLowerCase()}`,
          group: 'Filters',
          run: () => {
            const cur = filters.dims[d] ?? []
            pickDims({ ...filters.dims, [d]: cur.includes(v) ? cur : [...cur, v] })
          },
        })
      }
    }
    if (ds.capabilities.products) {
      const seen = new Set<string>()
      for (const r of ds.rows) {
        if (seen.has(r.product)) continue
        seen.add(r.product)
        out.push({
          id: `prod-${r.product}`,
          label: r.productName,
          sub: 'Product',
          group: 'Products',
          run: () => {
            jumpBox.product = r.product
            setModule('products')
          },
        })
      }
    }
    if (ds.capabilities.customers) {
      const net = new Map<string, number>()
      const name = new Map<string, string>()
      for (const r of ds.rows) {
        if (!r.customer) continue
        net.set(r.customer, (net.get(r.customer) ?? 0) + r.revenue)
        if (!name.has(r.customer)) name.set(r.customer, r.customerName ?? r.customer)
      }
      for (const [id, label] of name)
        out.push({
          id: `cust-${id}`,
          label,
          sub: `Customer, ${money(net.get(id) ?? 0, currency)}`,
          group: 'Customers',
          run: () => {
            jumpBox.customer = id
            setModule('customers')
          },
        })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, source, filters, theme, currency])

  const GROUPS = ['Screens', 'Actions', 'Periods', 'Filters', 'Products', 'Customers']
  const CAP: Record<string, number> = { Screens: 7, Actions: 6, Periods: 4, Filters: 6, Products: 5, Customers: 5 }
  const results = useMemo(() => {
    const q = query.trim()
    const out: Entry[] = []
    for (const g of GROUPS) {
      const pool = entries.filter((e) => e.group === g)
      if (!q) {
        if (g === 'Screens' || g === 'Actions') out.push(...pool)
        continue
      }
      out.push(...(rankMatches(pool, q, CAP[g]) as Entry[]))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query])

  useEffect(() => {
    if (!open) return
    box.current?.querySelector('input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    const onAway = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    addEventListener('keydown', onKey, true)
    addEventListener('pointerdown', onAway)
    return () => {
      removeEventListener('keydown', onKey, true)
      removeEventListener('pointerdown', onAway)
    }
  }, [open, close])

  if (!open || !ds) return null

  const pick = (e: Entry) => {
    close()
    e.run()
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      pick(results[active])
    }
  }

  let lastGroup = ''
  return createPortal(
    <>
      <div className="palette-backdrop" aria-hidden onClick={close} />
      <div className="palette" ref={box} role="dialog" aria-label="Jump to anything">
        <input
          className="palette-input"
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `pal-${active}` : undefined}
          placeholder="Jump to a screen, product, customer or filter"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKey}
        />
        <ul className="palette-list" id="palette-list" role="listbox">
          {results.map((r, i) => {
            const head = r.group !== lastGroup
            lastGroup = r.group
            return (
              <li key={r.id} role="presentation">
                {head && <span className="palette-group" aria-hidden>{r.group}</span>}
                <button type="button" id={`pal-${i}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onPointerEnter={() => setActive(i)} onClick={() => pick(r)}>
                  <span className="palette-label">{r.label}</span>
                  {r.sub && <span className="palette-sub">{r.sub}</span>}
                </button>
              </li>
            )
          })}
          {query.trim() && !results.length && <li className="palette-empty">Nothing matches. Try fewer letters.</li>}
        </ul>
        <footer className="palette-foot" aria-hidden>
          <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </footer>
      </div>
    </>,
    document.body,
  )
}
