import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { readoutParts, signedPct, type Currency } from '../format'

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useSize<T extends HTMLElement>(): [(el: T | null) => void, { w: number; h: number }, React.RefObject<T | null>] {
  const ref = useRef<T | null>(null)
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const callback = useCallback((node: T | null) => {
    ref.current = node
    setEl(node)
  }, [])
  useLayoutEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [callback, size, ref]
}

/** A large figure that counts smoothly to its new value. */
export function Readout({ value, currency, kind = 'money', size = 'md', label }: { value: number; currency?: Currency; kind?: 'money' | 'count' | 'pct'; size?: 'sm' | 'md' | 'lg' | 'xl'; label: string }) {
  const [shown, setShown] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    if (reducedMotion() || prev.current === value) {
      setShown(value)
      prev.current = value
      return
    }
    const o = { v: prev.current }
    const tween = gsap.to(o, { v: value, duration: 0.9, ease: 'power3.out', onUpdate: () => setShown(o.v) })
    prev.current = value
    return () => {
      tween.kill()
    }
  }, [value])

  let prefix = ''
  let digits = ''
  let suffix = ''
  if (kind === 'money') ({ prefix, digits, suffix } = readoutParts(shown, currency ?? 'NONE'))
  else if (kind === 'pct') {
    digits = (shown * 100).toFixed(1)
    suffix = '%'
  } else {
    const a = Math.round(shown)
    if (a >= 1e6) [digits, suffix] = [(a / 1e6).toFixed(2), 'M']
    else if (a >= 1e5) [digits, suffix] = [(a / 1e3).toFixed(0), 'K']
    else digits = a.toLocaleString('en')
  }
  return (
    <span className={`readout readout-${size}`} role="img" aria-label={label}>
      {prefix && <span className="readout-unit">{prefix}</span>}
      <span className="readout-digits">{digits}</span>
      {suffix && <span className="readout-unit readout-suffix">{suffix}</span>}
    </span>
  )
}

export function Delta({ value, label }: { value: number | undefined; label: string }) {
  if (value === undefined || !Number.isFinite(value)) return <span className="delta delta-none">Nothing earlier to compare with</span>
  const dir = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat'
  return (
    <span className={`delta delta-${dir}`}>
      <svg viewBox="0 0 10 10" aria-hidden width="9" height="9">
        {dir === 'up' && <path d="M5 1 9 8H1z" fill="currentColor" />}
        {dir === 'down' && <path d="M5 9 1 2h8z" fill="currentColor" />}
        {dir === 'flat' && <rect x="1" y="4" width="8" height="2" fill="currentColor" />}
      </svg>
      {signedPct(value)} <span className="delta-vs">vs {label}</span>
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A deterministic decorative barcode built from a string (receipt footer). */
export function Barcode({ seed, width = 180, height = 34 }: { seed: string; width?: number; height?: number }) {
  let h = 2166136261
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (let i = 0; x < width; i++) {
    h ^= seed.charCodeAt(i % Math.max(1, seed.length)) + i
    h = Math.imul(h, 16777619) >>> 0
    const w = 1 + (h % 3)
    const gap = 1 + ((h >> 4) % 3)
    bars.push({ x, w })
    x += w + gap
  }
  return (
    <svg className="barcode" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} />
      ))}
    </svg>
  )
}

export function Panel({ title, aside, children, className = '', glass = false }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; glass?: boolean }) {
  return (
    <section className={`panel ${glass ? 'panel-glass' : 'panel-paper'} ${className}`}>
      {(title || aside) && (
        <header className="panel-head">
          {title && <h3>{title}</h3>}
          {aside && <div className="panel-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden>
        <rect x="2" y="2" width="60" height="36" rx="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M14 28h36M20 20h24M26 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h4>{title}</h4>
      <div>{children}</div>
    </div>
  )
}

/** An order ticket: the figure on the main part, the comparison on the tear-off stub. */
export function Ticket({ label, children, stub, hero = false, no }: { label: string; children: ReactNode; stub?: ReactNode; hero?: boolean; no?: string }) {
  return (
    <div className="ticket-wrap">
    <div className={`ticket ${hero ? 'ticket-hero' : ''}`}>
      <div className="ticket-body">
        <span className="ticket-label">
          {label}
          {no && <span className="ticket-no" aria-hidden>{no}</span>}
        </span>
        {children}
      </div>
      <div className="ticket-stub">{stub}</div>
    </div>
    </div>
  )
}

/** The one-glance summary at the top of each screen. Lines rise in one after another. */
export function Headline({ children, k }: { children: ReactNode; k: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (reducedMotion() || !ref.current) return
    const lines = ref.current.querySelectorAll('.hl-line')
    const t = gsap.fromTo(lines, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out' })
    return () => {
      t.kill()
    }
  }, [k])
  return (
    <div className="headline" ref={ref}>
      {children}
    </div>
  )
}

/** A figure inside a headline: counts up to its value. */
export function Fig({ value, format, tone }: { value: number; format: (v: number) => string; tone?: 'up' | 'down' }) {
  const [shown, setShown] = useState(value)
  const prev = useRef(0)
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value)
      return
    }
    const o = { v: prev.current }
    const t = gsap.to(o, { v: value, duration: 1.1, ease: 'power3.out', onUpdate: () => setShown(o.v) })
    prev.current = value
    return () => {
      t.kill()
    }
  }, [value])
  return <b className={`fig ${tone ? `fig-${tone}` : ''}`}>{format(shown)}</b>
}

/** "Show details" drawer with a smooth height animation. */
export function Details({ label = 'Show details', children, defaultOpen = false }: { label?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const body = useRef<HTMLDivElement>(null)
  const toggle = () => {
    const el = body.current
    const next = !open
    setOpen(next)
    if (!el || reducedMotion()) return
    if (next) {
      requestAnimationFrame(() => gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'height' }))
    }
  }
  return (
    <section className={`details ${open ? 'open' : ''}`}>
      <button type="button" className="details-toggle" aria-expanded={open} onClick={toggle}>
        <span className="details-chev" aria-hidden />
        {open ? 'Hide details' : label}
      </button>
      {open && (
        <div className="details-body" ref={body}>
          {children}
        </div>
      )}
    </section>
  )
}

/** A small trend line for a ticket; draws itself in when it appears or changes. */
export function Spark({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null
  const w = 120
  const h = 30
  const max = Math.max(...values)
  const min = Math.min(...values)
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
  const key = values.slice(-3).map((v) => Math.round(v)).join('-') + values.length
  return (
    <svg className="spark" viewBox={`-3 -3 ${w + 6} ${h + 6}`} role="img" aria-label={label}>
      <polyline key={key} points={pts.join(' ')} pathLength={1} className="spark-line" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.6} className="spark-dot" />
    </svg>
  )
}

/** A dismissible first-visit tip, remembered on this device. */
export function Hint({ id, children }: { id: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(`retailai-hint-${id}`) === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <div className="hint" role="note">
      <span className="hint-pin" aria-hidden />
      <p>{children}</p>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setHidden(true)
          try {
            localStorage.setItem(`retailai-hint-${id}`, '1')
          } catch {
            /* fine: it just shows again next visit */
          }
        }}
      >
        Got it
      </button>
    </div>
  )
}

export function Pill({ value, label }: { value: number | undefined; label: string }) {
  if (value === undefined || !Number.isFinite(value)) return null
  const up = value >= 0
  return (
    <b className={`pill ${up ? 'pill-up' : 'pill-down'}`}>
      {up ? '▲' : '▼'} {Math.abs(value * 100).toFixed(1)}% {up ? 'up' : 'down'} on {label}
    </b>
  )
}
