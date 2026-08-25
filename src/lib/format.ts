export const localTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** YYYY-MM-DD for a Date, in local time (never UTC-shifted). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** The next occurrence of a weekday (0=Sun). Today counts only if `orToday`. */
export function nextWeekday(weekday: number, orToday = false): string {
  const now = new Date()
  const diff = (weekday - now.getDay() + 7) % 7
  return addDays(todayKey(), diff === 0 && !orToday ? 7 : diff)
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Minutes into the evening — after-midnight stops belong to the same night. */
export function eveningMinutes(hhmm: string): number {
  const minutes = minutesOf(hhmm)
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes
}

export function addMinutes(hhmm: string, delta: number): string {
  const total = ((minutesOf(hhmm) + delta) % 1440 + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** True when adding `delta` minutes to `hhmm` rolls past midnight. */
export function crossesMidnight(hhmm: string, delta: number): boolean {
  return minutesOf(hhmm) + delta >= 1440
}

export function formatDuration(minutes: number, locale: string): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (locale === 'he') {
    if (!h) return `${m} דק׳`
    return m ? `${h} ש׳ ${m} דק׳` : `${h} ש׳`
  }
  if (!h) return `${m} min`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: currency || 'ILS',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

export function formatDate(key: string, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...opts,
    }).format(parseDateKey(key))
  } catch {
    return key
  }
}

/** "in 3 days", "tomorrow", "2 weeks ago". */
export function relativeDays(key: string, locale: string): string {
  const days = Math.round((parseDateKey(key).getTime() - parseDateKey(todayKey()).getTime()) / 86400000)
  try {
    const rtf = new Intl.RelativeTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', { numeric: 'auto' })
    if (Math.abs(days) < 7) return rtf.format(days, 'day')
    if (Math.abs(days) < 31) return rtf.format(Math.round(days / 7), 'week')
    return rtf.format(Math.round(days / 30), 'month')
  } catch {
    return `${days}d`
  }
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86400000)
}

export function uid(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefix}_${random}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
