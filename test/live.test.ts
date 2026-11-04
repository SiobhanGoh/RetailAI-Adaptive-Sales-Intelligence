import { describe, expect, it } from 'vitest'
import { csvUrlFor, nameForUrl } from '../src/live'
import { decodeView, encodeView } from '../src/share'
import { tr } from '../src/i18n'

describe('live links', () => {
  it('turns a normal Google Sheets link into its CSV export', () => {
    expect(csvUrlFor('https://docs.google.com/spreadsheets/d/abc123/edit#gid=42')).toBe('https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=42')
    expect(csvUrlFor('https://docs.google.com/spreadsheets/d/abc123/edit?usp=sharing')).toBe('https://docs.google.com/spreadsheets/d/abc123/export?format=csv')
  })
  it('turns a published sheet into its CSV form', () => {
    expect(csvUrlFor('https://docs.google.com/spreadsheets/d/e/2PACX-x/pubhtml?gid=7')).toBe('https://docs.google.com/spreadsheets/d/e/2PACX-x/pub?gid=7&single=true&output=csv')
    expect(csvUrlFor('https://docs.google.com/spreadsheets/d/e/2PACX-x/pub?output=tsv')).toBe('https://docs.google.com/spreadsheets/d/e/2PACX-x/pub?single=true&output=csv')
  })
  it('keeps other links and refuses non-links', () => {
    expect(csvUrlFor('https://example.com/sales.csv')).toBe('https://example.com/sales.csv')
    expect(csvUrlFor('sales.csv')).toBeNull()
    expect(csvUrlFor('javascript:alert(1)')).toBeNull()
  })
  it('names the store from the link', () => {
    expect(nameForUrl('https://docs.google.com/spreadsheets/d/abc/edit')).toBe('Google Sheet')
    expect(nameForUrl('https://example.com/data/june%20sales.csv')).toBe('june sales.csv')
  })
  it('carries the sheet address through a shared view', () => {
    const src = 'https://docs.google.com/spreadsheets/d/e/X/pub?output=csv&gid=1'
    const v = decodeView('#' + encodeView({ src, module: 'sales', from: 10, to: 20 }))
    expect(v).toMatchObject({ src, module: 'sales', from: 10, to: 20 })
    expect(decodeView('#src=javascript:alert(1)')).toBeNull()
  })
})

describe('Bahasa Malaysia', () => {
  it('translates fixed phrases and keeps the spacing around them', () => {
    expect(tr('Net sales')).toBe('Jualan bersih')
    expect(tr(' of sales. ')).toBe(' daripada jualan. ')
  })
  it('fills sentence patterns and leaves shop data alone', () => {
    expect(tr('1,234 orders')).toBe('1,234 pesanan')
    expect(tr('Filter to Office Supplies')).toBe('Tapis kepada Office Supplies')
    expect(tr('Sales run highest on Saturdays in November.')).toBe('Jualan paling tinggi pada hari Sabtu dalam bulan November.')
    expect(tr('Global Wood Trimmed Manager’s Task Chair')).toBe('Global Wood Trimmed Manager’s Task Chair')
  })
  it('writes Malay month names in dates', () => {
    expect(tr('25 Aug 2018')).toBe('25 Ogo 2018')
    expect(tr('1 Jan 2018 – 30 Dec 2018')).toBe('1 Jan 2018 – 30 Dis 2018')
  })
})
