// Generates data/kedai_amber_synthetic.csv: a SYNTHETIC Malaysian grocery chain ("Kedai Amber").
//   npm run generate:malaysia
//
// Real inputs (CC BY 4.0, see data/sources/malaysia/NOTICE.md):
//   - PriceCatcher item lookup: product names, pack sizes, groups and categories
//   - DOSM Index of Wholesale & Retail Trade (groups 471, 472): month-to-month shape of sales
//   - PriceCatcher premise lookup: the state and district names used for branches
// Everything else is an assumption written down below. The output is deterministic: the same
// seed and inputs give a byte-identical file, and its SHA-256 is printed at the end.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import Papa from 'papaparse'

const SEED = 20261103
const START = Date.UTC(2023, 0, 1) / 86_400_000
const END = Date.UTC(2025, 11, 31) / 86_400_000
const MEMBERS = 2000
const OUT = 'data/kedai_amber_synthetic.csv'

// ---------------------------------------------------------------- seeded randomness
let state = SEED >>> 0
function rand(): number {
  // mulberry32
  state = (state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (a: number, b: number) => a + (b - a) * rand()
const chance = (p: number) => rand() < p
function pick<T>(items: T[], weights?: number[]): T {
  if (!weights) return items[Math.floor(rand() * items.length)]
  const total = weights.reduce((x, y) => x + y, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) if ((r -= weights[i]) <= 0) return items[i]
  return items[items.length - 1]
}
function gamma(shape: number, scale: number): number {
  // Marsaglia–Tsang, with the boost for shape < 1
  if (shape < 1) return gamma(shape + 1, scale) * Math.pow(rand(), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      const u1 = rand()
      const u2 = rand()
      x = Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rand()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale
  }
}
function poisson(mean: number): number {
  const L = Math.exp(-mean)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > L)
  return k - 1
}
const negbin = (mean: number, shape: number) => poisson(gamma(shape, mean / shape))

// ---------------------------------------------------------------- products (PriceCatcher lookup)
type Item = { code: string; name: string; unit: string; group: string; cat: string; price: number; margin: number; weight: number }

const GROUP_EN: Record<string, string> = {
  'BARANGAN BERBUNGKUS': 'Packaged goods',
  'BARANGAN SEGAR': 'Fresh food',
  MINUMAN: 'Drinks',
  'SUSU DAN BARANGAN BAYI': 'Milk and baby',
  'BARANGAN KEDAI SERBANEKA': 'Convenience',
  'PRODUK KEBERSIHAN': 'Household and personal care',
  'BARANGAN KERING': 'Dry goods',
}
const CAT_EN: Record<string, string> = {
  AYAM: 'Chicken', DAGING: 'Meat', 'BUAH-BUAHAN': 'Fruit', 'BAHAN LAUT': 'Seafood', 'IKAN DARAT': 'Freshwater fish',
  'SAYUR-SAYURAN': 'Vegetables', KELAPA: 'Coconut', TELUR: 'Eggs', 'MEE/KUETIAU': 'Fresh noodles', 'TAUHU DAN TEMPE': 'Tofu and tempeh',
  BAWANG: 'Onions and garlic', 'HASIL LAUT KERING': 'Dried seafood', KACANG: 'Beans and nuts', 'UBI KENTANG': 'Potatoes', 'CILI KERING': 'Dried chilli',
  'REMPAH RATUS (TIDAK BERBUNGKUS)': 'Loose spices', 'IKAN DALAM TIN': 'Tinned fish', 'SAPUAN (SPREADS)': 'Spreads', 'KICAP DAN SOS': 'Soy sauce and sauces',
  'MINYAK DAN LEMAK': 'Cooking oil and fats', ROTI: 'Bread', 'KRIMER DAN SUSU TEPUNG': 'Creamer and milk powder', 'REMPAH RATUS (BERBUNGKUS)': 'Packed spices',
  BERAS: 'Rice', TEPUNG: 'Flour', 'ESEN DAN RAGI': 'Essence and yeast', 'SANTAN (KOTAK)': 'Coconut milk', BIHUN: 'Rice vermicelli', GULA: 'Sugar',
  MENTEGA: 'Butter', 'MI SEGERA': 'Instant noodles', 'BAHAN-BAHAN MINUMAN': 'Coffee, tea and malt drinks', 'TERSEDIA MINUM': 'Ready-to-drink',
  'PENJAGAAN DIRI': 'Personal care', 'PENJAGAAN RUMAH': 'Household cleaning', 'SUSU BAYI': 'Infant formula', 'MAKANAN BAYI': 'Baby food',
  'LAMPIN PAKAI BUANG': 'Nappies', 'UBAT-UBATAN': 'Medicines', 'MOUTH WASH': 'Mouthwash', 'MAKANAN SEGERA': 'Instant food', COKLAT: 'Chocolate',
  'ALAT TULIS DAN BAHAN BACAAN': 'Stationery', MAJALAH: 'Magazines', 'BERUS GIGI': 'Toothbrushes', 'UBAT GIGI': 'Toothpaste', 'TUALA WANITA': 'Sanitary pads',
  SYAMPU: 'Shampoo', TISU: 'Tissues', 'PENGHALAU NYAMUK': 'Mosquito repellent', 'MAKANAN RINGAN': 'Snacks', BISKUT: 'Biscuits', 'SABUN BADAN': 'Body wash', 'PEWANGI RUMAH': 'Air freshener',
}
// ASSUMPTION: typical shelf price in RM for the listed pack, as [low, high]. Weight-priced
// fresh categories are per kg and scaled by the pack weight.
const PER_KG: Record<string, [number, number]> = {
  AYAM: [9, 13], DAGING: [26, 48], 'BUAH-BUAHAN': [4, 16], 'BAHAN LAUT': [12, 45], 'IKAN DARAT': [8, 20], 'SAYUR-SAYURAN': [3, 13],
  BAWANG: [4, 14], KACANG: [8, 24], 'UBI KENTANG': [3, 6], 'CILI KERING': [16, 32], 'HASIL LAUT KERING': [30, 70], 'MEE/KUETIAU': [3, 6],
  'REMPAH RATUS (TIDAK BERBUNGKUS)': [18, 60], BERAS: [2.7, 4.8], GULA: [2.85, 3.6], TEPUNG: [1.4, 3.2], 'MINYAK DAN LEMAK': [5.5, 10],
}
const PACK: Record<string, [number, number]> = {
  KELAPA: [2.5, 4], TELUR: [6, 16], 'TAUHU DAN TEMPE': [1.5, 4], 'IKAN DALAM TIN': [4.5, 9], 'SAPUAN (SPREADS)': [4, 14], 'KICAP DAN SOS': [3, 9],
  ROTI: [2.8, 5.5], 'KRIMER DAN SUSU TEPUNG': [3.5, 32], 'REMPAH RATUS (BERBUNGKUS)': [1.8, 7], 'ESEN DAN RAGI': [2, 6], 'SANTAN (KOTAK)': [2.6, 5.5],
  BIHUN: [2, 5], MENTEGA: [7, 16], 'MI SEGERA': [3.5, 7], 'BAHAN-BAHAN MINUMAN': [6, 28], 'TERSEDIA MINUM': [1.6, 6], 'PENJAGAAN DIRI': [5, 22],
  'PENJAGAAN RUMAH': [4, 20], 'SUSU BAYI': [35, 110], 'MAKANAN BAYI': [6, 18], 'LAMPIN PAKAI BUANG': [28, 65],
}
const MARGIN: Record<string, [number, number]> = {
  'Fresh food': [0.16, 0.28], 'Packaged goods': [0.1, 0.22], Drinks: [0.18, 0.3], 'Milk and baby': [0.07, 0.14],
  Convenience: [0.25, 0.4], 'Household and personal care': [0.22, 0.35], 'Dry goods': [0.14, 0.25],
}

function kg(unit: string): number | null {
  const m = /([\d.]+)\s*(kg|g)\b/i.exec(unit)
  if (!m) return unit.toLowerCase().includes('ekor') ? 1.6 : null
  return m[2].toLowerCase() === 'kg' ? +m[1] : +m[1] / 1000
}
const title = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|[\s(/-])([a-z])/g, (_, p, c) => p + c.toUpperCase())

