import { BOOKING_METHODS, STOP_KINDS } from './planSchema.mjs'

const KIND_ALIASES = {
  restaurant: 'food',
  dinner: 'food',
  lunch: 'food',
  breakfast: 'food',
  brunch: 'food',
  bar: 'drinks',
  cocktails: 'drinks',
  wine: 'drinks',
  coffee: 'drinks',
  sweet: 'dessert',
  icecream: 'dessert',
  game: 'activity',
  sport: 'activity',
  bowling: 'activity',
  theatre: 'show',
  theater: 'show',
  concert: 'show',
  cinema: 'show',
  movie: 'show',
  music: 'show',
  walk: 'outdoors',
  beach: 'outdoors',
  park: 'outdoors',
  hike: 'outdoors',
  tour: 'sightseeing',
  museum: 'sightseeing',
  transit: 'travel',
  transfer: 'travel',
  relax: 'chill',
  home: 'chill',
}

const METHOD_ALIASES = {
  none: 'walk_in',
  no_booking: 'walk_in',
  walkin: 'walk_in',
  drop_in: 'walk_in',
  reservation: 'reservation_recommended',
  recommended: 'reservation_recommended',
  required: 'reservation_required',
  book_online: 'website',
  online: 'website',
  web: 'website',
  call: 'phone',
  ticket: 'tickets',
  ticketing: 'tickets',
}

function pick(value, allowed, aliases, fallback) {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (allowed.includes(key)) return key
  if (aliases[key]) return aliases[key]
  const partial = allowed.find((option) => key.includes(option) || option.includes(key))
  return partial || fallback
}

function num(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback
}

/** HH:MM in 24h. Accepts "8:30 PM", "20.30", "20:30" and clamps to a real time. */
export function time(value, fallback = '19:00') {
  const text = String(value ?? '').trim()
  const match = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})/)
  if (!match) return fallback
  let h = Math.min(23, Math.max(0, Number(match[1])))
  const m = Math.min(59, Math.max(0, Number(match[2])))
  const meridiem = text.toLowerCase().match(/\b([ap])\.?m\.?\b/)
  if (meridiem) {
    if (meridiem[1] === 'p' && h < 12) h += 12
    if (meridiem[1] === 'a' && h === 12) h = 0
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Minutes since the start of the evening. Anything before 05:00 belongs to the
 * small hours of the next day, so a 00:30 nightcap sorts after a 22:00 bar.
 */
export function eveningMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const minutes = h * 60 + m
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes
}

function safeUrl(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (!/^https?:\/\//i.test(text)) return ''
  try {
    return new URL(text).toString()
  } catch {
    return ''
  }
}

export function normalizeStop(stop, fallbackTime) {
  return {
    ...stop,
    title: String(stop.title || 'Stop').trim(),
    kind: pick(stop.kind, STOP_KINDS, KIND_ALIASES, 'activity'),
    venueName: String(stop.venueName || '').trim(),
    area: String(stop.area || '').trim(),
    address: String(stop.address || '').trim(),
    startTime: time(stop.startTime, fallbackTime),
    durationMin: Math.min(600, num(stop.durationMin, 60) || 60),
    costPerPerson: num(stop.costPerPerson, 0),
    mapsQuery: String(stop.mapsQuery || stop.venueName || '').trim(),
    booking: {
      method: pick(stop.booking?.method, BOOKING_METHODS, METHOD_ALIASES, 'walk_in'),
      url: safeUrl(stop.booking?.url),
      phone: String(stop.booking?.phone || '').replace(/[^\d+\-() ]/g, '').trim(),
      notes: String(stop.booking?.notes || '').trim(),
      leadTime: String(stop.booking?.leadTime || '').trim(),
    },
    alternatives: (Array.isArray(stop.alternatives) ? stop.alternatives : []).slice(0, 4).map((alt) => ({
      venueName: String(alt.venueName || '').trim(),
      area: String(alt.area || '').trim(),
      why: String(alt.why || '').trim(),
      mapsQuery: String(alt.mapsQuery || alt.venueName || '').trim(),
      url: safeUrl(alt.url),
      costPerPerson: num(alt.costPerPerson, 0),
    })),
  }
}

export function normalizePlan(plan, { startTime = '19:00', currency = 'ILS' } = {}) {
  const stops = (Array.isArray(plan.stops) ? plan.stops : [])
    .map((stop, i) => normalizeStop(stop, i === 0 ? startTime : '20:00'))
    .sort((a, b) => eveningMinutes(a.startTime) - eveningMinutes(b.startTime))

  const total = stops.reduce((sum, stop) => sum + stop.costPerPerson, 0)

  return {
    ...plan,
    title: String(plan.title || 'Date night').trim(),
    vibeTags: (Array.isArray(plan.vibeTags) ? plan.vibeTags : []).slice(0, 6).map((t) => String(t).trim()).filter(Boolean),
    bookingChecklist: (Array.isArray(plan.bookingChecklist) ? plan.bookingChecklist : []).map((t) => String(t).trim()).filter(Boolean),
    currency: String(plan.currency || currency).toUpperCase().slice(0, 3),
    // Trust the arithmetic over the model's own sum.
    totalCostPerPerson: total,
    stops,
  }
}
