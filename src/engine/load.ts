// File reading. CSV parsing works in the browser and in Node; Excel is browser-only here.
import Papa from 'papaparse'
import type { RawRecord } from './clean'

export interface RawTable {
  records: RawRecord[]
  columns: string[]
}

export function parseCsvText(text: string): RawTable {
  const res = Papa.parse<RawRecord>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  })
  const columns = (res.meta.fields ?? []).filter((c) => c !== '')
  return { records: res.data, columns }
}

export function tableFromMatrix(matrix: unknown[][]): RawTable {
  const headerRow = matrix.findIndex((row) => row.filter((c) => c !== null && String(c).trim() !== '').length >= 2)
  if (headerRow < 0) return { records: [], columns: [] }
  const raw = matrix[headerRow].map((h, i) => (h === null || String(h).trim() === '' ? `Column ${i + 1}` : String(h).trim()))
  // De-duplicate header names so no column is lost.
  const columns = raw.map((h, i) => (raw.indexOf(h) === i ? h : `${h} (${i + 1})`))
  const records = matrix
    .slice(headerRow + 1)
    .filter((row) => row.some((c) => c !== null && String(c).trim() !== ''))
    .map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i] ?? null])))
  return { records, columns }
}
