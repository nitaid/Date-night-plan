const BUDGET_HINTS = {
  shoestring: 'Keep it genuinely cheap. Free and low-cost options, street food, parks, happy hours.',
  moderate: 'Normal night-out money. Mid-range restaurants and standard activity prices.',
  generous: 'Comfortable spending. Good restaurants, proper tickets, taxis instead of buses.',
  splurge: 'This is a special occasion. Standout venues, tasting menus, premium seats.',
}

const TRANSPORT_HINTS = {
  walking: 'They are on foot, so keep every stop within a comfortable walk of the previous one.',
  transit: 'They use public transport. Mind last-bus/last-train times and keep stops near lines.',
  car: 'They drive. Mention parking realities, and remember whoever drives is not drinking.',
  taxi: 'They take taxis and ride-shares, so distance between stops matters less than travel time.',
  bike: 'They cycle or use scooters. Keep routes bike-friendly and mention where to lock up.',
}

function line(label, value) {
  if (value === undefined || value === null) return null
  const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value)
  return text.trim() ? `- ${label}: ${text.trim()}` : null
}

export function buildSystemPrompt(profile = {}) {
  const budget = BUDGET_HINTS[profile.budget] || BUDGET_HINTS.moderate
  const transport = TRANSPORT_HINTS[profile.transport] || TRANSPORT_HINTS.transit

  return [
    'You are the date-night planner for one specific couple. You design real, bookable evenings out — not generic listicles.',
    '',
    'How you plan:',
    '- Build a coherent arc, usually 2 to 4 stops, that flows in one direction geographically. Never send them back and forth across a city.',
    '- Name real, specific venues you are confident exist in the requested area. If you are not confident a venue exists, describe the kind of place precisely instead of inventing a name, and say what to search for.',
    '- Never invent a phone number, address, or booking URL. An empty string is always better than a plausible-looking fake. `mapsQuery` is how they will find the place, so make it a search string that actually resolves.',
    '- Times must be realistic: leave travel time between stops, respect that kitchens close, and do not schedule a two-hour dinner before a show that starts in one hour.',
    '- Costs are per person, in the couple\'s currency, and should be honest estimates rather than optimistic ones.',
    '- Every stop needs two genuinely different alternatives — not three versions of the same restaurant.',
    '',
    'Who you are planning for:',
    line('Names', [profile.partnerAName, profile.partnerBName].filter(Boolean)) || '- Names: not given',
    line('Home base', profile.homeCity) || '- Home base: not given',
    line('Willing to travel', profile.radiusKm ? `${profile.radiusKm} km from home base` : null),
    line('Interests', profile.interests),
    line('Actively avoid', profile.avoid),
    line('Dietary needs', profile.dietary),
    line('Accessibility needs', profile.accessibility),
    line('Languages spoken', profile.languages),
    line('Currency', profile.currency || 'ILS'),
    `- Budget: ${budget}`,
    `- Getting around: ${transport}`,
    line('Anything else', profile.notes),
    '',
    'Hard rules: respect every dietary, accessibility and avoid constraint without exception. If a constraint makes the requested theme impossible, adapt the theme and explain the adaptation in the summary rather than silently breaking the constraint.',
    profile.language === 'he'
      ? 'Write every field of your answer in Hebrew — titles, descriptions, tips, everything. Keep venue names in whatever language that venue actually uses, and keep `mapsQuery` in a form that resolves on a map (Hebrew or English, whichever finds the place).'
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function describeWishlist(wishlist = []) {
  const open = wishlist.filter((item) => item && item.status !== 'done').slice(0, 40)
  if (!open.length) return null
  const lines = open.map((item) => {
    const bits = [item.title]
    if (item.notes) bits.push(item.notes)
    if (item.tags?.length) bits.push(`tags: ${item.tags.join(', ')}`)
    return `  - ${bits.join(' — ')}`
  })
  return `Their shared wishlist (weave one in if it genuinely fits the theme, otherwise ignore it):\n${lines.join('\n')}`
}

function describeHistory(recentPlans = []) {
  const past = recentPlans.slice(0, 12).filter(Boolean)
  if (!past.length) return null
  const lines = past.map((plan) => {
    const venues = (plan.stops || []).map((s) => s.venueName).filter(Boolean).join(', ')
    const rating = plan.rating ? ` — they rated it ${plan.rating}/5` : ''
    return `  - ${plan.title}${venues ? ` (${venues})` : ''}${rating}`
  })
  return [
    'Evenings they have already had. Do not repeat a venue they rated 3 or below, and do not repeat any venue at all unless the theme explicitly asks to go back:',
    lines.join('\n'),
  ].join('\n')
}

export function buildPlanPrompt({ theme, date, startTime, durationHours, wishlist, recentPlans, extraNotes }) {
  const parts = [
    `Theme they typed: "${theme}"`,
    date ? `Date: ${date}` : 'Date: not fixed yet — assume the coming weekend.',
    startTime ? `They want to start around ${startTime}.` : null,
    durationHours ? `The evening should run roughly ${durationHours} hours.` : null,
    extraNotes ? `Extra notes for this specific evening: ${extraNotes}` : null,
    '',
    describeWishlist(wishlist),
    describeHistory(recentPlans),
    '',
    'Design the evening. Anchor it on whatever the theme names as the main event, and build the rest of the night around it.',
  ]
  return parts.filter(Boolean).join('\n')
}

export function buildStopPrompt({ plan, stopIndex, instruction }) {
  const stops = plan.stops || []
  const target = stops[stopIndex]
  const context = stops
    .map((s, i) => `  ${i + 1}. ${s.startTime} ${s.title} — ${s.venueName}, ${s.area} (${s.durationMin} min)${i === stopIndex ? '   <-- replace this one' : ''}`)
    .join('\n')

  return [
    `The evening is "${plan.title}" on ${plan.date || 'an unfixed date'}.`,
    'Current itinerary:',
    context,
    '',
    `Replace stop ${stopIndex + 1} only.`,
    instruction ? `What they asked for: ${instruction}` : 'They want a different option in the same spirit.',
    target ? `Do not suggest ${target.venueName} again.` : null,
    '',
    'The replacement must start at a time that still works with the stops around it, stay in a sensible location relative to them, and keep the rest of the evening intact. Return the single replacement stop.',
  ]
    .filter(Boolean)
    .join('\n')
}