const lookup = Papa.parse<Record<string, string>>(readFileSync('data/sources/malaysia/lookup_item.csv', 'utf8'), { header: true, skipEmptyLines: true }).data
const items: Item[] = []
for (const r of lookup) {
  const group = GROUP_EN[r.item_group]
  if (!group || !r.item || +r.item_code < 0) continue // drops cooked food and the "unknown" row
  const cat = r.item_category
  const w = kg(r.unit)
  let price: number
  if (PER_KG[cat] && w) price = between(...PER_KG[cat]) * Math.pow(w, 0.94)
  else if (PACK[cat]) price = between(...PACK[cat])
  else price = between(2.5, 14)
  const m = MARGIN[group]
  items.push({
    code: `PC-${r.item_code}`,
    name: `${title(r.item)} (${r.unit.trim()})`,
    unit: r.unit,
    group,
    cat,
    price: Math.max(0.9, Math.round(price * 20) / 20),
    margin: between(m[0], m[1]),
    weight: 0,
  })
}
// ASSUMPTION: a few items sell far more than the rest (Zipf-like, exponent 1.1 within each
// category, random order), and staples sell more than specialist goods.
const STAPLE: Record<string, number> = { 'SUSU BAYI': 0.35, 'LAMPIN PAKAI BUANG': 0.45, 'MAKANAN BAYI': 0.5, BERAS: 3, AYAM: 3, TELUR: 3, 'SAYUR-SAYURAN': 2.5, 'MINYAK DAN LEMAK': 2.5, GULA: 2.2, ROTI: 2.5, 'TERSEDIA MINUM': 2, 'MI SEGERA': 2, 'BAHAN-BAHAN MINUMAN': 1.8, BAWANG: 1.8, 'IKAN DALAM TIN': 1.5, 'PENJAGAAN RUMAH': 1.3, 'PENJAGAAN DIRI': 1.3 }
const byCat = new Map<string, Item[]>()
for (const it of items) (byCat.get(it.cat) ?? byCat.set(it.cat, []).get(it.cat)!).push(it)
for (const list of byCat.values()) {
  const order = list.map((it) => ({ it, k: rand() })).sort((a, b) => a.k - b.k)
  order.forEach(({ it }, i) => (it.weight = (STAPLE[it.cat] ?? 1) / Math.pow(i + 1, 1.1)))
}
const itemWeights = items.map((i) => i.weight)

