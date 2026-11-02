import { dayToDate } from './engine/values'

export type Currency = 'USD' | 'MYR' | 'SGD' | 'EUR' | 'GBP' | 'INR' | 'AUD' | 'NONE'

export const CURRENCIES: { id: Currency; label: string }[] = [
  { id: 'USD', label: 'US dollar ($)' },
  { id: 'MYR', label: 'Malaysian ringgit (RM)' },
  { id: 'SGD', label: 'Singapore dollar (S$)' },
  { id: 'EUR', label: 'Euro (€)' },
  { id: 'GBP', label: 'Pound sterling (£)' },
  { id: 'INR', label: 'Indian rupee (₹)' },
  { id: 'AUD', label: 'Australian dollar (A$)' },
  { id: 'NONE', label: 'No currency (plain numbers)' },
]

const SYMBOL: Record<Currency, string> = { USD: '$', MYR: 'RM', SGD: 'S$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', NONE: '' }

export function currencySymbol(c: Currency): string {
  return SYMBOL[c]
}

/** Guess a currency from raw cell text such as "RM12.50" or "$4". */
export function guessCurrency(samples: unknown[]): Currency | null {
  const s = samples.slice(0, 300).map((v) => String(v ?? '')).join(' ')
  if (/\bRM|MYR/i.test(s)) return 'MYR'
  if (/S\$|SGD/.test(s)) return 'SGD'
  if (/A\$|AUD/.test(s)) return 'AUD'
  if (/€|EUR/.test(s)) return 'EUR'
  if (/£|GBP/.test(s)) return 'GBP'
  if (/₹|INR/.test(s)) return 'INR'
  if (/\$|USD/.test(s)) return 'USD'
  return null
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const twoDp = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function money(v: number, c: Currency, mode: 'compact' | 'whole' | 'exact' = 'compact'): string {
  const sign = v < 0 ? '−' : ''
  const a = Math.abs(v)
  const body = mode === 'compact' ? (a >= 10_000 ? compact.format(a) : whole.format(a)) : mode === 'whole' ? whole.format(a) : twoDp.format(a)
  return `${sign}${SYMBOL[c]}${body}`
}

/** Split a compact money string into the parts a seven-segment readout can draw. */
export function readoutParts(v: number, c: Currency): { prefix: string; digits: string; suffix: string } {
  const a = Math.abs(v)
  let digits: string
  let suffix = ''
  if (a >= 1e9) [digits, suffix] = [(a / 1e9).toFixed(2), 'B']
  else if (a >= 1e6) [digits, suffix] = [(a / 1e6).toFixed(2), 'M']
  else if (a >= 1e4) [digits, suffix] = [(a / 1e3).toFixed(1), 'K']
  else digits = a >= 100 ? a.toFixed(0) : a.toFixed(2)
  return { prefix: (v < 0 ? '-' : '') + SYMBOL[c], digits, suffix }
}

export function count(v: number): string {
  return v >= 100_000 ? compact.format(v) : whole.format(v)
}

export function pct(v: number | undefined, digits = 1): string {
  if (v === undefined || !Number.isFinite(v)) return '—'
  return `${(v * 100).toFixed(digits)}%`
}

export function signedPct(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return 'no comparison'
  const s = (v * 100).toFixed(1)
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${s.replace('-', '')}%`
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export const fmtDay = (d: number) => (Number.isFinite(d) ? dateFmt.format(dayToDate(d)) : '—')
export const fmtShort = (d: number) => shortFmt.format(dayToDate(d))
export const fmtMonth = (d: number) => monthFmt.format(dayToDate(d))

export function rangeLabel(from: number, to: number): string {
  if (!Number.isFinite(from)) return 'All rows'
  return `${fmtDay(from)} – ${fmtDay(to)}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name.endsWith('.csv') ? name : `${name}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
