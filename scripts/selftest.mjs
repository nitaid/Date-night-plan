/**
 * Self-test for the logic that would quietly lose data if it were wrong:
 * state merging between two phones, the time maths around midnight, and ICS
 * generation.
 *
 * The modules are loaded through the dev server so the *real* TypeScript runs,
 * not a reimplementation:
 *
 *   npm run dev            # in one terminal
 *   npm test               # in another
 *
 * Playwright is not a project dependency — install it when you want to run
 * this: `npm i -D playwright && npx playwright install chromium`.
 */
import { chromium } from 'playwright'
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto(process.env.DEV_URL || 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })

const results = await page.evaluate(async () => {
  const storage = await import('/src/lib/storage.ts')
  const cal = await import('/src/lib/calendar.ts')
  const fmt = await import('/src/lib/format.ts')
  const out = []
  const check = (name, actual, expected) =>
    out.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected })

  const base = storage.defaultState()
  const wish = (id, title, at) => ({ ...base, wishlist: [{ id, title, notes: '', tags: [], estCost: null, location: '', url: '', addedBy: 'a', hearts: [], status: 'idea', createdAt: at, updatedAt: at, plannedPlanId: null }], updatedAt: at })

  // two people add different ideas at the same time -> both survive
  const merged = storage.mergeStates(wish('w1', 'Hers', '2026-01-01T10:00:00Z'), wish('w2', 'His', '2026-01-01T10:00:01Z'))
  check('merge keeps both concurrent adds', merged.wishlist.map((w) => w.id).sort(), ['w1', 'w2'])

  // same item edited on both -> newer wins
  const mineNew = storage.mergeStates(wish('w1', 'Newer', '2026-02-01T00:00:00Z'), wish('w1', 'Older', '2026-01-01T00:00:00Z'))
  check('same-item edit resolves to newer', mineNew.wishlist[0].title, 'Newer')

  // a delete beats an older edit but loses to a newer one
  const withTombstone = { ...wish('w1', 'x', '2026-01-01T00:00:00Z'), wishlist: [], deleted: { w1: '2026-01-02T00:00:00Z' } }
  check('tombstone removes an older edit', storage.mergeStates(withTombstone, wish('w1', 'x', '2026-01-01T00:00:00Z')).wishlist.length, 0)
  check('tombstone loses to a newer edit', storage.mergeStates(withTombstone, wish('w1', 'x', '2026-01-03T00:00:00Z')).wishlist.length, 1)

  // hydrate tolerates junk
  check('hydrate survives garbage', storage.hydrate({ wishlist: 'nope', plans: null }).wishlist, [])

  // time maths
  check('after-midnight sorts last', fmt.eveningMinutes('00:30') > fmt.eveningMinutes('22:00'), true)
  check('addMinutes wraps midnight', fmt.addMinutes('23:30', 90), '01:00')
  check('crossesMidnight', fmt.crossesMidnight('23:30', 90), true)

  // ICS for a stop that runs past midnight must land on the next day
  const stop = {
    id: 's1', title: 'Nightcap', kind: 'drinks', venueName: 'A bar', area: 'Florentin', address: '',
    description: 'd', why: 'w', startTime: '23:30', durationMin: 60, costPerPerson: 50,
    mapsQuery: 'bar', tips: '', booking: { method: 'walk_in', url: '', phone: '', notes: '', leadTime: '' },
    alternatives: [], bookingStatus: 'not_needed', locked: false,
  }
  const plan = {
    id: 'p1', title: 'Late one', summary: '', theme: '', vibeTags: [], date: '2026-08-28', stops: [stop],
    currency: 'ILS', totalCostPerPerson: 50, dressCode: '', travelNotes: '', weatherNote: '', backupPlan: '',
    bookingChecklist: [], status: 'draft', source: 'ai', createdBy: 'a', createdAt: '', updatedAt: '',
    calendarExportedAt: null, rating: null, memoryNote: '', actualCostPerPerson: null, wouldRepeat: null,
  }
  const ics = cal.buildIcs(cal.eventsForPlan(plan, 60, false), 'Late one')
  check('ICS start', /DTSTART:20260828T233000/.test(ics), true)
  check('ICS end rolls to next day', /DTEND:20260829T003000/.test(ics), true)
  check('ICS uses CRLF', ics.includes('\r\n'), true)
  const escaped = cal.buildIcs(cal.eventsForPlan({ ...plan, stops: [{ ...stop, venueName: 'A, B; C' }] }, 0, false), 'x')
  const summary = escaped.split('\r\n').find((l) => l.startsWith('SUMMARY:'))
  check('ICS escapes commas and semicolons', summary, String.raw`SUMMARY:Nightcap \u00b7 A\, B\; C`.replace('\\u00b7', '\u00b7'))

  // a stop after midnight belongs to the next calendar day
  const past = cal.eventsForPlan({ ...plan, stops: [{ ...stop, startTime: '00:20' }] }, 0, false)
  check('post-midnight stop moves to next date', past[0].date, '2026-08-29')

  // headline dedupe
  check('headline drops redundant title', cal.stopHeadline({ ...stop, title: 'Bowling', venueName: 'A bowling alley in Sarona' }), 'A bowling alley in Sarona')
  check('headline keeps distinct title', cal.stopHeadline({ ...stop, title: 'Dinner', venueName: 'Miznon' }), 'Dinner · Miznon')

  return out
})

let failed = 0
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`)
  if (!r.pass) { failed++; console.log('      got', JSON.stringify(r.actual), 'want', JSON.stringify(r.expected)) }
}
console.log(`\n${results.length - failed}/${results.length} passed`)
await browser.close()
process.exit(failed ? 1 : 0)