// ASSUMPTION: categories that genuinely go together. Each order has a chance of one planted
// pair, using a fixed "favourite" item on each side so specific item pairs repeat.
const PAIRS: [string, string][] = [
  ['ROTI', 'SAPUAN (SPREADS)'], ['ROTI', 'MENTEGA'], ['BERAS', 'MINYAK DAN LEMAK'], ['GULA', 'BAHAN-BAHAN MINUMAN'],
  ['KRIMER DAN SUSU TEPUNG', 'BAHAN-BAHAN MINUMAN'], ['SUSU BAYI', 'LAMPIN PAKAI BUANG'], ['MAKANAN BAYI', 'SUSU BAYI'],
  ['TEPUNG', 'GULA'], ['TEPUNG', 'MENTEGA'], ['SANTAN (KOTAK)', 'REMPAH RATUS (BERBUNGKUS)'], ['MI SEGERA', 'TELUR'],
  ['AYAM', 'SAYUR-SAYURAN'], ['BAWANG', 'CILI KERING'], ['IKAN DALAM TIN', 'ROTI'], ['PENJAGAAN DIRI', 'PENJAGAAN RUMAH'], ['BISKUT', 'BAHAN-BAHAN MINUMAN'],
].filter(([a, b]) => byCat.has(a) && byCat.has(b)) as [string, string][]
const topIn = (cat: string, n: number) => [...byCat.get(cat)!].sort((a, b) => b.weight - a.weight).slice(0, n)
const plantedPairs = PAIRS.flatMap(([a, b]) => topIn(a, 2).map((x, i) => [x, topIn(b, 2)[i] ?? topIn(b, 1)[0]] as [Item, Item]))

