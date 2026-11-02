import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { AppProvider, MODULES, useApp } from './state'
import { ReceiptProvider } from './receipt'
import { DisplayBand, DropZone, FilterSheet, Keypad, ReceiptPrinter, TuningBand, useFileOpener, useShortcuts } from './ui/chassis'
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
        <rect x="3" y="3" width="34" height="34" rx="9" className="logo-plate" />
        <path d="M11 27V13h8.5a4.5 4.5 0 0 1 0 9H15l7 5" className="logo-r" />
        <circle cx="28.5" cy="13.5" r="2.4" className="logo-dot" />
      </svg>
      <span className="logo-word">
        Retail<span>AI</span>
      </span>
    </div>
  )
}

function Screen({ onOpen }: { onOpen: () => void }) {
  const { module, report, loading, error, setError, ds } = useApp()
  const screen = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (reducedMotion() || !screen.current) return
    gsap.fromTo(screen.current, { opacity: 0.35, filter: 'brightness(1.8) blur(1.5px)' }, { opacity: 1, filter: 'brightness(1) blur(0px)', duration: 0.45, ease: 'power2.out', clearProps: 'filter' })
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
    tl.from(q('.screen-glass'), { scaleY: 0.012, scaleX: 0.6, opacity: 0.9, duration: 0.55, ease: 'expo.out' })
      .from(q('.band-cell'), { opacity: 0, duration: 0.05, stagger: { each: 0.07, repeat: 1, yoyo: true } }, 0.1)
      .from(q('.key'), { y: 14, opacity: 0, duration: 0.5, stagger: 0.035 }, 0.2)
      .from(q('.tuning'), { opacity: 0, y: 10, duration: 0.5 }, 0.35)
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
      </header>
      <div className="deckrow">
        <Screen onOpen={pick} />
        <ReceiptPrinter />
      </div>
      <footer className="controls">
        <TuningBand />
        <Keypad onFilters={openFilters} onUpload={pick} />
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
