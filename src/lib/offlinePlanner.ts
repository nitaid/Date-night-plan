import type { Budget, Profile, StopKind, WishItem } from '../types'
import { addMinutes } from './format'
import type { GeneratedPlan, GeneratedStop } from './planTypes'

/**
 * The planner that runs when there is no API key, when the network is down, or
 * when the AI call fails. It never invents phone numbers, addresses or venue
 * names it cannot vouch for: stops are built around a *category* plus a map
 * search string that actually resolves, so every suggestion stays checkable.
 */

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

interface Template {
  id: string
  keywords: string[]
  kind: StopKind
  label: string
  /** How the stop is named as a place. Defaults to `label`. */
  venue?: string
  /** What to search for on a map, with `{area}` substituted in. */
  search: string
  durationMin: number
  /** Cost per person by budget level, in the couple's currency. */
  cost: Record<Budget, number>
  booking: GeneratedStop['booking']['method']
  times: TimeOfDay[]
  indoor: boolean
  description: string
  tip: string
  /** Which supporting stops go well before/after this one. */
  pairs: ('food' | 'drinks' | 'dessert' | 'walk')[]
}

const T = (t: Template) => t

const MAIN_TEMPLATES: Template[] = [
  T({
    id: 'bowling',
    keywords: ['bowl', 'bowling', 'pins', 'strike', 'באולינג'],
    kind: 'activity',
    label: 'Bowling',
    venue: 'A bowling alley',
    search: 'bowling alley {area}',
    durationMin: 90,
    cost: { shoestring: 45, moderate: 70, generous: 95, splurge: 130 },
    booking: 'reservation_recommended',
    times: ['afternoon', 'evening', 'night'],
    indoor: true,
    description: 'Two or three games, loser buys the next round. Most alleys rent shoes at the counter and sell drinks lane-side.',
    tip: 'Call ahead on a weekend — lanes go fast after 20:00, and ask for a lane away from the birthday parties.',
    pairs: ['food', 'drinks', 'dessert'],
  }),
  T({
    id: 'cinema',
    keywords: ['movie', 'cinema', 'film', 'screening', 'סרט', 'קולנוע'],
    kind: 'show',
    label: 'A film',
    venue: 'A cinema',
    search: 'cinema {area}',
    durationMin: 130,
    cost: { shoestring: 40, moderate: 55, generous: 80, splurge: 120 },
    booking: 'tickets',
    times: ['afternoon', 'evening', 'night'],
    indoor: true,
    description: 'Pick the film together on the way. Independent cinematheques usually have the more interesting programme than the multiplexes.',
    tip: 'Book seats online so you are not stuck in the front row, and check whether the screening is subtitled or dubbed.',
    pairs: ['food', 'dessert'],
  }),
  T({
    id: 'live_music',
    keywords: ['music', 'gig', 'concert', 'band', 'jazz', 'live', 'הופעה', 'מוזיקה'],
    kind: 'show',
    label: 'Live music',
    venue: 'A live music venue',
    search: 'live music venue {area}',
    durationMin: 120,
    cost: { shoestring: 50, moderate: 90, generous: 150, splurge: 250 },
    booking: 'tickets',
    times: ['evening', 'night'],
    indoor: true,
    description: 'Find whoever is playing that night rather than picking a venue first — the room matters less than the set.',
    tip: 'Doors usually open an hour before the set. Arrive at doors if you want to sit, later if you would rather stand at the back.',
    pairs: ['drinks', 'food', 'walk'],
  }),
  T({
    id: 'theatre',
    keywords: ['theatre', 'theater', 'play', 'show', 'stand up', 'comedy', 'תיאטרון', 'הצגה'],
    kind: 'show',
    label: 'Theatre or comedy',
    venue: 'A theatre',
    search: 'theatre {area}',
    durationMin: 140,
    cost: { shoestring: 70, moderate: 130, generous: 220, splurge: 380 },
    booking: 'tickets',
    times: ['evening', 'night'],
    indoor: true,
    description: 'A proper sit-down show. Comedy nights are cheaper and easier to book last minute than a main-stage production.',
    tip: 'Latecomers often wait until the interval, so build in a buffer before curtain.',
    pairs: ['food', 'drinks'],
  }),
  T({
    id: 'museum',
    keywords: ['museum', 'gallery', 'art', 'exhibition', 'מוזיאון', 'תערוכה'],
    kind: 'sightseeing',
    label: 'Museum or gallery',
    venue: 'A museum or gallery',
    search: 'art museum {area}',
    durationMin: 100,
    cost: { shoestring: 0, moderate: 60, generous: 60, splurge: 90 },
    booking: 'tickets',
    times: ['morning', 'afternoon', 'evening'],
    indoor: true,
    description: 'Give yourselves a rule: each of you picks one room, and the other has to say why they think you chose it.',
    tip: 'Many museums run a late night once a week with a bar and a smaller crowd — worth checking before you pick the day.',
    pairs: ['drinks', 'dessert'],
  }),
  T({
    id: 'cooking',
    keywords: ['cook', 'cooking class', 'workshop', 'pottery', 'ceramics', 'craft', 'paint', 'סדנה', 'בישול'],
    kind: 'activity',
    label: 'A workshop together',
    venue: 'A workshop',
    search: 'couples workshop class {area}',
    durationMin: 150,
    cost: { shoestring: 90, moderate: 160, generous: 250, splurge: 400 },
    booking: 'reservation_required',
    times: ['afternoon', 'evening'],
    indoor: true,
    description: 'Cooking, ceramics, cocktails or printmaking — you leave with something you made and a running joke about whose turned out worse.',
    tip: 'These almost always need booking days ahead, and most have a minimum group size.',
    pairs: ['drinks', 'dessert'],
  }),
  T({
    id: 'beach',
    keywords: ['beach', 'sea', 'sunset', 'swim', 'ים', 'חוף', 'שקיעה'],
    kind: 'outdoors',
    label: 'Sunset by the sea',
    venue: 'The seafront',
    search: 'beach promenade {area}',
    durationMin: 75,
    cost: { shoestring: 0, moderate: 0, generous: 0, splurge: 0 },
    booking: 'walk_in',
    times: ['afternoon', 'evening'],
    indoor: false,
    description: 'Walk down for golden hour, stay for the light going out over the water. Free, and it never gets old.',
    tip: 'Check sunset time and arrive 30 minutes before it — the good part is the half hour either side.',
    pairs: ['food', 'drinks', 'dessert'],
  }),
  T({
    id: 'market',
    keywords: ['market', 'shuk', 'food tour', 'street food', 'שוק'],
    kind: 'food',
    label: 'Eat your way through a market',
    venue: 'The food market',
    search: 'food market {area}',
    durationMin: 90,
    cost: { shoestring: 50, moderate: 90, generous: 140, splurge: 200 },
    booking: 'walk_in',
    times: ['morning', 'afternoon', 'evening'],
    indoor: false,
    description: 'Split everything, order more than you meant to, and do not sit down until you have walked the whole length once.',
    tip: 'Go hungry and bring cash — the best stalls are often the ones without a card reader.',
    pairs: ['drinks', 'dessert', 'walk'],
  }),
  T({
    id: 'walk',
    keywords: ['walk', 'stroll', 'explore', 'wander', 'neighbourhood', 'neighborhood', 'טיול', 'הליכה'],
    kind: 'outdoors',
    label: 'Wander a neighbourhood',
    venue: 'A wander',
    search: 'historic neighbourhood {area}',
    durationMin: 70,
    cost: { shoestring: 0, moderate: 0, generous: 0, splurge: 0 },
    booking: 'walk_in',
    times: ['morning', 'afternoon', 'evening', 'night'],
    indoor: false,
    description: 'No route, no destination. Turn down whichever street looks more interesting and stop when something smells good.',
    tip: 'Pick a neighbourhood neither of you knows well — familiarity is what turns a walk into a commute.',
    pairs: ['food', 'drinks', 'dessert'],
  }),
  T({
    id: 'karaoke',
    keywords: ['karaoke', 'sing', 'קריוקי'],
    kind: 'activity',
    label: 'Karaoke',
    venue: 'A karaoke bar',
    search: 'karaoke bar {area}',
    durationMin: 120,
    cost: { shoestring: 60, moderate: 100, generous: 150, splurge: 220 },
    booking: 'reservation_recommended',
    times: ['evening', 'night'],
    indoor: true,
    description: 'A private room beats a public stage for a first go. Two hours is exactly the right length.',
    tip: 'Rooms are usually priced per hour for the room, not per person, so it gets cheaper with friends.',
    pairs: ['food', 'drinks'],
  }),
  T({
    id: 'escape',
    keywords: ['escape room', 'escape', 'puzzle', 'quiz', 'trivia', 'חדר בריחה'],
    kind: 'activity',
    label: 'Escape room',
    venue: 'An escape room',
    search: 'escape room {area}',
    durationMin: 75,
    cost: { shoestring: 90, moderate: 130, generous: 170, splurge: 220 },
    booking: 'reservation_required',
    times: ['afternoon', 'evening', 'night'],
    indoor: true,
    description: 'Sixty minutes locked in a room together is either a great date or very revealing. Usually both.',
    tip: 'Two-player rooms exist and are far better than joining a group of strangers — ask specifically.',
    pairs: ['food', 'drinks'],
  }),
  T({
    id: 'dancing',
    keywords: ['dance', 'dancing', 'salsa', 'tango', 'club', 'ריקוד', 'ריקודים'],
    kind: 'activity',
    label: 'Dancing',
    venue: 'A dance floor',
    search: 'dance class social {area}',
    durationMin: 110,
    cost: { shoestring: 40, moderate: 80, generous: 120, splurge: 180 },
    booking: 'reservation_recommended',
    times: ['evening', 'night'],
    indoor: true,
    description: 'A beginners class followed by the social afterwards is the easy version — no one expects you to know anything.',
    tip: 'Wear shoes you can pivot in. Trainers with grip are the enemy.',
    pairs: ['drinks', 'dessert'],
  }),
  T({
    id: 'spa',
    keywords: ['spa', 'massage', 'hammam', 'sauna', 'relax', 'ספא'],
    kind: 'chill',
    label: 'Spa or hammam',
    venue: 'A spa',
    search: 'spa hammam {area}',
    durationMin: 120,
    cost: { shoestring: 120, moderate: 250, generous: 400, splurge: 650 },
    booking: 'reservation_required',
    times: ['morning', 'afternoon', 'evening'],
    indoor: true,
    description: 'Couples treatments book out first. Arrive early enough to use the facilities before your slot.',
    tip: 'Do not plan anything demanding afterwards — you will not want it.',
    pairs: ['food', 'dessert'],
  }),
  T({
    id: 'rooftop',
    keywords: ['rooftop', 'view', 'skyline', 'גג', 'נוף'],
    kind: 'drinks',
    label: 'Rooftop drinks',
    venue: 'A rooftop bar',
    search: 'rooftop bar {area}',
    durationMin: 90,
    cost: { shoestring: 60, moderate: 110, generous: 170, splurge: 260 },
    booking: 'reservation_recommended',
    times: ['evening', 'night'],
    indoor: false,
    description: 'One good view, two drinks, no rush. Go up before sunset and stay through the lights coming on.',
    tip: 'Rooftops get cold and windy after dark even in summer — bring a layer.',
    pairs: ['food', 'dessert'],
  }),
  T({
    id: 'picnic',
    keywords: ['picnic', 'park', 'garden', 'outdoors', 'פיקניק', 'פארק'],
    kind: 'outdoors',
    label: 'Picnic in the park',
    venue: 'The park',
    search: 'park {area}',
    durationMin: 100,
    cost: { shoestring: 40, moderate: 70, generous: 110, splurge: 180 },
    booking: 'walk_in',
    times: ['morning', 'afternoon', 'evening'],
    indoor: false,
    description: 'Raid a deli on the way, bring one thing each the other has never tried, and claim a spot before the light goes.',
    tip: 'A blanket and a bottle opener are the two things everyone forgets.',
    pairs: ['dessert', 'walk'],
  }),
  T({
    id: 'dinner',
    keywords: ['dinner', 'restaurant', 'eat', 'food', 'tasting', 'ארוחה', 'מסעדה'],
    kind: 'food',
    label: 'Dinner out',
    venue: 'Dinner',
    search: 'restaurant {area}',
    durationMin: 105,
    cost: { shoestring: 70, moderate: 150, generous: 260, splurge: 450 },
    booking: 'reservation_recommended',
    times: ['evening', 'night'],
    indoor: true,
    description: 'One proper meal, unhurried. Order one thing each of you would not normally choose.',
    tip: 'Book the later sitting if you want the table for the whole evening rather than being turned over.',
    pairs: ['drinks', 'dessert', 'walk'],
  }),
]