// ---------------------------------------------------------------- calendar
const MONTH_SHAPE = (() => {
  // Month-to-month shape of DOSM retail sales, groups 471 + 472, normalised within each year.
  const rows = Papa.parse<Record<string, string>>(readFileSync('data/sources/malaysia/iowrt_3d_471_472.csv', 'utf8'), { header: true, skipEmptyLines: true }).data
  const sum = new Map<string, number>()
  for (const r of rows) sum.set(r.date.slice(0, 7), (sum.get(r.date.slice(0, 7)) ?? 0) + +r.sales)
  const out = new Map<string, number>()
  for (const y of [2023, 2024, 2025]) {
    const months = Array.from({ length: 12 }, (_, m) => sum.get(`${y}-${String(m + 1).padStart(2, '0')}`) ?? 0)
    const mean = months.reduce((a, b) => a + b, 0) / 12
    months.forEach((v, m) => out.set(`${y}-${m}`, v / mean))
  }
  return out
})()

// ASSUMPTION: festival dates entered by hand (main day). Check against the official gazette.
const FESTIVALS: { name: string; day: string; cats: string[] }[] = [
  { name: 'Chinese New Year', day: '2023-01-22', cats: ['BUAH-BUAHAN', 'BAHAN LAUT', 'BAHAN-BAHAN MINUMAN', 'BISKUT', 'TERSEDIA MINUM'] },
  { name: 'Chinese New Year', day: '2024-02-10', cats: ['BUAH-BUAHAN', 'BAHAN LAUT', 'BAHAN-BAHAN MINUMAN', 'BISKUT', 'TERSEDIA MINUM'] },
  { name: 'Chinese New Year', day: '2025-01-29', cats: ['BUAH-BUAHAN', 'BAHAN LAUT', 'BAHAN-BAHAN MINUMAN', 'BISKUT', 'TERSEDIA MINUM'] },
  { name: 'Hari Raya Aidilfitri', day: '2023-04-22', cats: ['SANTAN (KOTAK)', 'REMPAH RATUS (BERBUNGKUS)', 'DAGING', 'BERAS', 'TEPUNG', 'GULA', 'MENTEGA'] },
  { name: 'Hari Raya Aidilfitri', day: '2024-04-10', cats: ['SANTAN (KOTAK)', 'REMPAH RATUS (BERBUNGKUS)', 'DAGING', 'BERAS', 'TEPUNG', 'GULA', 'MENTEGA'] },
  { name: 'Hari Raya Aidilfitri', day: '2025-03-31', cats: ['SANTAN (KOTAK)', 'REMPAH RATUS (BERBUNGKUS)', 'DAGING', 'BERAS', 'TEPUNG', 'GULA', 'MENTEGA'] },
  { name: 'Hari Raya Haji', day: '2023-06-29', cats: ['DAGING', 'REMPAH RATUS (BERBUNGKUS)', 'SANTAN (KOTAK)'] },
  { name: 'Hari Raya Haji', day: '2024-06-17', cats: ['DAGING', 'REMPAH RATUS (BERBUNGKUS)', 'SANTAN (KOTAK)'] },
  { name: 'Hari Raya Haji', day: '2025-06-07', cats: ['DAGING', 'REMPAH RATUS (BERBUNGKUS)', 'SANTAN (KOTAK)'] },
  { name: 'Deepavali', day: '2023-11-12', cats: ['MINYAK DAN LEMAK', 'TEPUNG', 'GULA', 'MENTEGA', 'REMPAH RATUS (BERBUNGKUS)'] },
  { name: 'Deepavali', day: '2024-10-31', cats: ['MINYAK DAN LEMAK', 'TEPUNG', 'GULA', 'MENTEGA', 'REMPAH RATUS (BERBUNGKUS)'] },
  { name: 'Deepavali', day: '2025-10-20', cats: ['MINYAK DAN LEMAK', 'TEPUNG', 'GULA', 'MENTEGA', 'REMPAH RATUS (BERBUNGKUS)'] },
  ...[2023, 2024, 2025].map((y) => ({ name: 'Christmas', day: `${y}-12-25`, cats: ['MENTEGA', 'TEPUNG', 'COKLAT', 'BISKUT'] })),
]
const dayOf = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000
const festDays = FESTIVALS.map((f) => ({ ...f, d: dayOf(f.day) }))

