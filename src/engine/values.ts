// Value parsing: money-like numbers and calendar dates, without timezone surprises.
import type { DateConvention } from './types'

const CURRENCY = /(rm|myr|usd|sgd|eur|gbp|inr|aud|us\$|s\$|a\$|[$€£₹¥₩฿₱])/gi

/** Parse "RM1,234.50", "(12.00)", "1.234,56", "-5" → number, or NaN. */
export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (value === null || value === undefined) return NaN
  let s = String(value).trim()
  if (!s) return NaN
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(CURRENCY, '').replace(/\s/g, '')
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  }
  if (s.endsWith('-')) {
    negative = !negative
    s = s.slice(0, -1)
  }
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    // European style: 1.234,56 or 12,5
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  if (!/^\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return NaN
  const n = Number(s)
  return negative ? -n : n
}

/** Whole days since 1970-01-01 (UTC). */
export function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function dayToDate(day: number): Date {
  return new Date(day * 86_400_000)
}

export function dayToISO(day: number): string {
  return dayToDate(day).toISOString().slice(0, 10)
}

/** Monday = 0 … Sunday = 6. 1970-01-01 was a Thursday. */
export function weekday(day: number): number {
  return (((day + 3) % 7) + 7) % 7
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function validDay(y: number, m: number, d: number): number {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return NaN
  const day = dayNumber(y, m, d)
  const back = dayToDate(day)
  if (back.getUTCMonth() + 1 !== m || back.getUTCDate() !== d) return NaN
  return day
}

function fullYear(y: number): number {
  if (y >= 100) return y
  return y < 70 ? 2000 + y : 1900 + y
}

/** Parse a date cell into a day number, or NaN. ISO dates ignore the convention. */
export function parseDay(value: unknown, convention: DateConvention): number {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return NaN
    // Spreadsheet readers give local midnight; keep the calendar date the user sees.
    return dayNumber(value.getFullYear(), value.getMonth() + 1, value.getDate())
  }
  if (typeof value === 'number') {
    // Excel serial date (1900 system). 25569 = 1970-01-01.
    if (value > 20000 && value < 80000) return Math.floor(value) - 25569
    return NaN
  }
  if (value === null || value === undefined) return NaN
  const s = String(value).trim()
  if (!s) return NaN

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[ T])/.exec(s)
  if (m) return validDay(+m[1], +m[2], +m[3])

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:$|[ T])/.exec(s)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    const y = fullYear(+m[3])
    return convention === 'dmy' ? validDay(y, b, a) : validDay(y, a, b)
  }

  // "8 Nov 2017", "08-Nov-17"
  m = /^(\d{1,2})[\s-]([a-z]{3,9})\.?[\s-,]*(\d{4}|\d{2})(?!\d)/i.exec(s)
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    return validDay(fullYear(+m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1])
  }
  // "Nov 8, 2017"
  m = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(s)
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    return validDay(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2])
  }
  return NaN
}

/** Look at a sample of date strings and say which convention they force, if any. */
export function detectDateConvention(values: unknown[]): DateConvention | 'ambiguous' | 'iso' {
  let firstOver12 = 0
  let secondOver12 = 0
  let iso = 0
  let numeric = 0
  for (const v of values) {
    if (v instanceof Date || typeof v === 'number') continue
    const s = String(v ?? '').trim()
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) {
      iso++
      continue
    }
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(s)
    if (!m) continue
    numeric++
    if (+m[1] > 12) firstOver12++
    if (+m[2] > 12) secondOver12++
  }
  if (iso > 0 && numeric === 0) return 'iso'
  if (firstOver12 > 0 && secondOver12 === 0) return 'dmy'
  if (secondOver12 > 0 && firstOver12 === 0) return 'mdy'
  return 'ambiguous'
}
