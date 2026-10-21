export const nowIso = () => new Date().toISOString()

export function uid(prefix = '') {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `${prefix}${random.replace(/-/g, '').slice(0, 12)}`
}

const FRACTIONS: [number, string][] = [
  [0.125, '⅛'],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
]

/** 1.5 → "1½", 0.333 → "⅓", 437.5 → "440". Kitchen numbers, not maths. */
export function formatQty(qty: number | null): string {
  if (qty == null) return ''
  if (qty >= 100) return String(Math.round(qty / 5) * 5)
  if (qty >= 10) return String(Math.round(qty))
  const whole = Math.floor(qty)
  const rest = qty - whole
  if (rest < 0.06) return String(whole || qty.toFixed(2).replace(/\.?0+$/, ''))
  if (rest > 0.94) return String(whole + 1)
  const near = FRACTIONS.find(([value]) => Math.abs(value - rest) < 0.03)
  if (near) return `${whole || ''}${near[1]}`
  return (Math.round(qty * 10) / 10).toString()
}

export const shekel = (value: number, digits = 0) =>
  `₪${value.toLocaleString('he-IL', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

export function formatMinutes(total: number) {
  if (!total) return ''
  if (total < 60) return `${total} דק'`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} ש' ${m} דק'` : h === 1 ? 'שעה' : `${h} שעות`
}

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const DAY_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]

/** Local-date ISO (YYYY-MM-DD) — never UTC, or Israeli evenings land on the wrong day. */
export function isoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(iso: string, days: number) {
  const date = parseDate(iso)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** Israeli weeks start on Sunday. */
export function weekStartOf(iso: string) {
  return addDays(iso, -parseDate(iso).getDay())
}

export const today = () => isoDate(new Date())

export function formatDay(iso: string) {
  const date = parseDate(iso)
  return `יום ${DAY_NAMES[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`
}