/** Festival uplift and the categories in season on a given day. */
function festival(day: number): { lift: number; cats: string[] } {
  for (const f of festDays) {
    const before = f.d - day
    if (before >= 1 && before <= 14) return { lift: 1 + 0.9 * (1 - (before - 1) / 14), cats: f.cats } // ramps up to ×1.9 the day before
    if (before === 0) return { lift: 0.55, cats: [] } // the day itself is quiet
  }
  return { lift: 1, cats: [] }
}
const WEEKDAY = [0.88, 0.86, 0.9, 0.95, 1.06, 1.3, 1.22] // Mon..Sun, ASSUMPTION
function intensity(day: number, online: boolean): number {
  const d = new Date(day * 86_400_000)
  const dow = (d.getUTCDay() + 6) % 7
  const dom = d.getUTCDate()
  const month = MONTH_SHAPE.get(`${d.getUTCFullYear()}-${d.getUTCMonth()}`) ?? 1
  const payday = dom >= 25 || dom <= 2 ? 1.12 : 1 // ASSUMPTION
  const growth = 1 + 0.05 * ((day - START) / 365) // ASSUMPTION: 5% a year more orders
  let v = WEEKDAY[dow] * month * payday * growth * festival(day).lift
  if (online) {
    const md = `${d.getUTCMonth() + 1}-${dom}`
    if (md === '11-11' || md === '12-12') v *= 4.5 // ASSUMPTION: online sale days
    v *= 1 + 0.25 * ((day - START) / 365) // online grows faster
  }
  return v
}

// ---------------------------------------------------------------- branches and customers
type Branch = { name: string; format: string; state: string; district: string; region: string; weight: number }
const REGION: Record<string, string> = {
  Perlis: 'Northern', Kedah: 'Northern', 'Pulau Pinang': 'Northern', Perak: 'Northern',
  Selangor: 'Central', 'W.P. Kuala Lumpur': 'Central', 'W.P. Putrajaya': 'Central', 'Negeri Sembilan': 'Central',
  Melaka: 'Southern', Johor: 'Southern', Pahang: 'East Coast', Terengganu: 'East Coast', Kelantan: 'East Coast',
  Sabah: 'East Malaysia', Sarawak: 'East Malaysia', 'W.P. Labuan': 'East Malaysia',
}
const B = (state: string, district: string, format: string, label = district): Branch => ({
  name: `Kedai Amber ${label}`, format, state, district, region: REGION[state], weight: format === 'Hypermarket' ? 2.3 : format === 'Supermarket' ? 1.3 : 0.7,
})
// Real state and district names (PriceCatcher premise lookup); branch names are invented.
const BRANCHES: Branch[] = [
  B('W.P. Kuala Lumpur', 'Bukit Bintang', 'Supermarket'), B('W.P. Kuala Lumpur', 'Cheras', 'Mini-market'),
  B('Selangor', 'Petaling', 'Hypermarket'), B('Selangor', 'Hulu Langat', 'Supermarket'), B('Selangor', 'Klang', 'Mini-market'),
  B('Johor', 'Johor Bahru', 'Hypermarket'), B('Johor', 'Batu Pahat', 'Mini-market'), B('Pulau Pinang', 'Timur Laut', 'Supermarket', 'Georgetown'),
  B('Perak', 'Kinta', 'Supermarket', 'Ipoh'), B('Kedah', 'Kota Setar', 'Mini-market', 'Alor Setar'), B('Pahang', 'Kuantan', 'Supermarket'),
  B('Kelantan', 'Kota Bharu', 'Mini-market'), B('Melaka', 'Melaka Tengah', 'Supermarket', 'Melaka'), B('Sabah', 'Kota Kinabalu', 'Supermarket'),
  B('Sarawak', 'Kuching', 'Supermarket'),
]
const ONLINE: Omit<Branch, 'state' | 'district' | 'region'> = { name: 'Kedai Amber Online', format: 'Online', weight: 0 }
const branchWeights = BRANCHES.map((b) => b.weight)

