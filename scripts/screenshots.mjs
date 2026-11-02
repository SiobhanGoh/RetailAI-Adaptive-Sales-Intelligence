// Capture README screenshots from a running build:
//   npm run build && npx vite preview --port 4173 &
//   node scripts/screenshots.mjs http://localhost:4173/ assets/screens
// Needs a local Chrome/Chromium (set CHROME_PATH if it is not /usr/bin/google-chrome).
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , url = 'http://localhost:4173/', outDir = 'assets/screens'] = process.argv
mkdirSync(outDir, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'] })
const errors = []
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(vp) {
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewport(vp)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.deck', { timeout: 20000 })
  await wait(700)
  return page
}

const desktop = { width: 1440, height: 900, deviceScaleFactor: 1 }
const shot = (page, name, opts = {}) => page.screenshot({ path: `${outDir}/${name}.webp`, type: 'webp', quality: 88, ...opts })

{
  const page = await open(desktop)
  const keys = { overview: '1', sales: '2', forecast: '3', customers: '4', products: '5', data: '6' }
  for (const [name, key] of Object.entries(keys)) {
    await page.keyboard.press(key)
    await wait(700)
    await shot(page, `desktop-${name}`)
  }
  await page.keyboard.press('1')
  await page.click('.btn-icon')
  await wait(500)
  await shot(page, 'desktop-graphite')
  await page.click('.btn-icon')
  // Open the synthetic messy fixture through the real file picker.
  const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('.btn-amber')])
  await chooser.accept([resolve('test/fixtures/synthetic_gift_shop.csv')])
  await wait(1200)
  await shot(page, 'desktop-upload-data')
  await page.close()
}
{
  const page = await open({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await shot(page, 'mobile-overview')
  await page.close()
}
console.log(errors.length ? `Console errors:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
