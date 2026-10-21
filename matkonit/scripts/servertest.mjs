/**
 * Server-side checks that need no API key and no network:
 * schema.org extraction, the no-AI import path, and the guard that stops pasted
 * links from reaching the internal network.   Run: npm run test:server
 */
import assert from 'node:assert/strict'
import { fromJsonLd, gatherSource, isoMinutes, detectPlatform, findUrl, sourceIsThin } from '../server/extract.mjs'
import { recipeFromJsonLd, normalizeRecipe } from '../server/normalize.mjs'

const tests = []
const test = (name, fn) => tests.push([name, fn])

const ld = {
  '@type': 'Recipe',
  name: 'Classic Banana Bread',
  recipeYield: ['8', '8 slices'],
  prepTime: 'PT15M',
  totalTime: 'PT1H15M',
  recipeIngredient: ['2 cups all-purpose flour', '3 ripe bananas', '1/2 cup butter, melted', '1 tsp baking soda', 'salt to taste'],
  recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ '@type': 'HowToStep', text: 'Preheat oven to 175°C.' }, { '@type': 'HowToStep', text: 'Mix and bake 60 minutes.' }] }],
  image: [{ url: 'https://example.com/b.jpg' }],
  author: [{ name: 'Sam' }],
}

test('ISO durations', () => {
  assert.equal(isoMinutes('PT1H15M'), 75)
  assert.equal(isoMinutes('P0DT45M'), 45)
})

test('platform detection and share-text URL extraction', () => {
  assert.equal(detectPlatform('https://vm.tiktok.com/ZM123/'), 'tiktok')
  assert.equal(detectPlatform('https://www.instagram.com/reel/abc/'), 'instagram')
  assert.equal(detectPlatform('https://youtu.be/xyz'), 'youtube')
  assert.equal(detectPlatform('https://www.10dakot.co.il/recipe/x'), 'web')
  assert.equal(findUrl('תראו את זה! https://www.tiktok.com/@chef/video/1?x=1 מטורף'), 'https://www.tiktok.com/@chef/video/1?x=1')
})

test('schema.org recipe → structured recipe without AI', () => {
  const raw = fromJsonLd(ld)
  assert.equal(raw.servings, 8)
  assert.equal(raw.cookMinutes, 60)
  assert.deepEqual(raw.steps, ['Preheat oven to 175°C.', 'Mix and bake 60 minutes.'])
  const recipe = recipeFromJsonLd(raw, { url: 'https://example.com/r', image: '', author: '' })
  assert.equal(recipe.ingredients[0].catalogId, 'flour')
  assert.equal(recipe.ingredients[0].unit, 'כוס')
  assert.equal(recipe.ingredients[2].qty, 0.5)
  assert.equal(recipe.ingredients[2].note, 'melted')
  assert.equal(recipe.ingredients[4].unit, 'לפי הטעם')
  assert.equal(recipe.kashrut, 'dairy', 'butter makes it dairy')
  assert.equal(recipe.author, 'Sam')
  assert.equal(recipe.imageUrl, 'https://example.com/b.jpg')
})

test('normalizer drops invented catalog ids and unsafe URLs', () => {
  const r = normalizeRecipe(
    { title: 'x', servings: 999, ingredients: [{ name: 'עגבניות', qty: 3, unit: "יח'", catalogId: 'made-up', note: '', group: '' }], steps: ['a'], kashrut: 'weird' },
    { imageUrl: 'javascript:alert(1)', sourceUrl: 'https://ok.example/' },
  )
  assert.equal(r.ingredients[0].catalogId, 'tomato')
  assert.equal(r.servings, 40)
  assert.equal(r.imageUrl, '')
  assert.equal(r.sourceUrl, 'https://ok.example/')
  assert.equal(r.kashrut, 'parve')
})

test('thin captions trigger research, full ones do not', () => {
  assert.equal(sourceIsThin({ caption: 'מתכון בביו 👇', pageText: '', ld: null }), true)
  assert.equal(sourceIsThin({ caption: 'מצרכים:\n2 כוסות קמח\n3 ביצים\n1 כוס סוכר\n' + 'מערבבים ואופים 30 דקות בחום 180 מעלות עד שהעוגה זהובה. '.repeat(5), pageText: '', ld: null }), false)
})

test('internal addresses are refused', async () => {
  for (const url of ['http://localhost:5173/', 'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.5/', 'file:///etc/passwd']) {
    await assert.rejects(gatherSource(url), undefined, url)
  }
})

let failed = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    failed++
    console.log(`✗ ${name} — ${error.message}`)
  }
}
console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
