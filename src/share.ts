// A view, written into the link: which sample store, which screen, the period, the filters and
// the comparison. Anyone who opens the link sees exactly what the sender saw. Uploaded files
// never leave the browser, so views of them are not encoded.

export interface ViewState {
  sample?: string
  module?: string
  from?: number
  to?: number
  dims?: Record<string, string[]>
  compare?: string
  /** A live sheet's address, read again by whoever opens the link. */
  src?: string
}

export function encodeView(v: ViewState): string {
  const q = new URLSearchParams()
  if (v.src) q.set('src', v.src)
  else if (v.sample) q.set('store', v.sample)
  if (v.module && v.module !== 'overview') q.set('screen', v.module)
  if (v.from !== undefined && v.to !== undefined && Number.isFinite(v.from) && Number.isFinite(v.to)) q.set('days', `${v.from}..${v.to}`)
  const dims = Object.entries(v.dims ?? {}).filter(([, vals]) => vals && vals.length)
  if (dims.length) q.set('only', dims.map(([d, vals]) => `${d}:${vals!.map(encodeURIComponent).join('|')}`).join(';'))
  if (v.compare && v.compare !== 'previous') q.set('vs', v.compare)
  return q.toString()
}

export function decodeView(hash: string): ViewState | null {
  const raw = hash.replace(/^#/, '')
  if (!raw || !/[=]/.test(raw)) return null
  let q: URLSearchParams
  try {
    q = new URLSearchParams(raw)
  } catch {
    return null
  }
  const v: ViewState = {}
  const store = q.get('store')
  if (store) v.sample = store
  const screen = q.get('screen')
  if (screen) v.module = screen
  const days = q.get('days')
  if (days) {
    const m = days.match(/^(-?\d+)\.\.(-?\d+)$/)
    if (m) {
      const from = Number(m[1])
      const to = Number(m[2])
      if (Number.isFinite(from) && Number.isFinite(to) && from <= to) {
        v.from = from
        v.to = to
      }
    }
  }
  const only = q.get('only')
  if (only) {
    const dims: Record<string, string[]> = {}
    for (const part of only.split(';')) {
      const i = part.indexOf(':')
      if (i <= 0) continue
      const vals = part
        .slice(i + 1)
        .split('|')
        .map((x) => {
          try {
            return decodeURIComponent(x)
          } catch {
            return x
          }
        })
        .filter(Boolean)
      if (vals.length) dims[part.slice(0, i)] = vals
    }
    if (Object.keys(dims).length) v.dims = dims
  }
  const src = q.get('src')
  if (src && /^https?:\/\//.test(src)) v.src = src
  const vs = q.get('vs')
  if (vs) v.compare = vs
  return Object.keys(v).length ? v : null
}
