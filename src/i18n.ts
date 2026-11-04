// Bahasa Malaysia, as a layer over the page. The app is written in English; when Malay is on,
// every visible text and label is swapped for its Malay version as it appears, and swapped back
// when English is picked again. Shop data (product, category and customer names) is left as it
// is in the file. Exact phrases come first, then sentence patterns, then dates.
//
// The Malay here was written for this app and still needs a review by a native speaker.

export type Lang = 'en' | 'ms'

const KEY = 'retailai-lang'

export function savedLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ms' ? 'ms' : 'en'
  } catch {
    return 'en'
  }
}

// ------------------------------------------------------------------ words

const MONTH_SHORT: Record<string, string> = { Jan: 'Jan', Feb: 'Feb', Mar: 'Mac', Apr: 'Apr', May: 'Mei', Jun: 'Jun', Jul: 'Jul', Aug: 'Ogo', Sep: 'Sep', Sept: 'Sep', Oct: 'Okt', Nov: 'Nov', Dec: 'Dis' }
const MONTH_LONG: Record<string, string> = {
  January: 'Januari',
  February: 'Februari',
  March: 'Mac',
  April: 'April',
  May: 'Mei',
  June: 'Jun',
  July: 'Julai',
  August: 'Ogos',
  September: 'September',
  October: 'Oktober',
  November: 'November',
  December: 'Disember',
}
const DAY_SHORT: Record<string, string> = { Mon: 'Isn', Tue: 'Sel', Wed: 'Rab', Thu: 'Kha', Fri: 'Jum', Sat: 'Sab', Sun: 'Ahd' }
const DAY_LONG: Record<string, string> = { Monday: 'Isnin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Khamis', Friday: 'Jumaat', Saturday: 'Sabtu', Sunday: 'Ahad' }
const DAYS_PLURAL: Record<string, string> = { Mondays: 'hari Isnin', Tuesdays: 'hari Selasa', Wednesdays: 'hari Rabu', Thursdays: 'hari Khamis', Fridays: 'hari Jumaat', Saturdays: 'hari Sabtu', Sundays: 'hari Ahad' }

// Malay nouns do not change for plurals.
const NOUN: Record<string, string> = {
  order: 'pesanan',
  orders: 'pesanan',
  customer: 'pelanggan',
  customers: 'pelanggan',
  row: 'baris',
  rows: 'baris',
  product: 'produk',
  products: 'produk',
  week: 'minggu',
  weeks: 'minggu',
  month: 'bulan',
  months: 'bulan',
  day: 'hari',
  days: 'hari',
  year: 'tahun',
  years: 'tahun',
  column: 'lajur',
  columns: 'lajur',
  category: 'kategori',
  categories: 'kategori',
  'sub-category': 'subkategori',
  'sub-categories': 'subkategori',
  region: 'wilayah',
  regions: 'wilayah',
  segment: 'segmen',
  segments: 'segmen',
  state: 'negeri',
  states: 'negeri',
  city: 'bandar',
  cities: 'bandar',
  item: 'item',
  items: 'item',
  choice: 'pilihan',
  choices: 'pilihan',
  'order line': 'baris pesanan',
  'order lines': 'baris pesanan',
  'order day': 'hari pesanan',
  'order days': 'hari pesanan',
  'line item': 'item baris',
  'line items': 'item baris',
  branch: 'cawangan',
  branches: 'cawangan',
  'regular buyer': 'pembeli tetap',
  'regular buyers': 'pembeli tetap',
  point: 'mata',
  points: 'mata',
}
const NOUNS = Object.keys(NOUN).sort((a, b) => b.length - a.length).map((n) => n.replace(/[-]/g, '\\-')).join('|')

const DIM: Record<string, string> = {
  category: 'kategori',
  'sub-category': 'subkategori',
  region: 'wilayah',
  segment: 'segmen',
  state: 'negeri',
  city: 'bandar',
  product: 'produk',
  channel: 'saluran',
  branch: 'cawangan',
  country: 'negara',
}
const dim = (s: string) => DIM[s.toLowerCase()] ?? s

// ------------------------------------------------------------------ exact phrases

