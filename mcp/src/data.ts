// Loading sales data for the MCP tools: bundled samples or a local CSV/TSV, cached by path
// and modification time so repeated tool calls do not re-parse the file.
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { isAbsolute, resolve } from 'node:path'
import { parseCsvText } from '../../src/engine/load'
import { buildDataset } from '../../src/engine/clean'
import type { Dataset, DateConvention } from '../../src/engine/types'

// The samples live in the RetailAI repository's data/ folder, two levels above this file
// (mcp/src during development, mcp/dist when built).
const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))

const SAMPLES: Record<string, { file: string; name: string; dateConvention?: DateConvention }> = {
  'kedai-amber': { file: 'kedai_amber_synthetic.csv', name: 'Kedai Amber (synthetic Malaysian grocer, RM)' },
  'online-retail': { file: 'online_retail_ii_sample.csv', name: 'UK online gift shop (real, GBP)' },
  superstore: { file: 'superstore_sales.csv', name: 'Superstore (fictional US office supplies, USD)', dateConvention: 'dmy' },
}
export const SAMPLE_IDS = Object.keys(SAMPLES)

const MAX_BYTES = 200 * 1024 * 1024
const cache = new Map<string, { mtime: number; ds: Dataset }>()

export async function loadDataset(dataset: string, dateOrder?: DateConvention): Promise<Dataset> {
  const sample = SAMPLES[dataset]
  const path = sample ? resolve(DATA_DIR, sample.file) : dataset
  if (!sample && !isAbsolute(path)) throw new Error(`"${dataset}" is not a sample (${SAMPLE_IDS.join(', ')}) or an absolute file path.`)
  if (!sample && !/\.(csv|tsv|txt)$/i.test(path)) throw new Error('Only .csv, .tsv or .txt files can be read. Save a spreadsheet as CSV first.')
  let info
  try {
    info = await stat(path)
  } catch {
    throw new Error(sample ? `Sample file not found at ${path}. Run the server from a full RetailAI checkout.` : `No file at ${path}. Check the path.`)
  }
  if (info.size > MAX_BYTES) throw new Error(`The file is ${(info.size / 1e6).toFixed(0)} MB; the limit is ${MAX_BYTES / 1e6} MB.`)
  const key = `${path}\u0001${dateOrder ?? sample?.dateConvention ?? ''}`
  const hit = cache.get(key)
  if (hit && hit.mtime === info.mtimeMs) return hit.ds
  const table = parseCsvText(await readFile(path, 'utf8'))
  const convention = dateOrder ?? sample?.dateConvention
  const ds = buildDataset(sample?.name ?? path, table.records, table.columns, convention ? { options: { dateConvention: convention } } : undefined)
  if (!ds.rows.length) throw new Error(`No usable rows in ${path}. ${ds.quality.map((q) => q.text).join(' ')}`)
  cache.set(key, { mtime: info.mtimeMs, ds })
  return ds
}
