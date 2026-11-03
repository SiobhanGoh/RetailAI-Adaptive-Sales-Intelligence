import { useId, useMemo, useRef, useState } from 'react'

export interface SearchItem {
  id: string
  label: string
  /** A short second line, such as a sub-category or segment. */
  sub?: string
  /** A figure on the right, such as sales. */
  meta?: string
}

/** Rank names so that what you type finds the obvious thing first: names that start with it,
 *  then names with a word that starts with it, then names that contain it anywhere. Each group
 *  is alphabetical. */
export function rankMatches(items: SearchItem[], query: string, limit = 8): SearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items.slice(0, limit)
  const groups: SearchItem[][] = [[], [], []]
  for (const it of items) {
    const name = it.label.toLowerCase()
    const id = it.id.toLowerCase()
    if (name.startsWith(q) || id.startsWith(q)) groups[0].push(it)
    else if (name.split(/[\s\-/(,.]+/).some((w) => w.startsWith(q))) groups[1].push(it)
    else if (name.includes(q) || id.includes(q)) groups[2].push(it)
  }
  const out: SearchItem[] = []
  for (const g of groups) {
    g.sort((a, b) => a.label.localeCompare(b.label))
    for (const it of g) {
      out.push(it)
      if (out.length >= limit) return out
    }
  }
  return out
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

export function SearchBox({ items, onPick, label, placeholder, emptyHint, idleTitle = 'Best sellers' }: { items: SearchItem[]; onPick: (id: string) => void; label: string; placeholder: string; emptyHint?: string; idleTitle?: string }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const list = useId()
  const results = useMemo(() => rankMatches(items, query), [items, query])
  const total = useMemo(() => (query.trim() ? rankMatches(items, query, 100_000).length : items.length), [items, query])

  const pick = (it: SearchItem) => {
    setQuery(it.label)
    setOpen(false)
    onPick(it.id)
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault()
        pick(results[active])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }
  }

  return (
    <div
      className="searchbox"
      ref={box}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <span className="sr-only" id={`${list}-label`}>{label}</span>
      <svg className="searchbox-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden>
        <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        className="field searchbox-input"
        role="combobox"
        aria-labelledby={`${list}-label`}
        aria-expanded={open}
        aria-controls={list}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${list}-${active}` : undefined}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKey}
      />
      {query && (
        <button
          type="button"
          className="searchbox-clear"
          aria-label="Clear the search"
          onClick={() => {
            setQuery('')
            setActive(0)
            setOpen(true)
            box.current?.querySelector('input')?.focus()
          }}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {open && (
        <div className="searchbox-pop">
          <div className="searchbox-head" aria-hidden>
            {query.trim() ? (total ? `${total.toLocaleString('en')} match${total === 1 ? '' : 'es'}${total > results.length ? `, top ${results.length}` : ''}` : 'No matches') : idleTitle}
          </div>
          <ul className="searchbox-list" role="listbox" id={list} aria-labelledby={`${list}-label`}>
            {results.map((it, i) => (
              <li
                key={it.id}
                id={`${list}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'on' : ''}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(it)}
              >
                <span className="searchbox-name">
                  <span className="searchbox-label">
                    <Highlight text={it.label} query={query} />
                  </span>
                  {it.sub && <small>{it.sub}</small>}
                </span>
                {it.meta && <span className="searchbox-meta">{it.meta}</span>}
              </li>
            ))}
          </ul>
          {query.trim() && !total && emptyHint && <p className="searchbox-empty">{emptyHint}</p>}
        </div>
      )}
    </div>
  )
}
