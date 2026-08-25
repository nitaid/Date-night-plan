import type { Plan, Stop } from '../types'
import { addMinutes, crossesMidnight, localTimeZone, minutesOf, parseDateKey, toDateKey } from './format'

/**
 * Calendar export. Everything is emitted as *floating local time* — no Z suffix
 * and no TZID — which is exactly right for "we are meeting at 20:00 where we
 * live", and is the one form both Apple Calendar and Google Calendar import
 * without needing a bundled VTIMEZONE block.
 */

export interface CalendarEvent {
  uid: string
  title: string
  description: string
  location: string
  url: string
  /** YYYY-MM-DD in local time. */
  date: string
  /** HH:MM in local time. */
  start: string
  durationMin: number
  reminderMinutes: number
}

function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

/** A stop that starts after midnight belongs to the following calendar day. */
function dateForStop(planDate: string, startTime: string): string {
  if (minutesOf(startTime) >= 5 * 60) return planDate
  const next = parseDateKey(planDate)
  next.setDate(next.getDate() + 1)
  return toDateKey(next)
}

function endOf(event: CalendarEvent): { date: string; time: string } {
  const time = addMinutes(event.start, event.durationMin)
  if (!crossesMidnight(event.start, event.durationMin)) return { date: event.date, time }
  const next = parseDateKey(event.date)
  next.setDate(next.getDate() + 1)
  return { date: toDateKey(next), time }
}

/**
 * "Bowling · Bowling in Sarona" reads like a bug. Only prefix the slot name
 * when it actually adds something the venue name does not already say.
 */
export function stopHeadline(stop: Stop): string {
  const venue = stop.venueName.trim()
  const title = stop.title.trim()
  if (!venue) return title
  if (!title || venue.toLowerCase().includes(title.toLowerCase())) return venue
  return `${title} · ${venue}`
}

function stopDescription(stop: Stop, plan: Plan): string {
  const lines: string[] = []
  if (stop.description) lines.push(stop.description)
  if (stop.why) lines.push(`Why: ${stop.why}`)
  if (stop.tips) lines.push(`Tip: ${stop.tips}`)
  if (stop.booking.notes) lines.push(`Booking: ${stop.booking.notes}`)
  if (stop.booking.phone) lines.push(`Phone: ${stop.booking.phone}`)
  if (stop.booking.url) lines.push(`Book: ${stop.booking.url}`)
  if (stop.costPerPerson) lines.push(`Approx ${stop.costPerPerson} ${plan.currency} per person`)
  if (stop.mapsQuery) lines.push(`Map: ${mapsUrl(stop.mapsQuery)}`)
  lines.push('', `Part of "${plan.title}"`)
  return lines.join('\n')
}

export function eventsForPlan(plan: Plan, reminderMinutes: number, travelBuffers: boolean): CalendarEvent[] {
  const events: CalendarEvent[] = []

  plan.stops.forEach((stop, index) => {
    const date = dateForStop(plan.date, stop.startTime)
    events.push({
      uid: `${plan.id}-${stop.id}@date-night`,
      title: stopHeadline(stop),
      description: stopDescription(stop, plan),
      location: [stop.venueName, stop.address || stop.area].filter(Boolean).join(', '),
      url: stop.booking.url,
      date,
      start: stop.startTime,
      durationMin: stop.durationMin,
      // Only the first stop nags you; the rest you are already out for.
      reminderMinutes: index === 0 ? reminderMinutes : 0,
    })

    const next = plan.stops[index + 1]
    if (!travelBuffers || !next) return
    const gapStart = addMinutes(stop.startTime, stop.durationMin)
    const gap = minutesOf(next.startTime) - minutesOf(gapStart)
    if (gap < 10 || gap > 90) return
    events.push({
      uid: `${plan.id}-${stop.id}-travel@date-night`,
      title: `Head to ${next.venueName || next.title}`,
      description: plan.travelNotes || `Travel from ${stop.venueName || stop.title} to ${next.venueName || next.title}.`,
      location: '',
      url: '',
      date: dateForStop(plan.date, gapStart),
      start: gapStart,
      durationMin: gap,
      reminderMinutes: 0,
    })
  })

  return events
}

// ---------------------------------------------------------------- ICS

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** RFC 5545 caps content lines at 75 octets; continuations start with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const chunks: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length
    if (size + charSize > (chunks.length ? 74 : 75)) {
      chunks.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  if (current) chunks.push(current)
  return chunks.map((chunk, i) => (i ? ` ${chunk}` : chunk)).join('\r\n')
}

function utcStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function buildIcs(events: CalendarEvent[], calendarName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Date Night//Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${localTimeZone()}`,
  ]

  for (const event of events) {
    const end = endOf(event)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${utcStamp()}`,
      `DTSTART:${stamp(event.date, event.start)}`,
      `DTEND:${stamp(end.date, end.time)}`,
      `SUMMARY:${escapeText(event.title)}`,
    )
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE')
    if (event.reminderMinutes > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(event.title)}`,
        `TRIGGER:-PT${event.reminderMinutes}M`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(events: CalendarEvent[], filename: string, calendarName: string): void {
  const blob = new Blob([buildIcs(events, calendarName)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.replace(/[^\w\-. ]+/g, '_') || 'date-night.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// ------------------------------------------------------- Web calendar links

export function googleCalendarUrl(event: CalendarEvent): string {
  const end = endOf(event)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.date, event.start)}/${stamp(end.date, end.time)}`,
    ctz: localTimeZone(),
    details: event.url ? `${event.description}\n${event.url}` : event.description,
    location: event.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const end = endOf(event)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    body: event.description,
    location: event.location,
    startdt: `${event.date}T${event.start}:00`,
    enddt: `${end.date}T${end.time}:00`,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function wazeUrl(query: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`
}
