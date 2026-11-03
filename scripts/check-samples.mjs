// Switch between the bundled sample stores in a real browser and capture each screen.
//   npm run build && npx vite preview --port 4173 &
//   node scripts/check-samples.mjs http://localhost:4173/ out-dir
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const [, , url = 'http://localhost:4173/', outDir = 'sample-shots'] = process.argv
mkdirSync(outDir, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.setViewport({ width: 1440, height: 900 })
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.goto(url, { waitUntil: 'networkidle0' })
await page.waitForSelector('.deck')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await page.click('.band-store')
await wait(500)
await page.screenshot({ path: `${outDir}/picker.png` })
await page.keyboard.press('Escape')

for (const [i, tag, keys] of [
  [1, 'UK online', ['1', '5']],
  [2, 'Kedai Amber', ['1', '2', '3', '4', '5', '6']],
  [0, 'Superstore', ['1']],
]) {
  await page.click('.band-store')
  await wait(400)
  const t0 = Date.now()
  await (await page.$$('.sample'))[i].click()
  await page.waitForFunction((n) => document.querySelector('.band-store-name')?.textContent?.includes(n), { timeout: 30000 }, tag)
  console.log(`${tag}: loaded in ${Date.now() - t0} ms`)
  await wait(900)
  for (const k of keys) {
    await page.keyboard.press(k)
    await wait(900)
    await page.screenshot({ path: `${outDir}/${tag.replace(/\W+/g, '')}-${k}.png` })
  }
}
console.log(errors.length ? `Console errors:\n${errors.join('\n')}` : 'No console errors')
await browser.close()