const SUPPORT_TEMPLATES: Record<'food' | 'drinks' | 'dessert' | 'walk', Template> = {
  food: T({
    id: 'support_food',
    keywords: [],
    kind: 'food',
    label: 'Dinner first',
    venue: 'Dinner',
    search: 'restaurant {area}',
    durationMin: 90,
    cost: { shoestring: 60, moderate: 130, generous: 220, splurge: 380 },
    booking: 'reservation_recommended',
    times: ['evening'],
    indoor: true,
    description: 'Eat somewhere within walking distance of the main event so you are not watching the clock.',
    tip: 'Tell them when you need to leave when you book — a good place will pace the meal around it.',
    pairs: [],
  }),
  drinks: T({
    id: 'support_drinks',
    keywords: [],
    kind: 'drinks',
    label: 'A drink to start',
    venue: 'A cocktail bar',
    search: 'cocktail bar {area}',
    durationMin: 60,
    cost: { shoestring: 35, moderate: 70, generous: 110, splurge: 170 },
    booking: 'walk_in',
    times: ['evening', 'night'],
    indoor: true,
    description: 'One drink, somewhere with seats, to switch out of work mode before the evening properly starts.',
    tip: 'Somewhere you can hear each other beats somewhere with a queue outside.',
    pairs: [],
  }),
  dessert: T({
    id: 'support_dessert',
    keywords: [],
    kind: 'dessert',
    label: 'Something sweet after',
    venue: 'Dessert',
    search: 'dessert ice cream {area}',
    durationMin: 45,
    cost: { shoestring: 20, moderate: 40, generous: 65, splurge: 100 },
    booking: 'walk_in',
    times: ['evening', 'night'],
    indoor: true,
    description: 'The part of the evening where you actually talk about the evening.',
    tip: 'Check closing time — dessert places shut earlier than bars.',
    pairs: [],
  }),
  walk: T({
    id: 'support_walk',
    keywords: [],
    kind: 'outdoors',
    label: 'Walk it off',
    venue: 'A walk',
    search: 'promenade {area}',
    durationMin: 40,
    cost: { shoestring: 0, moderate: 0, generous: 0, splurge: 0 },
    booking: 'walk_in',
    times: ['evening', 'night'],
    indoor: false,
    description: 'The slow way home. Costs nothing and is reliably the bit you remember.',
    tip: 'Pick the route along water or through a lit park rather than the main road.',
    pairs: [],
  }),
}

