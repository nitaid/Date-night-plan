/**
 * Self-test: the maths that decides what people buy and pay (unit conversion,
 * pack rounding, store index, pantry staples), ingredient-line parsing, catalog
 * matching, the offline planner — then a click-through of the real UI.
 *
 * Modules load through the dev server so the real TypeScript runs:
 *
 *   npm run dev            # in one terminal
 *   npm test               # in another
 *
 * Playwright is not a project dependency — `npm i -D playwright` when you want this.
 */
import { chromium } from 'playwright'

const URL_BASE = process.env.DEV_URL || 'http://localhost:5173/'
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'he-IL' })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' })

const results = await page.evaluate(async () => {
  const line = await import('/src/lib/ingredientLine.js')
  const catalog = await import('/src/lib/catalog.ts')
  const pricing = await import('/src/lib/pricing.ts')
  const recipes = await import('/src/lib/recipes.ts')
  const planner = await import('/src/lib/planner.ts')
  const storage = await import('/src/lib/storage.ts')
  const fmt = await import('/src/lib/format.ts')
  const out = []
  const check = (name, actual, expected) => out.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected })

  // Ingredient lines, Hebrew and imported English.
  check('parse hebrew cups', line.parseIngredientLine('2 כוסות קמח, מנופה'), { qty: 2, unit: 'כוס', name: 'קמח', note: 'מנופה' })
  check('parse fraction', line.parseIngredientLine('1 1/2 כפית מלח').qty, 1.5)
  check('parse unicode fraction', line.parseIngredientLine('½ כוס שמן').qty, 0.5)
  check('parse english', line.parseIngredientLine('3 tbsp olive oil'), { qty: 3, unit: 'כף', name: 'olive oil', note: '' })
  check('parse to taste', line.parseIngredientLine('מלח לפי הטעם'), { qty: null, unit: 'לפי הטעם', name: 'מלח', note: '' })

  // Catalog matching.
  check('match plural with article', catalog.matchCatalog('העגבניות'), 'tomato')
  check('match with descriptor', catalog.matchCatalog('בצל גדול קצוץ'), 'onion')
  check('match english alias', catalog.matchCatalog('heavy cream'), 'cream')
  check('match multiword', catalog.matchCatalog('שמן זית כתית'), 'olive-oil')
  check('no false match', catalog.matchCatalog('זעפרן'), null)

  // Unit conversion into the catalog's own unit.
  const flour = catalog.CATALOG_BY_ID.get('flour')
  const onion = catalog.CATALOG_BY_ID.get('onion')
  const garlic = catalog.CATALOG_BY_ID.get('garlic')
  check('cup of flour in grams', pricing.amountInCatalogUnit(1, 'כוס', flour), 132)
  check('two onions in grams', pricing.amountInCatalogUnit(2, "יח'", onion), 300)
  check('garlic cloves', pricing.amountInCatalogUnit(4, 'שן', garlic), 20)
  check('kg', pricing.amountInCatalogUnit(1.2, 'ק"ג', onion), 1200)

  // Packs, store index, staples.
  const state = storage.defaultState()
  const shakshuka = recipes.fromLibrary((await import('/src/data/library.ts')).LIBRARY[0])
  const plan = { weekStart: '2026-10-25', days: [{ date: '2026-10-25', recipeId: shakshuka.id, servings: 4, locked: false }], generatedBy: 'manual', note: '', updatedAt: '' }
  const needs = pricing.planNeeds(plan, [shakshuka], [])
  const deal = pricing.priceList(needs, 'shufersal-deal', state.shopping, state.settings)
  const rami = pricing.priceList(needs, 'rami-levy', state.shopping, state.settings)
  check('cheaper chain is cheaper', rami.total < deal.total, true)
  check('rami = deal × 0.9', Math.round(rami.total * 100), Math.round(deal.total * 0.9 * 100))
  const eggs = deal.lines.find((l) => l.catalogId === 'eggs')
  check('6 eggs → 1 tray of 12', eggs.packs, 1)
  const salt = deal.lines.find((l) => l.catalogId === 'salt')
  check('salt is a staple, assumed at home', pricing.isHave(salt, state.shopping), true)
  const needSalt = pricing.priceList(needs, 'shufersal-deal', { ...state.shopping, need: ['salt'] }, state.settings)
  check('marking a staple as needed adds it to the total', Math.round((needSalt.total - deal.total) * 100), Math.round(salt.price * 100))
  const haveTomato = pricing.priceList(needs, 'shufersal-deal', { ...state.shopping, have: ['tomato'] }, state.settings)
  check('"have at home" comes off the total', haveTomato.total < deal.total, true)
  const doubled = pricing.planNeeds({ ...plan, days: [{ ...plan.days[0], servings: 8 }] }, [shakshuka], [])
  check('doubling servings → 12 eggs still one tray', pricing.priceList(doubled, 'shufersal-deal', state.shopping, state.settings).lines.find((l) => l.catalogId === 'eggs').packs, 1)
  const override = pricing.priceList(needs, 'shufersal-deal', state.shopping, { priceOverrides: { eggs: 20 } })
  check('price override applies', override.lines.find((l) => l.catalogId === 'eggs').price, 20)
  check('every library ingredient is priced', (await import('/src/data/library.ts')).LIBRARY.flatMap((l) => l.ingredients).filter(([, , , id]) => !catalog.CATALOG_BY_ID.get(id)).map(([n]) => n), [])

  // Timers in cook mode.
  check('detect minutes', recipes.detectTimers('אופים 25 דקות עד הזהבה').map((t) => t.seconds), [1500])
  check('detect range takes the upper bound', recipes.detectTimers('מבשלים 10-12 דקות').map((t) => t.seconds), [720])
  check('detect hours', recipes.detectTimers('מבשלים שעתיים או 2 שעות').map((t) => t.seconds), [7200])

  // Dates: Israeli week starts Sunday, local time not UTC.
  check('week starts Sunday', fmt.weekStartOf('2026-10-22'), '2026-10-18')
  check('formatQty fractions', [fmt.formatQty(1.5), fmt.formatQty(0.333), fmt.formatQty(437)], ['1½', '⅓', '435'])

  // Offline planner respects diet and budget.
  const profile = { ...state.profile, diets: ['vegetarian'], cookingDays: [0, 1, 2, 3, 4, 5, 6], weeklyBudget: 400 }
  const future = fmt.addDays(fmt.weekStartOf(fmt.today()), 7)
  const result = planner.offlinePlan({ ...state, profile }, future, [])
  const all = result.newRecipes
  check('vegetarian plan has no meat', all.some((r) => r.kashrut === 'meat'), false)
  check('plan fills every cooking night', result.days.length, 7)
  check('no repeated dish', new Set(result.days.map((d) => d.recipeId)).size, result.days.length)

  check('hydrate survives garbage', storage.hydrate({ recipes: 'nope', plan: { days: 3 } }).recipes, [])
  return out
})