type Member = { id: string; home: Branch; rate: number; drop: number; join: number; online: number; active: boolean }
const members: Member[] = Array.from({ length: MEMBERS }, (_, i) => ({
  id: `M${String(10001 + i)}`,
  home: pick(BRANCHES, branchWeights),
  // ASSUMPTION (BG/NBD-style): gamma-distributed weekly purchase rates, beta-ish drop-off after each order
  rate: gamma(0.8, 0.12),
  drop: Math.min(0.6, gamma(1.3, 0.065)),
  join: chance(0.35) ? START : Math.floor(START + rand() * (END - START - 30)),
  online: chance(0.22) ? between(0.25, 0.7) : 0,
  active: true,
}))

// ---------------------------------------------------------------- orders
type Line = Record<string, string | number>
const lines: Line[] = []
let orderSeq = 0
const priceOn = (it: Item, day: number) => it.price * Math.pow(1.02, (day - START) / 365) // ASSUMPTION: 2% yearly drift

function basket(day: number, format: string, online: boolean): { it: Item; qty: number }[] {
  const fest = festival(day)
  const mean = online ? 6.5 : format === 'Hypermarket' ? 7 : format === 'Supermarket' ? 4.6 : 2.6 // ASSUMPTION
  const n = 1 + negbin(mean - 1, 1.6)
  const chosen = new Map<string, { it: Item; qty: number }>()
  const add = (it: Item) => {
    const w = kg(it.unit)
    const qty = w && w >= 1 ? 1 + (chance(0.18) ? 1 : 0) : 1 + negbin(online ? 0.9 : 0.55, 1.2)
    const cur = chosen.get(it.code)
    if (cur) cur.qty += 1
    else chosen.set(it.code, { it, qty })
  }
  if (chance(online ? 0.5 : 0.36)) {
    const [a, b] = pick(plantedPairs)
    add(a)
    add(b)
  }
  while (chosen.size < n) {
    if (fest.cats.length && chance(0.35)) {
      const list = fest.cats.flatMap((c) => byCat.get(c) ?? [])
      if (list.length) add(pick(list, list.map((x) => x.weight)))
    } else add(pick(items, itemWeights))
  }
  return [...chosen.values()]
}