/** Neighbourhoods worth naming, so a plan says somewhere real rather than "the city centre". */
const AREA_HINTS: Record<string, string[]> = {
  'tel aviv': ['Neve Tzedek', 'Florentin', 'Rothschild Boulevard', 'the Tel Aviv Port', 'Sarona', 'Kerem HaTeimanim', 'Old North'],
  jaffa: ['the Jaffa flea market', 'Old Jaffa', 'Jaffa Port'],
  jerusalem: ['Machane Yehuda', 'the German Colony', 'Nachlaot', 'Mamilla'],
  haifa: ['the German Colony', 'Masada Street', 'Wadi Nisnas'],
  'ramat gan': ['the Diamond District', 'Bialik Street'],
  herzliya: ['Herzliya Marina', 'Herzliya Pituach'],
}

const TIME_WORDS: [RegExp, TimeOfDay][] = [
  [/\b(morning|breakfast|brunch|בוקר)\b/i, 'morning'],
  [/\b(afternoon|lunch|midday|daytime|צהריים|אחר הצהריים)\b/i, 'afternoon'],
  [/\b(evening|sunset|dinner|ערב|שקיעה)\b/i, 'evening'],
  [/\b(night|late|midnight|לילה)\b/i, 'night'],
]

const START_TIMES: Record<TimeOfDay, string> = {
  morning: '10:00',
  afternoon: '15:00',
  evening: '19:00',
  night: '21:00',
}