const EXACT: Record<string, string> = {
  // Shell
  'Skip to the screen': 'Langkau ke skrin',
  'RetailAI sales console': 'Konsol jualan RetailAI',
  'RetailAI Sales Console': 'Konsol Jualan RetailAI',
  'Fictional sample': 'Sampel rekaan',
  'Real data': 'Data sebenar',
  'Synthetic data': 'Data sintetik',
  Report: 'Laporan',
  'Open a file': 'Buka fail',
  Overview: 'Ringkasan',
  'Sales mix': 'Campuran jualan',
  Forecast: 'Ramalan',
  Customers: 'Pelanggan',
  Products: 'Produk',
  Data: 'Data',
  'Filter the data': 'Tapis data',
  'More below': 'Lagi di bawah',
  'Notes on this screen': 'Nota skrin ini',
  'Notes for this screen': 'Nota untuk skrin ini',
  'More on this screen': 'Lagi di skrin ini',
  Printed: 'Dicetak',
  'Do next': 'Langkah seterusnya',
  'Worked out from your rows': 'Dikira daripada baris anda',
  Last: 'Tempoh',
  weeks: 'minggu terakhir',
  Everything: 'Semua',
  'Custom dates': 'Pilih tarikh',
  'Drag an edge or the lit window to change the dates': 'Seret tepi atau tetingkap bercahaya untuk menukar tarikh',
  'Drag an edge to change the dates, drag the lit window to slide it, or click anywhere on the timeline to move there':
    'Seret tepi untuk menukar tarikh, seret tetingkap bercahaya untuk menggelongsor, atau klik di mana-mana pada garis masa untuk ke situ',
  'Sample stores': 'Kedai sampel',
  'Try the app on a ready-made store, or open your own file.': 'Cuba aplikasi ini dengan kedai sedia ada, atau buka fail anda sendiri.',
  Close: 'Tutup',
  'Open my own file': 'Buka fail saya sendiri',
  'RetailAI runs entirely in your browser and needs JavaScript turned on.': 'RetailAI berjalan sepenuhnya dalam pelayar anda dan memerlukan JavaScript dihidupkan.',
  'Switch to another sample store': 'Tukar ke kedai sampel lain',
  'Jump to anything': 'Lompat ke mana-mana',
  'Jump to any screen, product, customer or filter. Shortcut: Ctrl+K': 'Lompat ke mana-mana skrin, produk, pelanggan atau penapis. Pintasan: Ctrl+K',
  'Copy a link to this view': 'Salin pautan ke paparan ini',
  'Copy a link that opens exactly this view: store, period, filters and screen': 'Salin pautan yang membuka paparan ini tepat: kedai, tempoh, penapis dan skrin',
  'Open the printable report. Shortcut: P': 'Buka laporan boleh cetak. Pintasan: P',
  'Open your own CSV or Excel file. Shortcut: U': 'Buka fail CSV atau Excel anda sendiri. Pintasan: U',
  'Switch to dark mode': 'Tukar ke mod gelap',
  'Switch to light mode': 'Tukar ke mod cerah',
  'Dark mode': 'Mod gelap',
  'Light mode': 'Mod cerah',
  Screens: 'Skrin',
  'Choose a period': 'Pilih tempoh',
  'Number of recent weeks to show': 'Bilangan minggu terkini untuk dipaparkan',
  'Period start': 'Mula tempoh',
  'Period end': 'Akhir tempoh',
  'Got it': 'Faham',
  Next: 'Seterusnya',
  Back: 'Kembali',
  Done: 'Siap',
  'Clear all': 'Kosongkan semua',
  All: 'Semua',
  Filters: 'Penapis',
  'Show everything': 'Tunjuk semua',
  'Clear the period and all filters': 'Kosongkan tempoh dan semua penapis',
  'Jump to a screen, product, customer or filter': 'Lompat ke skrin, produk, pelanggan atau penapis',
  'Nothing matches. Try fewer letters.': 'Tiada padanan. Cuba huruf yang lebih sedikit.',
  move: 'gerak',
  open: 'buka',
  close: 'tutup',
  Actions: 'Tindakan',
  Periods: 'Tempoh',
  'Open a file ': 'Buka fail',
  'Filter the data ': 'Tapis data',
  'Switch sample store': 'Tukar kedai sampel',
  'Superstore, UK online, Kedai Amber': 'Superstore, kedai dalam talian UK, Kedai Amber',
  'Regions, categories and more': 'Wilayah, kategori dan lagi',
  'CSV or Excel, read in this tab only': 'CSV atau Excel, dibaca dalam tab ini sahaja',
  'A printable summary of the current view': 'Ringkasan boleh cetak bagi paparan semasa',
  'Anyone who opens it sees exactly this': 'Sesiapa yang membukanya melihat paparan yang sama',
  'Headline numbers for the selected period': 'Angka utama untuk tempoh dipilih',
  'Where revenue comes from, and when': 'Dari mana hasil datang, dan bila',
  'Weekly outlook with error bands': 'Unjuran mingguan dengan jalur ralat',
  'Segments, retention and next purchases': 'Segmen, pengekalan dan pembelian seterusnya',
  'Baskets, look-alikes and best sellers': 'Bakul, produk serupa dan paling laris',
  'Columns, quality and methods': 'Lajur, kualiti dan kaedah',
  'Language: English': 'Bahasa: Inggeris',
  'Bahasa Malaysia': 'Bahasa Malaysia',
  'Pinned. Click empty space to let go.': 'Disemat. Klik ruang kosong untuk lepaskan.',
  'Let go of this card': 'Lepaskan kad ini',
  'What does this mean?': 'Apakah maksudnya?',
  To: 'Hingga',
  From: 'Dari',
  to: 'hingga',
  and: 'dan',
  of: 'daripada',
  in: 'dalam',
  on: 'berbanding',
  'Over the next': 'Dalam',
  by: 'mengikut',
  or: 'atau',
  'Show these dates': 'Tunjuk tarikh ini',
  'Or a whole year': 'Atau setahun penuh',
  'A whole year': 'Setahun penuh',
  'Choose dates': 'Pilih tarikh',
  'Your data runs from': 'Data anda bermula dari',
  'day/month/year': 'hari/bulan/tahun',

  // Overview
  'Net sales': 'Jualan bersih',
  'This period': 'Tempoh ini',
  'Average order': 'Purata pesanan',
  'on the previous period.': 'berbanding tempoh sebelumnya.',
  'on the same weeks last year.': 'berbanding minggu yang sama tahun lepas.',
  'Previous period': 'Tempoh sebelumnya',
  'Same time last year': 'Masa sama tahun lepas',
  'Compare with': 'Bandingkan dengan',
  'Week by week': 'Minggu demi minggu',
  'Last year': 'Tahun lepas',
  'Unusual week': 'Minggu luar biasa',
  'Unusual weeks': 'Minggu luar biasa',
  About: 'Kira-kira',
  'a week': 'seminggu',
  'Half are under': 'Separuh di bawah',
  'came back,': 'kembali,',
  new: 'baharu',
  'What stands out': 'Apa yang menonjol',
  'Shares and unusual weeks': 'Bahagian dan minggu luar biasa',
  'Sales jumped': 'Jualan melonjak',
  'Sales grew': 'Jualan meningkat',
  'Sales fell': 'Jualan menurun',
  'Sales dropped': 'Jualan jatuh',
  'Sales held steady': 'Jualan kekal stabil',
  '. A few big orders lift the average.': '. Beberapa pesanan besar menaikkan purata.',
  'Check Forecast to see whether the rise is likely to hold.': 'Semak Ramalan untuk melihat sama ada kenaikan ini mungkin kekal.',
  'Check Forecast to see whether the fall is likely to last.': 'Semak Ramalan untuk melihat sama ada penurunan ini mungkin berterusan.',
  'Where sales come from': 'Dari mana jualan datang',
  Region: 'Wilayah',
  Segment: 'Segmen',
  Category: 'Kategori',
  'Sub-category': 'Subkategori',
  State: 'Negeri',
  City: 'Bandar',
  Product: 'Produk',
  Channel: 'Saluran',
  Branch: 'Cawangan',
  Country: 'Negara',
  'of sales.': 'daripada jualan.',
  'of sales': 'daripada jualan',
  'of net sales.': 'daripada jualan bersih.',
  'sold,': 'dijual,',
  sold: 'dijual',
  returned: 'dipulangkan',
  Returns: 'Pulangan',
  Margin: 'Margin',
  bring: 'membawa',
  brings: 'membawa',
  'the most, at': 'paling banyak, iaitu',
  'dominates, with': 'mendominasi, dengan',
  'of sales came from': 'daripada jualan datang dari',
  'kept from': 'disimpan daripada',
  'profit per order': 'untung setiap pesanan',
  up: 'naik',
  down: 'turun',
  'All unusual weeks': 'Semua minggu luar biasa',
  'How much the top products carry': 'Sejauh mana produk teratas menampung jualan',
  'The top fifth of your': 'Seperlima teratas',
  'Share by category': 'Bahagian mengikut kategori',
  'Share by region': 'Bahagian mengikut wilayah',
  'Everything else': 'Lain-lain',
  'Week ending': 'Minggu berakhir',
  'week ending': 'minggu berakhir',
  'Forecast, ': 'Ramalan, ',
  ' (partial week)': ' (minggu separa)',
  'Orders each week, latest week lit': 'Pesanan setiap minggu, minggu terkini bercahaya',
  Orders: 'Pesanan',
  Sales: 'Jualan',
  'Sales (RM)': 'Jualan (RM)',
  'No week in this view sits far outside the 12 weeks before it.': 'Tiada minggu dalam paparan ini yang jauh berbeza daripada 12 minggu sebelumnya.',

  // Sales mix
  'Pick a bar to filter every screen': 'Pilih bar untuk menapis setiap skrin',
  'Tip: pick any bar to show only that group on every screen. Pick it again, press Esc, or use Show all to go back.':
    'Petua: pilih mana-mana bar untuk menunjukkan kumpulan itu sahaja di setiap skrin. Pilih sekali lagi, tekan Esc, atau guna Tunjuk semua untuk kembali.',
  'Sales mix notes': 'Nota campuran jualan',
  'When and how concentrated': 'Bila dan sejauh mana tertumpu',
  'Group sales by': 'Kumpulkan jualan mengikut',
  Row: 'Baris',
  'The top': 'Teratas',
  'Average daily sales by weekday and month': 'Purata jualan harian mengikut hari dan bulan',
  'Sales concentration across products': 'Penumpuan jualan merentas produk',
  'Cumulative share of sales by ranked products': 'Bahagian kumulatif jualan mengikut kedudukan produk',
  'How long orders take to ship': 'Berapa lama pesanan diposkan',
  'Median days to ship': 'Median hari untuk penghantaran',
  'Same day': 'Hari yang sama',
  'Half of': 'Separuh daripada',
  'orders ship within': 'pesanan dihantar dalam',
  'of being placed, and nine in ten within': 'selepas dibuat, dan sembilan daripada sepuluh dalam',
  'Margin by sub-category': 'Margin mengikut subkategori',

  // Forecast
  'Likely range': 'Julat berkemungkinan',
  'Forecast for': 'Ramalan untuk',
  'Everything in the current filters': 'Semua dalam penapis semasa',
  'History and outlook': 'Sejarah dan unjuran',
  Actual: 'Sebenar',
  'Same weeks last year': 'Minggu yang sama tahun lepas',
  'Same week last year': 'Minggu yang sama tahun lepas',
  'the same weeks last year': 'minggu yang sama tahun lepas',
  'weeks: about': 'minggu: kira-kira',
  Method: 'Kaedah',
  'How the forecast was made': 'Bagaimana ramalan dibuat',
  'Weeks ahead': 'Minggu ke hadapan',
  'Recent average': 'Purata terkini',
  'Similar past weeks': 'Minggu lalu yang serupa',
  'Nearest-neighbour on recent weeks': 'Jiran terdekat pada minggu terkini',
  'Model replay': 'Ulang tayang model',
  'Models ranked by backtest error': 'Model disusun mengikut ralat ujian balik',
  'Lower is better. WAPE is total absolute error divided by total actual sales, over': 'Lebih rendah lebih baik. WAPE ialah jumlah ralat mutlak dibahagi jumlah jualan sebenar, merentas',
  'past weeks. The small bars show error growing with the horizon.': 'minggu lalu. Bar kecil menunjukkan ralat bertambah mengikut jangka masa.',
  'Four-week outlook': 'Unjuran empat minggu',
  'Plan for the low end of the range: weeks here swing a lot.': 'Rancang untuk hujung bawah julat: minggu di sini banyak berubah.',

  // Customers
  champions: 'juara',
  Champions: 'Juara',
  Loyal: 'Setia',
  'New or returning': 'Baharu atau kembali',
  'Needs a nudge': 'Perlu dorongan',
  'At risk': 'Berisiko',
  'at risk': 'berisiko',
  Lapsed: 'Tidak aktif',
  'Bought recently and often': 'Beli baru-baru ini dan kerap',
  'Buy regularly, fairly recent': 'Beli secara tetap, agak baru-baru ini',
  'Very recent, few orders so far': 'Sangat baru, sedikit pesanan setakat ini',
  'Middling recency and frequency': 'Kebaharuan dan kekerapan sederhana',
  'Used to buy often, not lately': 'Dulu kerap membeli, kebelakangan ini tidak',
  'Few orders, long ago': 'Sedikit pesanan, sudah lama',
  'Thank them and ask for reviews or referrals.': 'Ucap terima kasih dan minta ulasan atau rujukan.',
  'Offer bundles from the sub-categories they already buy.': 'Tawarkan pakej daripada subkategori yang sudah mereka beli.',
  'Follow up within a few weeks to earn a second order.': 'Susuli dalam beberapa minggu untuk mendapat pesanan kedua.',
  'A timely reminder or limited offer.': 'Peringatan tepat pada masanya atau tawaran terhad.',
  'Win-back message before they lapse for good.': 'Hantar mesej memenangi semula sebelum mereka hilang terus.',
  'Low-cost reactivation only; do not over-spend here.': 'Pengaktifan semula kos rendah sahaja; jangan berbelanja lebih di sini.',
  'Tip: pick a group of customers, then a person in it, to see what to offer them next.': 'Petua: pilih satu kumpulan pelanggan, kemudian seorang di dalamnya, untuk melihat apa yang patut ditawarkan seterusnya.',
  'Every customer, by how recently and how often they buy': 'Setiap pelanggan, mengikut kebaharuan dan kekerapan mereka membeli',
  'Bigger dot, bigger spender. Click a dot to pick that customer.': 'Titik lebih besar, perbelanjaan lebih besar. Klik titik untuk memilih pelanggan itu.',
  'Bought more recently': 'Membeli lebih baru-baru ini',
  'Find any customer': 'Cari mana-mana pelanggan',
  Customer: 'Pelanggan',
  'Last order': 'Pesanan terakhir',
  'Download all': 'Muat turun semua',
  'What to offer': 'Apa yang patut ditawarkan kepada',
  'in total, last bought': 'secara keseluruhan, terakhir membeli',
  'Customer health': 'Kesihatan pelanggan',
  'Days between orders': 'Hari antara pesanan',
  'Bought more than once': 'Membeli lebih sekali',
  'Recency and retention': 'Kebaharuan dan pengekalan',
  'Customers by recency and frequency': 'Pelanggan mengikut kebaharuan dan kekerapan',
  'Customer segments': 'Segmen pelanggan',
  'Who is still buying': 'Siapa yang masih membeli',
  'More recent': 'Lebih baru',
  'Order more often': 'Lebih kerap memesan',
  'Return rate by first-purchase quarter': 'Kadar kembali mengikut suku tahun pembelian pertama',
  'Each row is customers whose first order fell in that quarter, with how many there were. Columns are quarters after their first order. Blank cells are still in the future.':
    'Setiap baris ialah pelanggan yang pesanan pertamanya dalam suku tahun itu, dengan bilangannya. Lajur ialah suku tahun selepas pesanan pertama. Petak kosong masih di masa hadapan.',
  'Customers by recency score (rows) and frequency score (columns)': 'Pelanggan mengikut skor kebaharuan (baris) dan skor kekerapan (lajur)',
  "Share of each quarter's new customers who bought again in later quarters": 'Bahagian pelanggan baharu setiap suku tahun yang membeli semula pada suku tahun kemudian',
  'Start': 'Mula',
  'Biggest customers in this period': 'Pelanggan terbesar dalam tempoh ini',
  'No customer name or ID matches. Try fewer letters.': 'Tiada nama atau ID pelanggan yang sepadan. Cuba huruf yang lebih sedikit.',
  'Nobody falls in this segment for the current view.': 'Tiada sesiapa dalam segmen ini untuk paparan semasa.',
  'Most customers here are new or occasional.': 'Kebanyakan pelanggan di sini baharu atau sekali-sekala.',
  'start with the At risk list below.': 'mulakan dengan senarai Berisiko di bawah.',
  'of sales. A win-back message now costs less than finding new customers;': 'daripada jualan. Mesej memenangi semula kini lebih murah daripada mencari pelanggan baharu;',
  'still bring': 'masih membawa',
  'regular buyers have gone quiet.': 'pembeli tetap sudah senyap.',
  'regular buyer has gone quiet.': 'pembeli tetap sudah senyap.',
  'They brought': 'Mereka membawa',
  'of the': 'daripada',
  'in this period bought more than once.': 'dalam tempoh ini membeli lebih sekali.',
  'Tested on this sample store: these ideas matched a later purchase for': 'Diuji pada kedai sampel ini: cadangan ini sepadan dengan pembelian kemudian bagi',
  '% of customers, below the': '% pelanggan, lebih rendah daripada',
  '% for simply showing best sellers. Treat them as conversation starters.': '% jika hanya menunjukkan produk paling laris. Anggap ia sebagai pembuka perbualan.',
  'Popular in the same sub-category': 'Popular dalam subkategori yang sama',
  'Popular in a sub-category they buy': 'Popular dalam subkategori yang mereka beli',
  'Bought by similar customers': 'Dibeli oleh pelanggan serupa',
  'Best seller overall': 'Paling laris keseluruhan',
  'Often bought with their items': 'Sering dibeli bersama item mereka',

  // Products
  'Look up any product': 'Cari mana-mana produk',
  'Tip: search any product or narrow by category. The three lists show what sells with it, best sellers like it, and similar items.':
    'Petua: cari mana-mana produk atau kecilkan mengikut kategori. Tiga senarai menunjukkan apa yang dijual bersamanya, produk laris yang serupa, dan item serupa.',
  'Bought in the same order': 'Dibeli dalam pesanan yang sama',
  'Similar description': 'Penerangan serupa',
  'Product finder': 'Pencari produk',
  'What sells together': 'Apa yang dijual bersama',
  'All categories': 'Semua kategori',
  'Any sub-category': 'Mana-mana subkategori',
  'Narrow by category': 'Kecilkan mengikut kategori',
  'Narrow by sub-category': 'Kecilkan mengikut subkategori',
  'Best sellers': 'Paling laris',
  'Best sellers in its sub-category': 'Paling laris dalam subkategorinya',
  'No product name matches. Try fewer letters.': 'Tiada nama produk yang sepadan. Cuba huruf yang lebih sedikit.',
  'Nothing here matches. Try All categories.': 'Tiada padanan di sini. Cuba Semua kategori.',
  'No other order contains this item yet.': 'Belum ada pesanan lain yang mengandungi item ini.',
  'This item has no sub-category to compare within.': 'Item ini tiada subkategori untuk dibandingkan.',
  'No other product shares words with this one.': 'Tiada produk lain yang berkongsi perkataan dengan produk ini.',
  'Single items bought together more than once': 'Item tunggal yang dibeli bersama lebih sekali',
  'Sub-categories bought in the same order': 'Subkategori yang dibeli dalam pesanan yang sama',
  'vs chance': 'berbanding kebetulan',
  'How many times more often they share an order than if people bought them independently': 'Berapa kali lebih kerap ia berkongsi pesanan berbanding jika dibeli secara berasingan',
  'Save these pairs as a CSV': 'Simpan pasangan ini sebagai CSV',
  'Treat the lists as ideas: on later orders here, none beat plain best sellers.': 'Anggap senarai ini sebagai idea: pada pesanan kemudian di sini, tiada yang mengatasi produk paling laris biasa.',
  'Search any product above to see what sells with it.': 'Cari mana-mana produk di atas untuk melihat apa yang dijual bersamanya.',
  'Lead with single-item offers: most orders here hold one product, so bundles may not move.': 'Utamakan tawaran item tunggal: kebanyakan pesanan di sini hanya satu produk, jadi pakej mungkin kurang laku.',
  'No two sub-categories in this view share orders more often than chance would suggest. Widen the period or clear filters to find pairs.':
    'Tiada dua subkategori dalam paparan ini yang berkongsi pesanan lebih kerap daripada kebetulan. Luaskan tempoh atau kosongkan penapis untuk mencari pasangan.',
  'No two single items appear together in more than one order here, so pairs are shown by sub-category.': 'Tiada dua item tunggal yang muncul bersama dalam lebih daripada satu pesanan di sini, jadi pasangan ditunjukkan mengikut subkategori.',
  'How well this works here: on later orders, bought-together guessed another item in the basket': 'Sejauh mana ini berkesan di sini: pada pesanan kemudian, dibeli-bersama meneka item lain dalam bakul',
  '% of the time, against': '% daripada masa, berbanding',
  '% for plain best sellers. Baskets rarely repeat in this store, so use pairs as ideas to browse, not predictions.': '% untuk produk paling laris biasa. Bakul jarang berulang di kedai ini, jadi gunakan pasangan sebagai idea untuk dilihat, bukan ramalan.',

  // Data
  'Your file': 'Fail anda',
  'columns understood,': 'lajur difahami,',
  'rows ready.': 'baris sedia.',
  'Nothing needs fixing.': 'Tiada yang perlu dibaiki.',
  'Your file is read in this browser tab and never uploaded anywhere.': 'Fail anda dibaca dalam tab pelayar ini dan tidak dimuat naik ke mana-mana.',
  read: 'dibaca',
  'Columns understood': 'Lajur difahami',
  'Order date': 'Tarikh pesanan',
  'Product name': 'Nama produk',
  'Product ID': 'ID produk',
  'Customer ID': 'ID pelanggan',
  'Customer name': 'Nama pelanggan',
  'Order ID': 'ID pesanan',
  'Ship date': 'Tarikh penghantaran',
  'Line revenue': 'Hasil baris',
  'Unit price': 'Harga seunit',
  Quantity: 'Kuantiti',
  Profit: 'Untung',
  Discount: 'Diskaun',
  Cost: 'Kos',
  'Check the matching': 'Semak padanan',
  Checks: 'Semakan',
  'All clear': 'Semua baik',
  'Some product IDs appear with more than one name; products are grouped by ID.': 'Sesetengah ID produk muncul dengan lebih daripada satu nama; produk dikumpulkan mengikut ID.',
  Ready: 'Sedia',
  rows: 'baris',
  Dates: 'Tarikh',
  Revenue: 'Hasil',
  'See the overview': 'Lihat ringkasan',
  'See the cleaned rows': 'Lihat baris yang dibersihkan',
  'Data check': 'Semakan data',
  'Dates read as': 'Tarikh dibaca sebagai',
  'Revenue from': 'Hasil daripada',
  'Stays in': 'Kekal dalam',
  'this browser tab': 'tab pelayar ini',
  'Open the Overview: every column needed is understood.': 'Buka Ringkasan: setiap lajur yang diperlukan sudah difahami.',
  'Column matching': 'Padanan lajur',
  'Cleaned rows and how numbers are made': 'Baris yang dibersihkan dan cara angka dikira',
  'How your file was read': 'Bagaimana fail anda dibaca',
  'What each column means': 'Maksud setiap lajur',
  'Columns are matched by whole words and then checked against their values. Change any match and apply.': 'Lajur dipadankan mengikut perkataan penuh kemudian disemak dengan nilainya. Tukar mana-mana padanan dan guna.',
  'Not in this file': 'Tiada dalam fail ini',
  'How to read it': 'Cara membacanya',
  'Date order': 'Susunan tarikh',
  'Day / month / year': 'Hari / bulan / tahun',
  'Month / day / year': 'Bulan / hari / tahun',
  'Exact duplicate rows': 'Baris pendua tepat',
  'Column mapping': 'Pemetaan lajur',
  Source: 'Sumber',
  'Licence:': 'Lesen:',
  'Line revenue is calculated as Price × Quantity.': 'Hasil baris dikira sebagai Harga × Kuantiti.',
  'Dates are year-month-day, which reads the same either way.': 'Tarikh dalam bentuk tahun-bulan-hari, yang dibaca sama dalam apa jua cara.',
  'The dates can only be day/month/year.': 'Tarikh hanya boleh hari/bulan/tahun.',
  Apply: 'Guna',
  Keep: 'Simpan',
  Drop: 'Buang',
  'Apply changes': 'Guna perubahan',

  // Report
  'Save as PDF or print': 'Simpan sebagai PDF atau cetak',
  'Back to the console': 'Kembali ke konsol',
  "Your browser's print dialog can save this page as a PDF.": 'Dialog cetak pelayar anda boleh menyimpan halaman ini sebagai PDF.',
  'line items. Every figure is calculated directly from the file with fixed rules.': 'item baris. Setiap angka dikira terus daripada fail dengan peraturan tetap.',
  'previous period': 'tempoh sebelumnya',
  'Weekly net sales': 'Jualan bersih mingguan',
  By: 'Mengikut',
  'Best-selling products': 'Produk paling laris',
  orders: 'pesanan',
  'Share of sales': 'Bahagian jualan',
  'Data notes': 'Nota data',
  'Dates were read as': 'Tarikh dibaca sebagai',
  'Use “Save as PDF or print” above. In the print dialog, choose “Save as PDF” as the destination.': 'Guna “Simpan sebagai PDF atau cetak” di atas. Dalam dialog cetak, pilih “Simpan sebagai PDF” sebagai destinasi.',
  'Printable report': 'Laporan boleh cetak',
  Metric: 'Ukuran',
  'This period ': 'Tempoh ini',
  'not available': 'tiada',

  'Weekly outlook': 'Unjuran mingguan',
  'Download CSV': 'Muat turun CSV',
  Matched: 'Dipadankan',
  'Apply mapping': 'Guna pemetaan',
  'Undo changes': 'Batalkan perubahan',
  Remove: 'Buang',
  Currency: 'Mata wang',
  'US dollar ($)': 'Dolar AS ($)',
  'Malaysian ringgit (RM)': 'Ringgit Malaysia (RM)',
  'Singapore dollar (S$)': 'Dolar Singapura (S$)',
  'Euro (€)': 'Euro (€)',
  'Pound sterling (£)': 'Paun sterling (£)',
  'Indian rupee (₹)': 'Rupee India (₹)',
  'Australian dollar (A$)': 'Dolar Australia (A$)',
  'No currency (plain numbers)': 'Tiada mata wang (nombor biasa)',
  'RetailAI report': 'Laporan RetailAI',
  Generated: 'Dijana',
  'Headline numbers': 'Angka utama',
  Measure: 'Ukuran',
  vs: 'berbanding',
  'vs usual': 'berbanding biasa',
  'Model:': 'Model:',
  '. Replayed error (WAPE)': '. Ralat ulang tayang (WAPE)',
  over: 'merentas',
  'Suggested action': 'Tindakan dicadangkan',
  'Report ready': 'Laporan sedia',
  Sections: 'Bahagian',
  'Holt–Winters (seasonal smoothing)': 'Holt–Winters (pelicinan bermusim)',
  'Seasonal naive (same week last year)': 'Naif bermusim (minggu sama tahun lepas)',
  regular: 'pembeli',
  'buyers have': 'tetap sudah',
  'buyer has': 'tetap sudah',
  'gone quiet.': 'senyap.',
  Likely: 'Berkemungkinan',
  'Popular overall': 'Popular keseluruhan',
  Mostly: 'Kebanyakannya',
  profit: 'untung',
  Median: 'Median',
  Today: 'Hari ini',
  Week: 'Minggu',
  Weeks: 'Minggu',
  Error: 'Ralat',
  'Download all customers': 'Muat turun semua pelanggan',
  Pinned: 'Disemat',
  ...Object.fromEntries(Object.entries(NOUN).map(([k, v]) => [k, v])),
  'Live link': 'Pautan langsung',
  Live: 'Langsung',
  'Or keep it up to date from a Google Sheet': 'Atau sentiasa kemas kini daripada Google Sheet',
  'Paste a Google Sheet or CSV link': 'Tampal pautan Google Sheet atau CSV',
  'Open link': 'Buka pautan',
  Reading: 'Membaca',
  'In Google Sheets choose File, Share, Publish to web, pick CSV, and paste the link here. RetailAI reads it again every time you open the console, so the numbers stay current. Links you copy from here include the sheet address.':
    'Dalam Google Sheets pilih Fail, Kongsi, Terbitkan ke web, pilih CSV, dan tampal pautan di sini. RetailAI membacanya semula setiap kali anda membuka konsol, jadi angka sentiasa terkini. Pautan yang anda salin dari sini termasuk alamat helaian.',
  'Read the sheet again': 'Baca helaian semula',
  'Fetch the latest rows from the live link': 'Ambil baris terkini daripada pautan langsung',
  'Google Sheet': 'Google Sheet',
  'Back to a sample store': 'Kembali ke kedai sampel',
  'Reading the linked sheet': 'Membaca helaian yang dipautkan',
  'The sheet is read straight from its link each time you open RetailAI; nothing is uploaded.': 'Helaian dibaca terus daripada pautannya setiap kali anda membuka RetailAI; tiada yang dimuat naik.',
  'Read in this browser tab only. Nothing is uploaded.': 'Dibaca dalam tab pelayar ini sahaja. Tiada yang dimuat naik.',
  'Read from': 'Dibaca dari',
  'the live link': 'pautan langsung',
  'Your browser was not allowed to read that link. The site has to allow it: Google Sheets does once the sheet is published (File, Share, Publish to web, CSV). For other sites, download the file and open it instead.':
    'Pelayar anda tidak dibenarkan membaca pautan itu. Laman tersebut perlu membenarkannya: Google Sheets membenarkan setelah helaian diterbitkan (Fail, Kongsi, Terbitkan ke web, CSV). Untuk laman lain, muat turun fail dan bukanya.',
  'That sheet is private. In Google Sheets choose File, Share, Publish to web, pick CSV, and paste the link it gives you.': 'Helaian itu peribadi. Dalam Google Sheets pilih Fail, Kongsi, Terbitkan ke web, pilih CSV, dan tampal pautan yang diberikan.',
  'That link opens a web page, not a CSV. In Google Sheets choose File, Share, Publish to web, and pick CSV.': 'Pautan itu membuka halaman web, bukan CSV. Dalam Google Sheets pilih Fail, Kongsi, Terbitkan ke web, dan pilih CSV.',
  'That does not look like a web address. Paste the full link, starting with https://.': 'Itu bukan alamat web. Tampal pautan penuh, bermula dengan https://.',
  'The link returned an empty file.': 'Pautan itu memberikan fail kosong.',
  'The sheet has a header row but no data rows yet.': 'Helaian itu ada baris tajuk tetapi belum ada baris data.',
  Dismiss: 'Tutup',
  // Short weekday headers on the heat grid
  ...DAY_SHORT,
}

