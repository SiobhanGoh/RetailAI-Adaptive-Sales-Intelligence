import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { AppProvider, MODULES, useApp } from './state'
import { ReceiptProvider } from './receipt'
import { DisplayBand, DropZone, FilterSheet, ReceiptPrinter, TicketRail, TuningBand, Utilities, useFileOpener, useShortcuts } from './ui/chassis'
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
  useLayoutEffect(() => {
    if (reducedMotion() || !screen.current) return
    gsap.fromTo(screen.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' })
  }, [module, report])

  const body = useMemo(() => {
    if (!ds) return null
    if (report) return <Report />
    switch (module) {
      case 'overview':
        return <Overview />
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
    </main>
  )
}

function Console() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { pick, openFile } = useFileOpener()
  const { ds, report } = useApp()
  const shell = useRef<HTMLDivElement>(null)
  const booted = useRef(false)
  const openFilters = useCallback(() => setFiltersOpen(true), [])
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
      .from(q('.panel-scope .scope-line'), { strokeDashoffset: 4000, strokeDasharray: 4000, duration: 1.4, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' }, 0.35)
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
        <DisplayBand />
        <Utilities onFilters={openFilters} onUpload={pick} />
      </header>
      <TicketRail />
      <div className="deckrow">
        <Screen onOpen={pick} />
        <ReceiptPrinter />
      </div>
      <footer className="controls">
        <TuningBand />
      </footer>
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
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