export interface ParsedTheme {
  activityKeywords: string[]
  timeOfDay: TimeOfDay | null
  area: string | null
  raw: string
}

export function parseTheme(theme: string, profile: Profile): ParsedTheme {
  const lower = theme.toLowerCase()

  let timeOfDay: TimeOfDay | null = null
  for (const [pattern, value] of TIME_WORDS) {
    if (pattern.test(theme)) {
      timeOfDay = value
      break
    }
  }

  // "near tel aviv", "in jaffa", "around haifa" — otherwise fall back to home.
  let area: string | null = null
  const near = lower.match(/\b(?:near|in|around|at|by|ליד|ב)\s+([a-zא-ת][a-zא-ת\s'-]{2,30})/i)
  if (near) area = near[1].trim().replace(/\s+(tonight|tomorrow|this weekend|please)$/i, '')
  for (const known of Object.keys(AREA_HINTS)) {
    if (lower.includes(known)) area = known
  }
  if (!area && profile.homeCity) area = profile.homeCity

  return {
    activityKeywords: lower.split(/[^a-zא-ת]+/).filter((word) => word.length > 2),
    timeOfDay,
    area: area || null,
    raw: theme,
  }
}

function scoreTemplate(template: Template, parsed: ParsedTheme, profile: Profile): number {
  let score = 0
  const lower = parsed.raw.toLowerCase()
  for (const keyword of template.keywords) {
    if (lower.includes(keyword)) score += keyword.split(' ').length * 12
  }
  if (parsed.timeOfDay && template.times.includes(parsed.timeOfDay)) score += 4
  for (const interest of profile.interests) {
    if (template.keywords.some((k) => k.includes(interest.toLowerCase()) || interest.toLowerCase().includes(k))) score += 3
  }
  for (const avoided of profile.avoid) {
    const a = avoided.toLowerCase().trim()
    if (a && (template.keywords.some((k) => k.includes(a)) || template.label.toLowerCase().includes(a))) score -= 50
  }
  return score
}

/** "tel aviv" typed mid-sentence should still read as "Tel Aviv". */
function titleCase(value: string): string {
  return value.replace(/\S+/g, (word) => (word.length <= 2 ? word : word[0].toUpperCase() + word.slice(1)))
}

function areaLabel(parsed: ParsedTheme, profile: Profile): string {
  return titleCase(parsed.area || profile.homeCity || 'your area')
}

function pickNeighbourhood(area: string, seed: number): string | null {
  const hints = AREA_HINTS[area.toLowerCase()]
  if (!hints?.length) return null
  return hints[seed % hints.length]
}

function toStop(
  template: Template,
  opts: { area: string; neighbourhood: string | null; startTime: string; budget: Budget; why: string },
): GeneratedStop {
  const search = template.search.replace('{area}', opts.neighbourhood || opts.area)
  const venue = template.venue ?? template.label
  return {
    title: template.label,
    kind: template.kind,
    venueName: `${venue} in ${opts.neighbourhood || opts.area}`,
    area: opts.neighbourhood ? `${opts.neighbourhood}, ${opts.area}` : opts.area,
    address: '',
    description: template.description,
    why: opts.why,
    startTime: opts.startTime,
    durationMin: template.durationMin,
    costPerPerson: template.cost[opts.budget],
    mapsQuery: search,
    tips: template.tip,
    booking: {
      method: template.booking,
      url: '',
      phone: '',
      notes:
        template.booking === 'walk_in'
          ? 'No booking needed — just turn up.'
          : 'Pick the specific place from the map search, then book directly with them.',
      leadTime: template.booking === 'reservation_required' ? 'a few days ahead' : template.booking === 'walk_in' ? 'none' : 'same day or the day before',
    },
    alternatives: [],
  }
}

function alternativesFor(template: Template, area: string, neighbourhoods: string[]): GeneratedStop['alternatives'] {
  return neighbourhoods.slice(0, 2).map((hood) => ({
    venueName: `${template.venue ?? template.label} in ${hood}`,
    area: `${hood}, ${area}`,
    why: `Same idea, different neighbourhood — ${hood} has a different crowd and pace.`,
    mapsQuery: template.search.replace('{area}', hood),
    url: '',
    costPerPerson: 0,
  }))
}

export interface OfflinePlanInput {
  theme: string
  date: string
  startTime?: string
  profile: Profile
  wishlist?: WishItem[]
  /** Templates to avoid, e.g. when regenerating for something different. */
  exclude?: string[]
}

export function generateOfflinePlan(input: OfflinePlanInput): GeneratedPlan {
  const { theme, profile } = input
  const parsed = parseTheme(theme, profile)
  const area = areaLabel(parsed, profile)
  const budget = profile.budget || 'moderate'

  const ranked = MAIN_TEMPLATES.filter((t) => !input.exclude?.includes(t.id))
    .map((template) => ({ template, score: scoreTemplate(template, parsed, profile) }))
    .sort((a, b) => b.score - a.score)

  const main = ranked[0]?.template ?? MAIN_TEMPLATES[0]
  const matched = (ranked[0]?.score ?? 0) > 0

  const timeOfDay = parsed.timeOfDay ?? (main.times.includes('evening') ? 'evening' : main.times[0])
  const mainStart = input.startTime || profile.defaultStartTime || START_TIMES[timeOfDay]

  const hints = AREA_HINTS[area.toLowerCase()] ?? []
  const seed = theme.length + main.id.length
  const neighbourhood = pickNeighbourhood(area, seed)

  // Build the arc around the main event: one warm-up before, one wind-down after.
  const before = main.pairs.find((p) => p === 'food' || p === 'drinks')
  const after = main.pairs.find((p) => p === 'dessert' || p === 'walk')

  const stops: GeneratedStop[] = []

  if (before && timeOfDay !== 'night') {
    const template = SUPPORT_TEMPLATES[before]
    const start = addMinutes(mainStart, -(template.durationMin + 20))
    stops.push(
      toStop(template, {
        area,
        neighbourhood,
        startTime: start,
        budget,
        why: `Somewhere to settle in before ${main.label.toLowerCase()}, close enough that you walk over.`,
      }),
    )
  }

  stops.push(
    toStop(main, {
      area,
      neighbourhood,
      startTime: mainStart,
      budget,
      why: matched
        ? `This is what you asked for: ${main.label.toLowerCase()} ${parsed.timeOfDay ? `in the ${parsed.timeOfDay}` : ''} near ${area}.`.trim()
        : `Picked to match your interests — ${main.label.toLowerCase()} near ${area}.`,
    }),
  )

  if (after) {
    const template = SUPPORT_TEMPLATES[after]
    const start = addMinutes(mainStart, main.durationMin + 15)
    stops.push(
      toStop(template, {
        area,
        neighbourhood,
        startTime: start,
        budget,
        why: 'The unhurried end of the night, a short walk from the last stop.',
      }),
    )
  }

  // Fold in a wishlist idea when it obviously matches, so the list gets used.
  const wishMatch = (input.wishlist || []).find(
    (item) => item.status !== 'done' && main.keywords.some((k) => item.title.toLowerCase().includes(k)),
  )

  for (const stop of stops) {
    const template = stop.title === main.label ? main : Object.values(SUPPORT_TEMPLATES).find((t) => t.label === stop.title) || main
    stop.alternatives = alternativesFor(template, area, hints.filter((h) => h !== neighbourhood))
  }

  const total = stops.reduce((sum, stop) => sum + stop.costPerPerson, 0)
  const outdoor = stops.some((stop) => !MAIN_TEMPLATES.concat(Object.values(SUPPORT_TEMPLATES)).find((t) => t.label === stop.title)?.indoor)

  return {
    title: matched ? `${main.label} near ${area}` : `${main.label}, ${area}`,
    summary: [
      `${stops.length} stops around ${neighbourhood || area}, built around ${main.label.toLowerCase()}.`,
      wishMatch ? `This also ticks "${wishMatch.title}" off your list.` : 'Swap any stop you do not like — the alternatives are one tap away.',
    ].join(' '),
    vibeTags: [timeOfDay, main.kind, budget].filter(Boolean) as string[],
    stops,
    totalCostPerPerson: total,
    currency: profile.currency || 'ILS',
    dressCode: main.indoor ? 'Whatever you would wear to a nice bar.' : 'Comfortable shoes and a layer for later.',
    travelNotes:
      profile.transport === 'car'
        ? 'Keeping the stops in one neighbourhood means parking once and walking between them.'
        : 'Every stop is within a short walk of the last one, so you never need to work out transport mid-evening.',
    weatherNote: outdoor ? 'One stop is outdoors — if it rains, move it indoors and keep the rest.' : '',
    backupPlan: `If the main stop is full, the alternatives listed under it are in the same area and rarely need booking.`,
    bookingChecklist: stops
      .filter((stop) => stop.booking.method !== 'walk_in')
      .map((stop) => `Book ${stop.title.toLowerCase()} (${stop.booking.leadTime})`),
  }
}

/** A single replacement stop, used when the AI is unavailable mid-edit. */
export function generateOfflineStop(
  plan: { stops: { title: string; startTime: string; durationMin: number; area: string }[] },
  stopIndex: number,
  profile: Profile,
  instruction?: string,
): GeneratedStop {
  const current = plan.stops[stopIndex]
  const area = current?.area?.split(',').pop()?.trim() || profile.homeCity || 'your area'
  const parsed = parseTheme(instruction || current?.title || '', profile)
  const ranked = MAIN_TEMPLATES.map((template) => ({ template, score: scoreTemplate(template, parsed, profile) }))
    .filter(({ template }) => template.label !== current?.title)
    .sort((a, b) => b.score - a.score)

  const template = ranked[0]?.template ?? MAIN_TEMPLATES[0]
  const hints = AREA_HINTS[area.toLowerCase()] ?? []
  const neighbourhood = pickNeighbourhood(area, (instruction || '').length + stopIndex)

  const stop = toStop(template, {
    area,
    neighbourhood,
    startTime: current?.startTime || '19:00',
    budget: profile.budget || 'moderate',
    why: instruction ? `Swapped in for: "${instruction}".` : 'A different take on this slot, in the same area.',
  })
  stop.durationMin = current?.durationMin || template.durationMin
  stop.alternatives = alternativesFor(template, area, hints.filter((h) => h !== neighbourhood))
  return stop
}