// ------------------------------------------------------------------ patterns

type Rule = [RegExp, (...m: string[]) => string]

const n = (s: string) => NOUN[s.toLowerCase()] ?? s
const RULES: Rule[] = [
  [new RegExp(`^([\\d,.]+[KM]?\\+?) (${NOUNS})$`), (_, a, b) => `${a} ${n(b)}`],
  [new RegExp(`^about ([\\d,.]+) (${NOUNS})$`), (_, a, b) => `kira-kira ${a} ${n(b)}`],
  [/^Show all of (.+)$/, (_, a) => `Tunjuk semua ${a}`],
  [/^from (.+)$/, (_, a) => `daripada ${tr(a)}`],
  [/^(.+): Not observed yet$/, (_, a) => `${tr(a)}: Belum diperhatikan`],
  [/^(Q\d \d{4} \(\d+\)), Start: (.+)$/, (_, a, b) => `${a}, Mula: ${b}`],
  [/^(Q\d \d{4} \(\d+\)), \+(\d+): (.+)$/, (_, a, b, c) => `${a}, +${b}: ${c}`],
  [/^Week (\d+): (.+)$/, (_, a, b) => `Minggu ${a}: ${b}`],
  [/^Together in (.+)$/, (_, a) => `Bersama dalam ${tr(a)}`],
  [/^In (.+ orders?)$/, (_, a) => `Dalam ${tr(a)}`],
  [/^(.+) word overlap$/, (_, a) => `${a} perkataan sepadan`],
  [/^Headline numbers for the selected period\. Shortcut: (\d)$/, (_, a) => `Angka utama untuk tempoh dipilih. Pintasan: ${a}`],
  [/^Where revenue comes from, and when\. Shortcut: (\d)$/, (_, a) => `Dari mana hasil datang, dan bila. Pintasan: ${a}`],
  [/^Weekly outlook with error bands\. Shortcut: (\d)$/, (_, a) => `Unjuran mingguan dengan jalur ralat. Pintasan: ${a}`],
  [/^Segments, retention and next purchases\. Shortcut: (\d)$/, (_, a) => `Segmen, pengekalan dan pembelian seterusnya. Pintasan: ${a}`],
  [/^Baskets, look-alikes and best sellers\. Shortcut: (\d)$/, (_, a) => `Bakul, produk serupa dan paling laris. Pintasan: ${a}`],
  [/^Columns, quality and methods\. Shortcut: (\d)$/, (_, a) => `Lajur, kualiti dan kaedah. Pintasan: ${a}`],
  [/^Choose (.+) and more\. Shortcut: F$/, (_, a) => `Pilih ${a.split(', ').map(dim).join(', ')} dan lagi. Pintasan: F`],
  [/^Filtered by (.+)$/, (_, a) => `Ditapis mengikut ${tr(a)}`],
  [/^Filter by (.+)$/, (_, a) => `Tapis mengikut ${dim(a)}`],
  [/^Filter to (.+)$/, (_, a) => `Tapis kepada ${a}`],
  [/^Stop filtering to (.+)$/, (_, a) => `Berhenti menapis kepada ${a}`],
  [/^Net sales (.+)$/, (_, a) => `Jualan bersih ${a}`],
  [/^Average order (.+)$/, (_, a) => `Purata pesanan ${a}`],
  [/^Margin (.+)$/, (_, a) => `Margin ${a}`],
  [/^(.+) returning and (.+) new customers$/, (_, a, b) => `${a} pelanggan kembali dan ${b} baharu`],
  [/^How order values spread up to (.+); the line marks the average$/, (_, a) => `Taburan nilai pesanan sehingga ${a}; garisan menandakan purata`],
  [/^(.+) profit from (.+) sales$/, (_, a, b) => `untung ${a} daripada jualan ${b}`],
  [/^Weekly net sales line chart\. Use the left and right arrow keys to read each week\.$/, () => 'Carta garis jualan bersih mingguan. Guna kekunci anak panah kiri dan kanan untuk membaca setiap minggu.'],
  [/^Weekly net sales\. Use the left and right arrow keys to read each week\.$/, () => 'Jualan bersih mingguan. Guna kekunci anak panah kiri dan kanan untuk membaca setiap minggu.'],
  [/^Weekly sales with a (\d+)-week forecast\. Use the left and right arrow keys to read each week\.$/, (_, a) => `Jualan mingguan dengan ramalan ${a} minggu. Guna kekunci anak panah kiri dan kanan untuk membaca setiap minggu.`],
  [/^For (\d+) weeks both are the same weeks\.$/, (_, a) => `Untuk ${a} minggu, kedua-duanya minggu yang sama.`],
  [/^For a (\d+)-week period the previous period and the same period last year are the same weeks, so they are shown once\.$/, (_, a) => `Untuk tempoh ${a} minggu, tempoh sebelumnya dan tempoh yang sama tahun lepas ialah minggu yang sama, jadi ia ditunjukkan sekali.`],
  [/^No same period last year comparison: the data does not reach back that far\.$/, () => 'Tiada perbandingan dengan tempoh yang sama tahun lepas: data tidak sejauh itu.'],
  [/^Keep best sellers in stock: the top (.+) bring (.+) of sales\.$/, (_, a, b) => `Pastikan stok produk paling laris: ${a} teratas membawa ${b} daripada jualan.`],
  [/^Look into the week ending (.+): (.+) against a usual (.+)$/, (_, a, b, c) => `Siasat minggu berakhir ${date(a)}: ${b} berbanding biasa ${c}`],
  [/^(.+) drove the biggest part of the rise \((.+)\)\.$/, (_, a, b) => `${a} menyumbang bahagian terbesar kenaikan (${b}).`],
  [/^(.+) drove most of the rise \((.+)\)\.$/, (_, a, b) => `${a} menyumbang sebahagian besar kenaikan (${b}).`],
  [/^(.+) drove the biggest part of the fall \((.+)\)\.$/, (_, a, b) => `${a} menyumbang bahagian terbesar penurunan (${b}).`],
  [/^(.+) drove most of the fall \((.+)\)\.$/, (_, a, b) => `${a} menyumbang sebahagian besar penurunan (${b}).`],
  [/^All unusual weeks \((\d+)\)$/, (_, a) => `Semua minggu luar biasa (${a})`],
  [/^A week counts as unusual when it is at least (.+) robust deviations from the median of the previous (\d+) full weeks\.$/, (_, a, b) => `Seminggu dikira luar biasa apabila ia sekurang-kurangnya ${a} sisihan teguh daripada median ${b} minggu penuh sebelumnya.`],
  [/^No week in this view sits far outside the (\d+) weeks before it\.$/, (_, a) => `Tiada minggu dalam paparan ini yang jauh berbeza daripada ${a} minggu sebelumnya.`],
  [/^of sales\. Around (.+) is typical for retail; much higher means a few items carry the store\.$/, (_, a) => `daripada jualan. Sekitar ${a} adalah biasa bagi runcit; jauh lebih tinggi bermakna beberapa item menampung kedai.`],
  [/^The top (.+) of products bring (.+) of sales$/, (_, a, b) => `${a} produk teratas membawa ${b} daripada jualan`],
  [/^Close (.+)$/, (_, a) => `Tutup ${tr(a)}`],
  [/^Revenue share by (.+)$/, (_, a) => `Bahagian hasil mengikut ${dim(a)}`],
  [/^(.+) is next with (.+)\.$/, (_, a, b) => `${a} di tempat kedua dengan ${b}.`],
  [/^Sales run highest on (\w+) in (\w+)\.$/, (_, a, b) => `Jualan paling tinggi pada ${DAYS_PLURAL[a] ?? a} dalam bulan ${MONTH_LONG[b] ?? b}.`],
  [/^Staff up for (\w+) in (\w+), the busiest days\.$/, (_, a, b) => `Tambah pekerja untuk ${DAYS_PLURAL[a] ?? a} dalam bulan ${MONTH_LONG[b] ?? b}, hari paling sibuk.`],
  [/^Pick (.+) to see it on every screen\.$/, (_, a) => `Pilih ${a} untuk melihatnya di setiap skrin.`],
  [/^Review (.+): it brings under (.+) of sales\.$/, (_, a, b) => `Semak semula ${a}: ia membawa kurang daripada ${b} jualan.`],
  [/^Top (\d+) of (\d+) (.+)$/, (_, a, b, c) => `${a} teratas daripada ${b} ${n(c)}`],
  [/^Save sales by (.+) as a CSV$/, (_, a) => `Simpan jualan mengikut ${n(a)} sebagai CSV`],
  [/^(\w+) in (\w+): (.+) on an average day$/, (_, a, b, c) => `${cap(DAYS_PLURAL[a] ?? a)} dalam bulan ${MONTH_LONG[b] ?? b}: ${c} pada hari biasa`],
  [/^(.+) on an average day$/, (_, a) => `${a} pada hari biasa`],
  [/^Brighter means more sales on an average day\. Point at a square for the amount\.$/, () => 'Lebih terang bermakna lebih banyak jualan pada hari biasa. Tuding pada petak untuk melihat jumlahnya.'],
  [/^Brighter means more sales on a(.*)$/, (_, a) => `Lebih terang bermakna lebih banyak jualan pada ${tr(a.trim())}`],
  [/^of sales\. The dashed line is what an even spread would look like\. Point along the curve to read any share\.$/, () => 'daripada jualan. Garis putus-putus menunjukkan taburan sekata. Tuding sepanjang lengkung untuk membaca mana-mana bahagian.'],
  [/^The top (.+) of products bring$/, (_, a) => `${a} produk teratas membawa`],
  [/^Top (.+) of products(.*)$/, (_, a, b) => `${a} produk teratas${b}`],
  [/^(.+) of sales$/, (_, a) => `${a} daripada jualan`],
  [/^(.+) orders, (.+)$/, (_, a, b) => `${a} pesanan, ${b}`],
  [/^(\d+)\+ days$/, (_, a) => `${a}+ hari`],
  [/^(\d+) days?: (.+) orders$/, (_, a, b) => `${a} hari: ${b} pesanan`],
  [/^Same day: (.+)$/, (_, a) => `Hari yang sama: ${a}`],
  [/^Likely range \((.+) in (.+)\)$/, (_, a, b) => `Julat berkemungkinan (${a} dalam ${b})`],
  [/^(\d+)-week outlook$/, (_, a) => `Unjuran ${a} minggu`],
  [/^Last (\d+) weeks$/, (_, a) => `${a} minggu terakhir`],
  [/^Average of last (\d+) weeks$/, (_, a) => `Purata ${a} minggu terakhir`],
  [/^Tip: choose (.+) weeks ahead\. The shaded band is the likely range, and the dashed line is the forecast\.$/, (_, a) => `Petua: pilih ${a.replace(/ or /g, ' atau ')} minggu ke hadapan. Jalur berlorek ialah julat berkemungkinan, dan garis putus-putus ialah ramalan.`],
  [/^Weeks usually land within (.+), so treat it as a guide\.$/, (_, a) => `Minggu biasanya dalam lingkungan ${a}, jadi anggap ia sebagai panduan.`],
  [/^Weeks here swing a lot \(usually (.+)\), so read it as a rough direction only\.$/, (_, a) => `Minggu di sini banyak berubah (biasanya ${a}), jadi baca ia sebagai arah kasar sahaja.`],
  [/^Usually within (.+)$/, (_, a) => `Biasanya dalam ${a}`],
  [/^Stock up: (.+) above the same weeks last year\.$/, (_, a) => `Tambah stok: ${a} lebih tinggi daripada minggu yang sama tahun lepas.`],
  [/^Order less or run a promotion: (.+) below the same weeks last year\.$/, (_, a) => `Pesan kurang atau jalankan promosi: ${a} lebih rendah daripada minggu yang sama tahun lepas.`],
  [/^(-?)week replays from$/, () => '-minggu ulang tayang dari'],
  [/^past starting weeks\. The band shows where (.+) of past errors fell\.$/, (_, a) => `minggu permulaan lalu. Jalur menunjukkan di mana ${a} ralat lalu jatuh.`],
  [/^(.+) regular buyers have gone quiet and are worth a win-back message\.$/, (_, a) => `${a} pembeli tetap sudah senyap dan wajar dihantar mesej memenangi semula.`],
  [/^(.+) regular buyer has gone quiet and is worth a win-back message\.$/, (_, a) => `${a} pembeli tetap sudah senyap dan wajar dihantar mesej memenangi semula.`],
  [/^Win back the (.+) at-risk customers: pick At risk, then Download all\.$/, (_, a) => `Menangi semula ${a} pelanggan berisiko: pilih Berisiko, kemudian Muat turun semua.`],
  [/^Thank your (.+) champions; ask for reviews\.$/, (_, a) => `Ucap terima kasih kepada ${a} juara anda; minta ulasan.`],
  [/^Follow up with (.+) new customers within (.+) days\.$/, (_, a, b) => `Susuli ${a} pelanggan baharu dalam masa ${b} hari.`],
  [/^Follow up with (.+) new customers\.$/, (_, a) => `Susuli ${a} pelanggan baharu.`],
  [/^(.+) \(median\)$/, (_, a) => `${a} (median)`],
  [/^(.+) customers placed by how recently they bought and how often\. (.+) are highlighted\.$/, (_, a, b) => `${a} pelanggan diletakkan mengikut kebaharuan dan kekerapan membeli. ${tr(b)} diserlahkan.`],
  [/^(.+) customers and what to offer them$/, (_, a) => `Pelanggan ${tr(a)} dan apa yang patut ditawarkan`],
  [/^(.+) customers$/, (_, a) => (/^[\d,.]+$/.test(a) ? `${a} pelanggan` : `Pelanggan ${tr(a)}`)],
  [/^Find any of (.+) customers by name or ID$/, (_, a) => `Cari mana-mana daripada ${a} pelanggan mengikut nama atau ID`],
  [/^(.+) order days?; (.+) days since the last one$/, (_, a, b) => `${a} hari pesanan; ${b} hari sejak yang terakhir`],
  [/^Usually orders every (.+) days\. It has been (.+): worth a message now\.$/, (_, a, b) => `Biasanya memesan setiap ${a} hari. Sudah ${b} hari: wajar dihantar mesej sekarang.`],
  [/^Usually orders every (.+) days\. It has been (.+), so they are on track\.$/, (_, a, b) => `Biasanya memesan setiap ${a} hari. Sudah ${b} hari, jadi masih seperti biasa.`],
  [/^(.+) days since their last order\.$/, (_, a) => `${a} hari sejak pesanan terakhir mereka.`],
  [/^What to offer (.+)$/, (_, a) => `Apa yang patut ditawarkan kepada ${a}`],
  [/^(.+), last bought (.+)\.$/, (_, a, b) => `${tr(a)}, terakhir membeli ${date(b)}.`],
  [/^(.+) in total, last bought (.+)\.(.*)$/, (_, a, b, c) => `${tr(a)} secara keseluruhan, terakhir membeli ${date(b)}.${c ? ' ' + tr(c.trim()) : ''}`],
  [/^In (.+)\.$/, (_, a) => `Dalam ${tr(a)}.`],
  [/^(.+), (.+), last (.+)$/, (_, a, b, c) => `${tr(a)}, ${b}, terakhir ${date(c)}`],
  [/^Download all (\d[\d,]*) (.+)$/, (_, a, b) => `Muat turun semua ${a} ${tr(b)}`],
  [/^All (\d+) (.+)$/, (_, a, b) => `Semua ${a} ${n(b)}`],
  [/^(\d+)% band$/, (_, a) => `Jalur ${a}%`],
  [/^Search ([\d,]+) products(?: in (.+))?$/, (_, a, b) => `Cari ${a} produk${b ? ` dalam ${b}` : ''}`],
  [/^Best sellers in (.+)$/, (_, a) => `Paling laris dalam ${a}`],
  [/^People who bought it also picked up (.+)\.$/, (_, a) => `Orang yang membelinya turut mengambil ${a}.`],
  [/^No other order contains it yet, so the lists lean on its (.+)\.$/, (_, a) => `Belum ada pesanan lain yang mengandunginya, jadi senarai bergantung pada ${a === 'sub-category' ? 'subkategorinya' : 'penerangannya'}.`],
  [/^Shelve or bundle it with (.+): they share orders\.$/, (_, a) => `Susun atau pakejkan bersama ${a}: ia berkongsi pesanan.`],
  [/^Orders with (\d)\+ items$/, (_, a) => `Pesanan dengan ${a}+ item`],
  [/^(.+) means two sub-categories land in the same order twice as often as they would if people picked them independently\.$/, (_, a) => `${a} bermaksud dua subkategori berada dalam pesanan yang sama dua kali lebih kerap berbanding jika dipilih secara berasingan.`],
  [/^Sub-categories joined by how often they share an order(.*)$/, (_, a) => `Subkategori dihubungkan mengikut kekerapan berkongsi pesanan${a.replace(/ with /g, ' dengan ').replace(/ times chance/g, ' kali kebetulan')}`],
  [/^Column for (.+)$/, (_, a) => `Lajur untuk ${tr(a)}`],
  [/^Rows with negative revenue are kept as returns or refunds \((.+) in total\)\.$/, (_, a) => `Baris dengan hasil negatif disimpan sebagai pulangan atau bayaran balik (${a} kesemuanya).`],
  [/^Search (.+)$/, (_, a) => `Cari ${dim(a)}`],
  [/^Find a (.+) among (.+)$/, (_, a, b) => `Cari ${dim(a)} antara ${b}`],
  [/^Nothing matches “(.+)”\.$/, (_, a) => `Tiada padanan untuk “${a}”.`],
  [/^Search to see all (.+)$/, (_, a) => `Cari untuk melihat semua ${a}`],
  [/^, before the date range is applied\.$/, () => ', sebelum julat tarikh digunakan.'],
  [/^(.+) rows? match(es)?, before the date range is applied\.$/, (_, a) => `${a} baris sepadan, sebelum julat tarikh digunakan.`],
  [/^match(es)?$/, () => 'sepadan'],
  [/^, top (\d+) shown$/, (_, a) => `, ${a} teratas ditunjukkan`],
  [/^(Region|Category|Segment|State|City|Sub-category|Channel|Branch|Country): (.+)$/, (_, a, b) => `${tr(a)}: ${b}`],
  [/^Customer, (.+)$/, (_, a) => `Pelanggan, ${a}`],
  [/^Filter by (.+)$/, (_, a) => `Tapis mengikut ${dim(a)}`],
  [/^Link copied\. (.+)$/, () => 'Pautan disalin. Ia membuka kedai, tempoh, penapis dan skrin ini.'],
  [/^(.+) % of the time$/, (_, a) => `${a}% daripada masa`],
  [/^Checked on this sample store with the model picked on earlier weeks and scored on later ones:$/, () => 'Disemak pada kedai sampel ini dengan model yang dipilih pada minggu awal dan dinilai pada minggu kemudian:'],
  [/^-week WAPE was$/, () => '-minggu WAPE ialah'],
  [/^% and the (.+) band held$/, (_, a) => `% dan jalur ${a} merangkumi`],
  [/^% of outcomes, so the band is narrower than it should be\. On those later weeks the four models were within$/, () => '% hasil, jadi jalur lebih sempit daripada sepatutnya. Pada minggu kemudian itu, empat model berada dalam lingkungan'],
  [/^% of outcomes, so the band is about right\. On those later weeks the four models were within$/, () => '% hasil, jadi jalur lebih kurang tepat. Pada minggu kemudian itu, empat model berada dalam lingkungan'],
  [/^points of each other, so no model is clearly better than the simple ones\.$/, () => 'mata antara satu sama lain, jadi tiada model yang jelas lebih baik daripada model mudah.'],
  [/^(.+) \(synthetic Malaysian grocer, (.+)\)$/, (_, a, b) => `${a} (kedai runcit Malaysia sintetik, ${b})`],
  [/^Superstore \(US office supplies, (.+)\)$/, (_, a) => `Superstore (bekalan pejabat AS, ${a})`],
  [/^UK online gift shop \(real, (.+)\)$/, (_, a) => `Kedai hadiah dalam talian UK (sebenar, ${a})`],
  [/^(.+) order lines from a fictional US retailer of office supplies, furniture and technology\.$/, (_, a) => `${a} baris pesanan daripada peruncit rekaan AS yang menjual bekalan pejabat, perabot dan teknologi.`],
  [/^Four years of trends, regions and segments\. No quantities, costs or returns\.$/, () => 'Empat tahun trend, wilayah dan segmen. Tiada kuantiti, kos atau pulangan.'],
  [/^(.+) real invoice lines from (.+) customers of a UK online gift retailer, one year\.$/, (_, a, b) => `${a} baris invois sebenar daripada ${b} pelanggan peruncit hadiah dalam talian UK, setahun.`],
  [/^Genuine returns, big baskets and real repeat buying\. No categories or costs\.$/, () => 'Pulangan sebenar, bakul besar dan pembelian berulang sebenar. Tiada kategori atau kos.'],
  [/^A made-up chain of (.+) branches and an online shop, selling real products from the PriceCatcher list, priced in RM\.$/, (_, a) => `Rangkaian rekaan ${a} cawangan dan kedai dalam talian, menjual produk sebenar daripada senarai PriceCatcher, berharga dalam RM.`],
  [/^Every feature: margins, discounts, returns, states and districts, Raya and CNY peaks\. All behaviour is generated\.$/, () => 'Setiap ciri: margin, diskaun, pulangan, negeri dan daerah, puncak Raya dan Tahun Baru Cina. Semua tingkah laku dijana.'],
  [/^(.+) champions bring (.+) of sales\.$/, (_, a, b) => `${a} juara membawa ${b} daripada jualan.`],
  [/^Open the (.+)$/, (_, a) => `Buka ${tr(a)}`],
  [/^Read at (.+), and again on every visit\.$/, (_, a) => `Dibaca pada ${a}, dan semula pada setiap lawatan.`],
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Dates such as "25 Sept 2018", "Jan 2018", "1 Jan 2018 – 30 Dec 2018" and "September".
const DATE_RE = /\b(\d{1,2} )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b(?=( \d{4}|\s*[–-]|$))|\b(January|February|March|April|June|July|August|September|October|November|December)\b/g
function date(s: string): string {
  return s.replace(DATE_RE, (_m, d, short, _y, long) => (long ? MONTH_LONG[long] : `${d ?? ''}${MONTH_SHORT[short] ?? short}`))
}

const cache = new Map<string, string>()

/** The Malay version of one English text, or the text itself when there is none. */
export function tr(text: string): string {
  const hit = cache.get(text)
  if (hit !== undefined) return hit
  const lead = text.match(/^\s*/)![0]
  const tail = text.match(/\s*$/)![0]
  const core = text.trim()
  let out = core
  if (!core || !/[A-Za-z]/.test(core)) out = core
  else if (EXACT[core] !== undefined) out = EXACT[core]
  else if (DAY_LONG[core]) out = DAY_LONG[core]
  else {
    let done = false
    for (const [re, fn] of RULES) {
      const m = core.match(re)
      if (m) {
        out = fn(...(m as unknown as string[]))
        done = true
        break
      }
    }
    if (!done) out = date(core)
  }
  const result = lead + out + tail
  if (cache.size > 20000) cache.clear()
  cache.set(text, result)
  return result
}

// ------------------------------------------------------------------ the page layer

const ATTRS = ['aria-label', 'placeholder', 'title'] as const
// For each text node and attribute: the English it came from and the Malay we put there.
const texts = new WeakMap<Text, { en: string; out: string }>()
const attrs = new WeakMap<Element, Record<string, { en: string; out: string }>>()
let lang: Lang = 'en'
let observer: MutationObserver | null = null
const skip = (el: Element | null) => !el || !!el.closest('script, style, textarea, [data-no-i18n]')

function doText(node: Text) {
  if (skip(node.parentElement)) return
  const v = node.nodeValue ?? ''
  const rec = texts.get(node)
  if (rec && v === rec.out) return
  const out = tr(v)
  texts.set(node, { en: v, out })
  if (out !== v) node.nodeValue = out
}

function doAttrs(el: Element) {
  if (skip(el)) return
  let rec = attrs.get(el)
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v === null) continue
    const r = rec?.[a]
    if (r && v === r.out) continue
    const out = tr(v)
    rec = rec ?? {}
    rec[a] = { en: v, out }
    attrs.set(el, rec)
    if (out !== v) el.setAttribute(a, out)
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  doAttrs(el)
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null
  while ((n = w.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text)
    else doAttrs(n as Element)
  }
}

function restore(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n: Node | null = root
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const r = texts.get(n as Text)
      if (r && n.nodeValue === r.out) n.nodeValue = r.en
      texts.delete(n as Text)
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const r = attrs.get(n as Element)
      if (r) for (const [a, v] of Object.entries(r)) if ((n as Element).getAttribute(a) === v.out) (n as Element).setAttribute(a, v.en)
      attrs.delete(n as Element)
    }
    n = w.nextNode()
  }
}

let enTitle = ''
export function applyLang(next: Lang) {
  if (typeof document === 'undefined') return
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* the choice just won't be remembered */
  }
  document.documentElement.lang = next === 'ms' ? 'ms' : 'en'
  if (next === lang && (next === 'en' || observer)) return
  lang = next
  if (next === 'ms') {
    enTitle = document.title
    document.title = tr(document.title)
    walk(document.body)
    observer = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target as Text)
        else if (m.type === 'attributes') doAttrs(m.target as Element)
        else m.addedNodes.forEach(walk)
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
  } else {
    observer?.disconnect()
    observer = null
    if (enTitle) document.title = enTitle
    restore(document.body)
  }
  dispatchEvent(new CustomEvent('retailai-lang', { detail: next }))
}

export const currentLang = () => lang