let failed = 0
for (const r of results) {
  if (!r.pass) failed++
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : `  — got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)}`}`)
}

// ---- UI click-through on a clean profile
await page.evaluate(() => localStorage.clear())
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
const step = async (name, fn) => {
  try {
    await fn()
    console.log(`✓ ui: ${name}`)
  } catch (e) {
    failed++
    console.log(`✗ ui: ${name} — ${e.message.split('\n')[0]}`)
  }
}
await step('onboarding completes', async () => {
  await page.getByRole('button', { name: 'בואו נתחיל' }).click()
  await page.getByRole('button', { name: 'המשך' }).click()
  await page.getByRole('radio', { name: /רמי לוי/ }).click()
  await page.getByRole('button', { name: 'המשך' }).click()
  await page.getByRole('button', { name: 'המשך' }).click()
  await page.getByRole('button', { name: 'סיום' }).click()
  await page.getByRole('heading', { name: 'ספר המתכונים' }).waitFor()
})
await step('starter recipes are in the cookbook', async () => {
  await page.getByText('8 מתכונים שמורים').waitFor()
})
await step('search finds by ingredient', async () => {
  await page.getByLabel('חיפוש מתכונים').fill('עדשים')
  await page.getByText('מג\'דרה עם בצל מטוגן').first().waitFor()
  await page.getByLabel('חיפוש מתכונים').fill('')
})
await step('recipe page scales servings and prices at the chosen chain', async () => {
  await page.getByRole('button', { name: 'שקשוקה קלאסית' }).first().click()
  await page.getByText('ברמי לוי').waitFor()
  await page.getByRole('button', { name: 'יותר מנות' }).click()
  await page.getByText('5 מנות').waitFor()
})
await step('cook mode steps and timers', async () => {
  await page.getByRole('button', { name: /מצב בישול/ }).click()
  await page.getByText('שלב 1 מתוך 5').waitFor()
  await page.getByRole('button', { name: /טיימר 5 דקות/ }).click()
  await page.getByText(/4:5\d/).waitFor()
  await page.getByRole('button', { name: 'הבא ←' }).click()
  await page.getByText('שלב 2 מתוך 5').waitFor()
  await page.getByRole('button', { name: 'יציאה ממצב בישול' }).click()
})
await step('offline weekly plan builds and prices a list', async () => {
  await page.goto(`${URL_BASE}#/plan`)
  await page.getByRole('tab', { name: 'שבוע הבא' }).click()
  await page.getByRole('button', { name: /בניית תפריט לשבוע/ }).click()
  await page.getByText(/התפריט מוכן/).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: /לרשימה/ }).click()
  await page.getByRole('heading', { name: 'רשימת קניות' }).waitFor()
  await page.getByText('ירקות ופירות').waitFor()
})
await step('compare chains and switch', async () => {
  await page.getByRole('button', { name: /השוואה בין רשתות/ }).click()
  await page.getByText('🏆 אושר עד').waitFor()
})
await step('add manual item to the list', async () => {
  await page.getByLabel('הוספת פריט').fill('2 ליטר חלב')
  await page.locator('form.themebox').getByRole('button', { name: 'הוספה' }).click()
  await page.getByText('חלב 3%').waitFor()
})
await step('manual recipe entry', async () => {
  await page.goto(`${URL_BASE}#/edit`)
  await page.getByPlaceholder('למשל: הקציצות של אמא').fill('סלט טונה')
  await page.getByPlaceholder(/500 גרם בשר טחון/).fill('1 קופסה טונה\n2 ביצים\nמיונז לפי הטעם')
  await page.getByRole('button', { name: 'הוספת השורות' }).click()
  await page.getByRole('button', { name: 'שמירה' }).last().click()
  await page.getByRole('heading', { name: 'סלט טונה' }).waitFor()
})
await step('no page errors', async () => {
  if (errors.length) throw new Error(errors.join(' | '))
})

if (process.env.SCREENSHOTS) {
  for (const [route, name] of [['', 'cookbook'], ['plan', 'plan'], ['list', 'list']]) {
    await page.goto(`${URL_BASE}#/${route}`)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${process.env.SCREENSHOTS}/${name}.png`, fullPage: false })
  }
}

await browser.close()
console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
