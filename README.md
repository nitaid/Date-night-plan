# Date Night

A date-night planner for two. Type what kind of evening you want — *"bowling at
evening near Tel Aviv"* — and it builds the whole night: where to eat first,
the main event, where to go after, with times, costs, booking links and map
links. Change anything you like, then drop it straight into Apple Calendar and
Google Calendar.

Installs to your phone's home screen as a proper app. Works offline.

---

## Run it

```bash
npm install
cp .env.example .env      # optional — see below
npm run dev               # http://localhost:5173
```

That's it. The app is fully usable with no configuration at all — it just uses
the built-in planner instead of the AI one.

For a production build:

```bash
npm run build
npm start                 # serves dist/ + /api/plan on http://localhost:4173
```

## Turning on the AI planner

Plans get dramatically better with Claude behind them: it understands the vibe
you asked for, knows the city, and names real places.

1. Get a key at <https://console.anthropic.com/settings/keys>
2. Put it in `.env`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Restart.

Settings → AI planner will confirm it's connected.

The key is only ever read **server-side** (`server/planHandler.mjs`) and never
reaches the browser. Costs a few cents per plan. The model defaults to
`claude-opus-5`; override with `DATE_NIGHT_MODEL` if you want.

**Without a key** — or if the API is down, rate limited, or you're on a train
with no signal — the app falls back to a built-in planner that composes an
evening from a curated library of date shapes and real neighbourhoods, and
tells you it did. You always get a plan. (The built-in planner writes in
English only; the AI planner follows whichever language the app is set to.)

## Sharing between your two phones

Optional. Without it, each phone keeps its own copy and you can move data
across with Settings → Export/Restore a backup.

With it, you both see the same wishlist and plans, live.

1. Create a free project at <https://supabase.com>
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql)
3. Add to `.env`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

4. Both of you: Settings → sign in with your own email (magic link). One of you
   copies the invite code from Settings, the other pastes it into "join their
   space".

Row-level security means only the two of you can read or write your data;
membership can only be granted through the two `security definer` functions in
the schema, so nobody can add themselves to your space.

Edits merge per item using each item's own timestamp, so two people editing
different things at the same time never overwrite each other.

## Tests

There is a self-test for the parts that would quietly lose data if they were
wrong — merging state between two phones, the time maths around midnight, and
ICS generation. It loads the real modules through the dev server rather than
reimplementing them.

```bash
npm i -D playwright && npx playwright install chromium   # once
npm run dev                                              # in one terminal
npm test                                                 # in another
```

## Deploying

**Vercel** — connect the repo, add `ANTHROPIC_API_KEY` (and the Supabase vars
if you're using them) as environment variables. `vercel.json` and
`api/plan.mjs` handle the rest. Note that Hobby caps functions at 60s; if a
plan takes longer the client falls back to the built-in planner rather than
failing.

**Anywhere else** — `npm run build && npm start` serves everything from one
Node process with no dependencies beyond what's already installed.

## Installing on your phone

- **iPhone**: open the site in Safari → Share → Add to Home Screen
- **Android**: open in Chrome → menu → Install app

## What it does

**Plan a night** — describe an evening in a sentence and get a full itinerary:
2–4 stops that flow in one direction geographically, with realistic timings,
travel gaps, per-person costs, dress code, weather note and a backup plan.

**Change anything** — swap any stop for one of its alternatives, ask for
"something else here" (optionally telling it what you'd rather do), edit any
detail by hand, add a blank stop, pull a stop in from your ideas list, or lock
a stop so it survives a regenerate.

**Calendar** — one `.ics` download that opens straight into Apple Calendar with
every stop as its own timed event, plus one-tap Google Calendar links (per stop
or the whole evening as one) and Outlook. Optional reminder before you set off
and travel-time blocks between stops. Times are floating local time, so nothing
shifts when you travel.

**Ideas** — a shared wishlist. Each of you hearts things independently; two
hearts means you both want it. Tag, search, filter, note a rough cost and a
link, and turn any idea into a full plan in one tap.

**Booking** — each stop tracks whether it's still to book, booked or confirmed,
with a phone link, booking link, map link and Waze link, plus a checklist of
what to sort before the night.

**Nights** — everything coming up and everything behind you. After a night has
passed, rate it, note what it actually cost, and write down the bit you want to
remember. Plans you rated poorly won't get suggested again.

**Everything else** — dark mode, English and Hebrew with full RTL, a nudge when
it's been too long since the last one, "surprise us" that pulls from your
wishlist, share a plan as text, backup export/restore, and it all works offline.

## Privacy

Everything lives on your device, plus your own Supabase project if you set one
up. The only thing that leaves your phone is the theme you type plus your
preferences (budget, dietary needs, city, past venue names), which go to the
Anthropic API to build the plan. No analytics, no third-party services.

## Layout

```
server/           plan generation — prompt, schema, normalizer, HTTP handler
  planHandler.mjs the /api/plan endpoint, shared by dev, Vercel and npm start
  prompt.mjs      system + user prompts built from the couple's profile
  planSchema.mjs  the zod schema the model's output must satisfy
  normalize.mjs   defensive cleanup of whatever the model returns
api/plan.mjs      Vercel wrapper around the same handler
src/lib/          calendar/ICS, offline planner, storage + merge, cloud sync
src/components/   plan view, stop card, calendar sheet, UI primitives
src/screens/      home, ideas, planner, nights, plan detail, settings
supabase/         SQL schema for the optional shared space
```

The AI is deliberately given no ability to invent contact details: the prompt
forbids fabricated phone numbers, addresses and booking URLs, and
`normalize.mjs` strips any URL that isn't plain `http(s)` before it reaches the
UI. Every venue comes with a map search string you can check.
