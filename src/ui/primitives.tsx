import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { createPortal } from 'react-dom'
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

export function Delta({ value, label, was }: { value: number | undefined; label: string; was?: string }) {
  if (value === undefined || !Number.isFinite(value)) return <span className="delta delta-none">Nothing earlier to compare with</span>
  const dir = value > 0.0005 ? 'up' : value < -0.0005 ? 'down' : 'flat'
  return (
    <span className={`delta delta-${dir}`}>
      <svg viewBox="0 0 10 10" aria-hidden width="9" height="9">
        {dir === 'up' && <path d="M5 1 9 8H1z" fill="currentColor" />}
        {dir === 'down' && <path d="M5 9 1 2h8z" fill="currentColor" />}
        {dir === 'flat' && <rect x="1" y="4" width="8" height="2" fill="currentColor" />}
      </svg>
      {signedPct(value)} <span className="delta-vs">{was ? `from ${was}` : `vs ${label}`}</span>
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

export function Panel({ title, aside, children, className = '', glass = false, bare = false }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; glass?: boolean; bare?: boolean }) {
  return (
    <section className={`panel ${bare ? 'panel-bare' : glass ? 'panel-glass' : 'panel-paper'} ${className}`}>
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
export type DockIcon = 'pie' | 'calendar' | 'flask' | 'link' | 'users' | 'columns' | 'rows'

const ICONS: Record<DockIcon, ReactNode> = {
  pie: <path d="M10 3a7 7 0 1 0 7 7h-7z M12 1.5V8h6.5A6.5 6.5 0 0 0 12 1.5z" />,
  calendar: <path d="M4 5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 4h14M7 3v4m6-4v4M6.5 12h2m3 0h2m-7 2.5h2" />,
  flask: <path d="M8 2.5h4M8.5 2.5v5L4 15.5a1.2 1.2 0 0 0 1 1.8h10a1.2 1.2 0 0 0 1-1.8l-4.5-8v-5M6 12h8" />,
  link: <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l1-1" />,
  users: <path d="M7.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 17a5 5 0 0 1 10 0M13 3.8a3 3 0 0 1 0 5.6M14.5 12.3A5 5 0 0 1 17.5 17" />,
  columns: <path d="M3 4h14v12H3zM7.7 4v12m4.6-12v12" />,
  rows: <path d="M3 4h14v12H3zM3 8h14M3 12h14" />,
}

/** Extra views for a screen. They live as icons on a floating dock at the side of the screen;
 *  pointing at one slides its title out, and clicking springs a liquid-glass sheet out of the icon.
 *  `inline` keeps the old in-page drawer, for content that has to be seen straight away. */
export function Details({ label = 'Show details', title, icon = 'pie', children, defaultOpen = false, inline = false, actions, openKey }: { label?: string; title?: string; icon?: DockIcon; children: ReactNode; defaultOpen?: boolean; inline?: boolean; actions?: ReactNode; openKey?: string }) {
  if (inline) return <InlineDetails label={label} defaultOpen={defaultOpen} openKey={openKey}>{children}</InlineDetails>
  return <DockSheet title={title ?? label.replace(/^Show (the )?/, '').replace(/^./, (c) => c.toUpperCase())} icon={icon} actions={actions} openKey={openKey}>{children}</DockSheet>
}

const glint = (e: React.PointerEvent<HTMLDivElement>) => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.panel')
  if (!card) return
  const r = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${e.clientX - r.left}px`)
  card.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function DockSheet({ title, icon, children, actions, openKey }: { title: string; icon: DockIcon; children: ReactNode; actions?: ReactNode; openKey?: string }) {
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const tween = useRef<gsap.core.Timeline | null>(null)
  const id = useRef(`sheet-${Math.random().toString(36).slice(2, 8)}`).current

  useEffect(() => setDock(document.getElementById('dock')), [])
  // First visit in a session: show each dock title for a few seconds, so the icons explain themselves.
  const [peek, setPeek] = useState(false)
  useEffect(() => {
    let seen = true
    try {
      seen = sessionStorage.getItem('retailai-dock-peek') === '1'
      if (!seen) setTimeout(() => sessionStorage.setItem('retailai-dock-peek', '1'), 4500)
    } catch {
      seen = false
    }
    if (seen) return
    const a = setTimeout(() => setPeek(true), 1200)
    const b = setTimeout(() => setPeek(false), 5200)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  // Where the sheet should spring from: the centre of its dock icon, relative to the sheet's centre.
  const fromIcon = () => {
    const a = btn.current?.getBoundingClientRect()
    const b = sheet.current?.getBoundingClientRect()
    if (!a || !b) return { x: 0, y: 0 }
    return { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2) }
  }

  const close = useCallback(() => {
    const el = sheet.current
    if (!el || reducedMotion()) {
      setMounted(false)
      btn.current?.focus()
      return
    }
    tween.current?.kill()
    const o = fromIcon()
    tween.current = gsap
      .timeline({
        onComplete: () => {
          setMounted(false)
          btn.current?.focus()
        },
      })
      .to(el, { x: o.x, y: o.y, scale: 0.15, opacity: 0, filter: 'blur(6px)', duration: 0.32, ease: 'power3.in' })
      .to(backdrop.current, { opacity: 0, duration: 0.25 }, 0)
  }, [])

  useLayoutEffect(() => {
    const el = sheet.current
    if (!mounted || !el) return
    ;(el.querySelector('.gsheet-close') as HTMLElement | null)?.focus()
    if (reducedMotion()) return
    const o = fromIcon()
    tween.current?.kill()
    tween.current = gsap
      .timeline()
      .fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.3 })
      .fromTo(el, { x: o.x, y: o.y, scale: 0.15, opacity: 0, filter: 'blur(8px)' }, { x: 0, y: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.62, ease: 'back.out(1.35)', clearProps: 'filter' }, 0)
      .fromTo(el.querySelectorAll('.gsheet-body .panel'), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' }, 0.22)
  }, [mounted])

  // One sheet at a time, and Esc closes it.
  useEffect(() => {
    if (!mounted) return
    const onOther = (e: Event) => (e as CustomEvent).detail !== id && close()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    addEventListener('retailai-sheet', onOther)
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('retailai-sheet', onOther)
      removeEventListener('keydown', onKey)
    }
  }, [mounted, close, id])

  const open = () => {
    if (mounted) return close()
    dispatchEvent(new CustomEvent('retailai-sheet', { detail: id }))
    setMounted(true)
  }

  // Anything on the page can ask for this sheet by key, e.g. a "Check the matching" button.
  useEffect(() => {
    if (!openKey) return
    const onAsk = (e: Event) => {
      if ((e as CustomEvent).detail !== openKey || mounted) return
      dispatchEvent(new CustomEvent('retailai-sheet', { detail: id }))
      setMounted(true)
    }
    addEventListener('retailai-open', onAsk)
    return () => removeEventListener('retailai-open', onAsk)
  }, [openKey, mounted, id])

  const button = (
    <button ref={btn} type="button" className={`dock-btn ${mounted ? 'on' : ''} ${peek ? 'peek' : ''}`} aria-expanded={mounted} aria-controls={id} onClick={open}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</g>
      </svg>
      <span className="dock-label">{title}</span>
    </button>
  )

  return (
    <>
      {dock ? createPortal(button, dock) : null}
      {mounted &&
        createPortal(
          <>
            <div className="gsheet-backdrop" ref={backdrop} onClick={close} aria-hidden />
            <div className="gsheet" id={id} ref={sheet} role="dialog" aria-modal="true" aria-label={title}>
              <header className="gsheet-head">
                <span className="gsheet-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" width="18" height="18">
                    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</g>
                  </svg>
                </span>
                <h2>{title}</h2>
                {actions}
                <button type="button" className="gsheet-close" onClick={close} aria-label={`Close ${title}`}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                    <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </header>
              <div className="gsheet-body details-body" onPointerMove={glint}>
                {children}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

function InlineDetails({ label, children, defaultOpen, openKey }: { label: string; children: ReactNode; defaultOpen: boolean; openKey?: string }) {
  // `mounted` keeps the body in the page while it closes, so it can animate out as well as in.
  const [open, setOpen] = useState(defaultOpen)
  const [mounted, setMounted] = useState(defaultOpen)
  const body = useRef<HTMLDivElement>(null)
  const tween = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    const el = body.current
    if (!el || !open || reducedMotion()) return
    tween.current?.kill()
    const cards = el.querySelectorAll(':scope > * > .panel, :scope > .panel')
    tween.current = gsap
      .timeline()
      .fromTo(el, { height: 0, opacity: 0, overflow: 'hidden' }, { height: 'auto', opacity: 1, duration: 0.55, ease: 'power3.out', clearProps: 'height,opacity,overflow' })
      .fromTo(cards, { y: 18, opacity: 0, scale: 0.97, filter: 'blur(6px)' }, { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity,filter' }, 0.08)
  }, [open, mounted])

  const toggle = () => {
    if (!open) {
      setMounted(true)
      setOpen(true)
      return
    }
    setOpen(false)
    const el = body.current
    if (!el || reducedMotion()) {
      setMounted(false)
      return
    }
    tween.current?.kill()
    tween.current = gsap
      .timeline({ onComplete: () => setMounted(false) })
      .to(el.querySelectorAll(':scope > * > .panel, :scope > .panel'), { y: 10, opacity: 0, scale: 0.98, duration: 0.22, stagger: 0.03, ease: 'power2.in' })
      .to(el, { height: 0, opacity: 0, overflow: 'hidden', duration: 0.38, ease: 'power3.inOut' }, 0.08)
  }

  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!openKey) return
    const onAsk = (e: Event) => {
      if ((e as CustomEvent).detail !== openKey) return
      if (!open) {
        setMounted(true)
        setOpen(true)
      }
      section.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
    }
    addEventListener('retailai-open', onAsk)
    return () => removeEventListener('retailai-open', onAsk)
  }, [openKey, open])

  return (
    <section className={`details ${open ? 'open' : ''}`} ref={section}>
      <button type="button" className="details-toggle" aria-expanded={open} onClick={toggle}>
        <span className="details-chev" aria-hidden />
        {open ? 'Hide details' : label}
      </button>
      {mounted && (
        <div className="details-body" ref={body} onPointerMove={glint}>
          {children}
        </div>
      )}
    </section>
  )
}

/** Ask a details sheet (or in-page drawer) with this key to open. */
export const openDetails = (key: string) => dispatchEvent(new CustomEvent('retailai-open', { detail: key }))

/** A round icon button that saves a CSV; its name shows as a tooltip. */
export function SaveCsv({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3v9m-3.5-3.5L10 12l3.5-3.5" />
          <path d="M4 13.5V16h12v-2.5" />
        </g>
      </svg>
    </button>
  )
}

/** Weekly bars for a ticket; the latest week is lit. Bars rise in one after another. */
export function MiniBars({ values, label, marker }: { values: number[]; label: string; marker?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values) || 1
  const n = values.length
  const key = values.map((v) => Math.round(v)).join('-')
  return (
    <svg className="minibars" viewBox={`0 0 ${n * 10} 34`} preserveAspectRatio="none" role="img" aria-label={label} key={key}>
      {values.map((v, i) => {
        const h = Math.max(1.5, (v / max) * 32)
        return <rect key={i} x={i * 10 + 1.5} y={34 - h} width={7} height={h} rx={1.5} className={i === n - 1 && marker === undefined ? 'minibar minibar-now' : 'minibar'} style={{ animationDelay: `${i * 18}ms` }} />
      })}
      {marker !== undefined && <line x1={marker * 10} x2={marker * 10} y1={0} y2={34} className="minibars-marker" />}
    </svg>
  )
}

/** One bar split into parts, such as new against returning customers. */
export function SplitBar({ parts, label }: { parts: { value: number; tone: 'a' | 'b' }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1
  return (
    <div className="splitbar" role="img" aria-label={label}>
      {parts.map((p, i) => (
        <span key={i} className={`splitbar-part splitbar-${p.tone}`} style={{ flexGrow: p.value / total }} />
      ))}
    </div>
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