function emit(day: number, branch: Branch, format: string, customer: string, online: boolean) {
  orderSeq++
  const year = new Date(day * 86_400_000).getUTCFullYear()
  const id = `KA-${year}-${String(orderSeq).padStart(6, '0')}`
  const festive = festival(day).lift > 1
  const rows = basket(day, format, online).map(({ it, qty }) => {
    const unit = Math.round(priceOn(it, day) * 100) / 100
    // ASSUMPTION: about 15% of lines on promotion, 28% in the fortnight before a festival
    const discount = chance(festive ? 0.28 : 0.15) ? pick([0.1, 0.15, 0.2, 0.25, 0.3], [5, 4, 3, 1.5, 1]) : 0
    const sales = Math.round(qty * unit * (1 - discount) * 100) / 100
    const cost = Math.round(qty * unit * (1 - it.margin) * 100) / 100
    return { it, qty, unit, discount, sales, cost }
  })
  const base = {
    'Order ID': id,
    'Order Date': new Date(day * 86_400_000).toISOString().slice(0, 10),
    'Customer ID': customer,
    Branch: online ? ONLINE.name : branch.name,
    'Store Format': online ? 'Online' : format,
    Region: branch.region,
    State: branch.state,
    District: branch.district,
  }
  for (const r of rows) {
    lines.push({ ...base, 'Product ID': r.it.code, 'Product Name': r.it.name, Category: r.it.group, 'Sub-Category': CAT_EN[r.it.cat] ?? title(r.it.cat), Quantity: r.qty, 'Unit Price (RM)': r.unit.toFixed(2), Discount: r.discount.toFixed(2), 'Sales (RM)': r.sales.toFixed(2), 'Profit (RM)': (r.sales - r.cost).toFixed(2) })
  }
  // ASSUMPTION: returns are rare for groceries; 2.5% of in-store and 6% of online orders send one line back 1–10 days later
  if (chance(online ? 0.06 : 0.025) && day + 10 <= END) {
    const r = pick(rows)
    const back = day + 1 + Math.floor(rand() * 10)
    const qty = Math.max(1, Math.min(r.qty, 1 + (chance(0.2) ? 1 : 0)))
    const sales = Math.round(qty * r.unit * (1 - r.discount) * 100) / 100
    const cost = Math.round(qty * r.unit * (1 - r.it.margin) * 100) / 100
    lines.push({ ...base, 'Order ID': `R-${id}`, 'Order Date': new Date(back * 86_400_000).toISOString().slice(0, 10), 'Product ID': r.it.code, 'Product Name': r.it.name, Category: r.it.group, 'Sub-Category': CAT_EN[r.it.cat] ?? title(r.it.cat), Quantity: -qty, 'Unit Price (RM)': r.unit.toFixed(2), Discount: r.discount.toFixed(2), 'Sales (RM)': (-sales).toFixed(2), 'Profit (RM)': (-(sales - cost)).toFixed(2) })
  }
}

const WALKINS_PER_DAY = 2.2 // ASSUMPTION: shoppers who do not scan a member card
for (let day = START; day <= END; day++) {
  const store = intensity(day, false)
  const web = intensity(day, true)
  for (const m of members) {
    if (!m.active || day < m.join) continue
    const online = m.online > 0 && chance(m.online)
    if (!chance(Math.min(0.9, (m.rate / 7) * (online ? web : store)))) continue
    emit(day, m.home, m.home.format, m.id, online)
    if (chance(m.drop)) m.active = false
  }
  for (let k = poisson(WALKINS_PER_DAY * store); k > 0; k--) {
    const b = pick(BRANCHES, branchWeights)
    emit(day, b, b.format, '', false)
  }
}

lines.sort((a, b) => (a['Order Date'] as string).localeCompare(b['Order Date'] as string) || (a['Order ID'] as string).localeCompare(b['Order ID'] as string))
const csv = Papa.unparse(lines)
writeFileSync(OUT, `${csv}\n`)
const orders = new Set(lines.filter((l) => +l['Sales (RM)'] > 0).map((l) => l['Order ID'])).size
const returns = lines.filter((l) => +l['Sales (RM)'] < 0).length
const net = lines.reduce((a, l) => a + +l['Sales (RM)'], 0)
console.log(`${lines.length.toLocaleString('en')} lines, ${orders.toLocaleString('en')} orders, ${returns} return lines, net RM ${net.toLocaleString('en', { maximumFractionDigits: 0 })}`)
console.log(`${(Buffer.byteLength(csv) / 1e6).toFixed(1)} MB -> ${OUT}`)
console.log(`sha256 ${createHash('sha256').update(readFileSync(OUT)).digest('hex')}`)
