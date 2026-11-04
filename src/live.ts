// Live data from a link: a Google Sheet published as CSV, or any CSV address the browser is
// allowed to read. The link is read again on every visit, so the console shows the sheet as it
// is now. Nothing is uploaded; the browser fetches the sheet directly.

/** The address to fetch for a pasted link. Google Sheets links of every common shape become
 *  their CSV form; anything else is used as given. Returns null for something that is not a
 *  web address. */
export function csvUrlFor(input: string): string | null {
  const raw = input.trim()
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.hostname === 'docs.google.com' && u.pathname.startsWith('/spreadsheets/')) {
    const gid = u.searchParams.get('gid') ?? u.hash.match(/gid=(\d+)/)?.[1] ?? null
    // Published to the web: /spreadsheets/d/e/<id>/pubhtml or /pub?output=...
    const pub = u.pathname.match(/^\/spreadsheets\/d\/e\/([^/]+)\/(pubhtml|pub)/)
    if (pub) {
      const out = new URL(`https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub`)
      if (gid) out.searchParams.set('gid', gid)
      out.searchParams.set('single', 'true')
      out.searchParams.set('output', 'csv')
      return out.toString()
    }
    // A normal sheet link shared with "anyone with the link".
    const id = u.pathname.match(/^\/spreadsheets\/d\/([^/]+)/)?.[1]
    if (id) return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`
  }
  return u.toString()
}

/** A short name for the store, from the link. */
export function nameForUrl(input: string): string {
  try {
    const u = new URL(input)
    if (u.hostname === 'docs.google.com') return 'Google Sheet'
    const file = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
    return file || u.hostname
  } catch {
    return 'Linked sheet'
  }
}

/** Fetches the CSV text behind a link, with errors a shop owner can act on. */
export async function readLink(input: string): Promise<string> {
  const url = csvUrlFor(input)
  if (!url) throw new Error('That does not look like a web address. Paste the full link, starting with https://.')
  let r: Response
  try {
    r = await fetch(url, { cache: 'no-store', credentials: 'omit' })
  } catch {
    throw new Error(
      'Your browser was not allowed to read that link. The site has to allow it: Google Sheets does once the sheet is published (File, Share, Publish to web, CSV). For other sites, download the file and open it instead.',
    )
  }
  if (r.status === 401 || r.status === 403) throw new Error('That sheet is private. In Google Sheets choose File, Share, Publish to web, pick CSV, and paste the link it gives you.')
  if (!r.ok) throw new Error(`The link answered with an error (${r.status}). Check it opens in a new tab.`)
  const text = await r.text()
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('That link opens a web page, not a CSV. In Google Sheets choose File, Share, Publish to web, and pick CSV.')
  if (!text.trim()) throw new Error('The link returned an empty file.')
  return text
}
