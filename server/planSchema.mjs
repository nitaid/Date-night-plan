import { z } from 'zod'

/**
 * The shape every generated plan must have. Everything is required on purpose:
 * structured outputs are strictest (and most reliable) when the model never has
 * to decide whether to emit a key. "Not applicable" is expressed as an empty
 * string or an empty array, which the UI renders as absent.
 */

export const BOOKING_METHODS = [
  'walk_in',
  'reservation_recommended',
  'reservation_required',
  'phone',
  'website',
  'app',
  'tickets',
]

export const STOP_KINDS = [
  'food',
  'drinks',
  'dessert',
  'activity',
  'show',
  'outdoors',
  'sightseeing',
  'travel',
  'chill',
  'surprise',
]

const AlternativeSchema = z.object({
  venueName: z.string().describe('Name of the alternative venue or activity'),
  area: z.string().describe('Neighbourhood or area, e.g. "Florentin, Tel Aviv"'),
  why: z.string().describe('One short sentence on why this is a good swap'),
  mapsQuery: z.string().describe('Search string to find this on a map, e.g. "Bowling Center Ramat Gan"'),
  url: z.string().describe('Website or booking URL, or an empty string if unknown'),
  costPerPerson: z.coerce.number().describe('Rough cost per person in the plan currency, 0 if free'),
})

const BookingSchema = z.object({
  method: z
    .string()
    .describe(`How this stop is booked. Use exactly one of: ${BOOKING_METHODS.join(', ')}`),
  url: z.string().describe('Direct booking or info URL, or an empty string if unknown'),
  phone: z.string().describe('Phone number in international format, or an empty string if unknown'),
  notes: z.string().describe('What to say or do when booking, e.g. "ask for a lane near the bar"'),
  leadTime: z.string().describe('How far ahead to book, e.g. "same day", "2-3 days ahead"'),
})

const StopSchema = z.object({
  title: z.string().describe('Short label for this part of the evening, e.g. "Dinner in Neve Tzedek"'),
  kind: z
    .string()
    .describe(`What kind of stop this is. Use exactly one of: ${STOP_KINDS.join(', ')}`),
  venueName: z.string().describe('Specific venue name if you are confident it exists, otherwise a descriptive placeholder'),
  area: z.string().describe('Neighbourhood, city'),
  address: z.string().describe('Street address if known, otherwise an empty string'),
  description: z.string().describe('Two or three sentences describing what you actually do here'),
  why: z.string().describe('One sentence on why this fits the couple and the theme'),
  startTime: z.string().describe('24h local start time as HH:MM'),
  durationMin: z.coerce.number().describe('How long this stop takes, in minutes'),
  costPerPerson: z.coerce.number().describe('Estimated cost per person in the plan currency, 0 if free'),
  mapsQuery: z.string().describe('Search string to find this on a map'),
  tips: z.string().describe('One practical insider tip, or an empty string'),
  booking: BookingSchema,
  alternatives: z.array(AlternativeSchema).describe('Two swap-in alternatives for this stop'),
})

export const PlanSchema = z.object({
  title: z.string().describe('An evocative name for the evening, max 6 words'),
  summary: z.string().describe('Two sentences pitching the evening to the couple'),
  vibeTags: z.array(z.string()).describe('Three to five short vibe words, e.g. "playful", "low-key"'),
  stops: z.array(StopSchema).describe('The itinerary in chronological order'),
  totalCostPerPerson: z.coerce.number().describe('Sum of stop costs per person'),
  currency: z.string().describe('ISO currency code matching the couple settings, e.g. "ILS"'),
  dressCode: z.string().describe('What to wear, one short sentence'),
  travelNotes: z.string().describe('How to get between stops and roughly how long it takes'),
  weatherNote: z.string().describe('What weather would spoil this and what to do about it, or an empty string'),
  backupPlan: z.string().describe('One sentence fallback if the main activity falls through'),
  bookingChecklist: z.array(z.string()).describe('Ordered list of things to book or reserve before the date'),
})

/** Used when the couple asks to regenerate or swap just one stop of a plan. */
export const SingleStopSchema = z.object({
  stop: StopSchema,
})
