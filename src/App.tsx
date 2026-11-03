import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { AppProvider, MODULES, useApp } from './state'
import { ReceiptProvider } from './receipt'
import { DisplayBand, DropZone, FilterCard, FilterChips, ReceiptPrinter, SamplePicker, TicketRail, TuningBand, Utilities, useFileOpener, useShortcuts } from './ui/chassis'
import { reducedMotion } from './ui/primitives'
import { Overview } from './modules/Overview'
import { Sales } from './modules/Sales'
import { Forecast } from './modules/Forecast'
import { Customers } from './modules/Customers'
import { Products } from './modules/Products'
import { Data } from './modules/Data'
import { Report } from './modules/Report'

function Logo() {
  return (
    <div className="logo">
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
        <g transform="rotate(-12 20 20)">
          <path d="M14 6h12l6 7v21H8V13z" className="logo-plate" />
          <circle cx="20" cy="12" r="2.6" className="logo-dot" />
          <path d="M13 22h14M13 27.5h9" className="logo-r" />
        </g>
      </svg>
      <span className="logo-word">
        RETAIL<b>AI</b>
      </span>
    </div>
  )
}

function Screen({ onOpen }: { onOpen: () => void }) {
  const { module, report, loading, error, setError, ds } = useApp()
  const screen = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const first = useRef(true)
  // Every screen opens at its top, not wherever the last one was scrolled to.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    screen.current?.scrollTo({ top: 0 })
    if (window.scrollY > 0 && window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0 })
  }, [module, report])
  // A small 'More below' cue while part of the screen is out of sight.
  useEffect(() => {
    const el = screen.current
    if (!el) return
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 40 && el.clientHeight < el.scrollHeight)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    el.addEventListener('scroll', check, { passive: true })
    const t = setTimeout(check, 900)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', check)
      clearTimeout(t)
    }
  }, [module, report, ds])
  useLayoutEffect(() => {
    if (reducedMotion() || !screen.current) return
    gsap.fromTo(screen.current.querySelectorAll('.mod > *, .report > *'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' })
  }, [module, report])

  const body = useMemo(() => {
    if (!ds) return null
    if (report) return <Report />
    switch (module) {
      case 'overview':
        return <Overview onOpen={onOpen} />
      case 'sales':
        return <Sales />
      case 'forecast':
        return <Forecast />
      case 'customers':
        return <Customers />
      case 'products':
        return <Products />
      case 'data':
        return <Data onOpen={onOpen} />
    }
  }, [module, report, ds, onOpen])

  return (
    <main className={`screen ${report ? 'screen-report' : ''}`} id="screen" aria-label={report ? 'Printable report' : MODULES.find((m) => m.id === module)?.label}>
      <div className="screen-glass" ref={screen}>
        {error && (
          <div className="alert" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {loading && (
          <div className="loading" role="status">
            <span className="loading-bar" aria-hidden />
            {loading}
          </div>
        )}
        {body}
      </div>
      {more && (
        <button type="button" className="more-below" onClick={() => screen.current?.scrollBy({ top: screen.current.clientHeight * 0.75, behavior: reducedMotion() ? 'auto' : 'smooth' })}>
          More below
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden>
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </main>
  )
}

function Console() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [samplesOpen, setSamplesOpen] = useState(false)
  const { pick, openFile } = useFileOpener()
  const { ds, report } = useApp()
  const shell = useRef<HTMLDivElement>(null)
  const booted = useRef(false)
  const openFilters = useCallback(() => setFiltersOpen(true), [])
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const handlers = useMemo(() => ({ filters: openFilters, upload: pick }), [openFilters, pick])
  useShortcuts(handlers)

  // One orchestrated power-on when the first dataset arrives.
  useLayoutEffect(() => {
    if (!ds || booted.current || !shell.current) return
    booted.current = true
    let seen = false
    try {
      seen = sessionStorage.getItem('retailai-booted') === '1'
      sessionStorage.setItem('retailai-booted', '1')
    } catch {
      /* private mode: just play it */
    }
    if (reducedMotion() || seen) return
    const q = gsap.utils.selector(shell.current)
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from(q('.order'), { y: -70, rotate: (i) => (i % 2 ? 7 : -6), opacity: 0, duration: 0.9, stagger: 0.06, ease: 'elastic.out(1, 0.55)', clearProps: 'transform,opacity' })
      .from(q('.band-cell'), { opacity: 0, y: -6, duration: 0.35, stagger: 0.05 }, 0.1)
      .from(q('.ticket'), { y: 26, opacity: 0, duration: 0.6, stagger: 0.07 }, 0.25)
      .from(q('.tuning'), { opacity: 0, y: 12, duration: 0.5 }, 0.4)
  }, [ds])

  useEffect(() => {
    document.body.classList.toggle('printing-report', report)
  }, [report])

  return (
    <div className="chassis" ref={shell}>
      <a className="skip" href="#screen">Skip to the screen</a>
      <header className="topbar">
        <Logo />
        <DisplayBand onPickSample={() => setSamplesOpen(true)} />
        <Utilities onUpload={pick} />
      </header>
      <div className="railrow">
        <TicketRail />
        <FilterCard open={filtersOpen} onOpen={openFilters} onClose={closeFilters} />
      </div>
      <div className="deckrow">
        <Screen onOpen={pick} />
        <div className="printcol">
          <FilterChips onOpen={openFilters} />
          <ReceiptPrinter />
        </div>
      </div>
      <nav className="dock" id="dock" aria-label="More on this screen" />
      <footer className="controls">
        <TuningBand />
      </footer>
      <SamplePicker open={samplesOpen} onClose={() => setSamplesOpen(false)} onOpenFile={pick} />
      <DropZone onFile={openFile} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ReceiptProvider>
        <Console />
      </ReceiptProvider>
    </AppProvider>
  )
}
