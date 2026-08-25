import { useEffect, useRef, useState } from 'react'
import type { Plan, Stop } from '../types'
import { addDays, nextWeekday, todayKey } from '../lib/format'
import { requestPlan } from '../lib/planApi'
import { useStore } from '../state/store'
import { PlanView } from '../components/PlanView'
import { Button, Field } from '../components/ui'

const IDEAS = [
  'bowling in the evening near Tel Aviv',
  'a quiet dinner and a long walk by the sea',
  'something we have never done before, under 200 each',
  'live music then late dessert',
  'a lazy Saturday afternoon, no plans, no rush',
  'rainy day, indoors, still fun',
]

export function Planner({ seedTheme, onOpenPlan }: { seedTheme?: string | null; onOpenPlan: (id: string) => void }) {
  const { t, state, savePlan, toast, updateWish } = useStore()
  const { profile } = state

  const [theme, setTheme] = useState(seedTheme ?? '')
  const [date, setDate] = useState(() => nextWeekday(5))
  const [startTime, setStartTime] = useState(profile.defaultStartTime)
  const [durationHours, setDurationHours] = useState(profile.defaultDurationHours)
  const [extraNotes, setExtraNotes] = useState('')
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Plan | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const generate = async (themeText: string) => {
    const trimmed = themeText.trim()
    if (!trimmed) {
      toast(t('Tell it what kind of night you want first.'), 'error')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const result = await requestPlan(
        {
          theme: trimmed,
          language: state.settings.language,
          date,
          startTime,
          durationHours,
          extraNotes,
          profile,
          wishlist: state.wishlist,
          recentPlans: state.plans,
        },
        state.settings.me,
      )
      setDraft(result.plan)
      setNotice(result.notice)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast(t('Something went wrong building that plan.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Arriving from "plan this" elsewhere in the app: build it straight away.
  const autoRan = useRef(false)
  useEffect(() => {
    if (seedTheme && !autoRan.current) {
      autoRan.current = true
      generate(seedTheme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedTheme])

  const patchDraft = (patch: Partial<Plan>) => setDraft((current) => (current ? { ...current, ...patch } : current))

  const patchStop = (stopId: string, patch: Partial<Stop>) =>
    setDraft((current) => {
      if (!current) return current
      const stops = current.stops.map((stop) => (stop.id === stopId ? { ...stop, ...patch } : stop))
      return { ...current, stops, totalCostPerPerson: stops.reduce((sum, s) => sum + s.costPerPerson, 0) }
    })

  if (busy && !draft) {
    return (
      <div className="screen">
        <div className="thinking">
          <div className="pulse">💘</div>
          <h2>{t('Building your evening')}</h2>
          <p className="muted">{t('Finding places, working out the timings, checking it all fits together.')}</p>
        </div>
      </div>
    )
  }

  if (draft) {
    return (
      <div className="screen">
        {notice ? <div className="banner">{t(notice)}</div> : null}
        <PlanView
          plan={draft}
          editable
          onChange={patchDraft}
          onStopChange={patchStop}
          onRemoveStop={(stopId) =>
            setDraft((current) => (current ? { ...current, stops: current.stops.filter((s) => s.id !== stopId) } : current))
          }
          onAddStop={(stop) => setDraft((current) => (current ? { ...current, stops: [...current.stops, stop] } : current))}
          onReplaceStop={(stopId, stop) =>
            setDraft((current) =>
              current ? { ...current, stops: current.stops.map((s) => (s.id === stopId ? stop : s)) } : current,
            )
          }
          footer={
            <div className="col">
              <Button
                variant="primary"
                block
                onClick={() => {
                  const saved: Plan = { ...draft, status: draft.calendarExportedAt ? 'scheduled' : 'draft' }
                  savePlan(saved)
                  // Anything from the ideas list that made it into the plan is now planned.
                  for (const item of state.wishlist) {
                    if (draft.stops.some((stop) => stop.venueName === item.title || stop.title === item.title)) {
                      updateWish(item.id, { status: 'planned', plannedPlanId: saved.id })
                    }
                  }
                  toast(t('Saved to your nights.'), 'good')
                  setDraft(null)
                  onOpenPlan(saved.id)
                }}
              >
                💾 {t('Save this evening')}
              </Button>
              <div className="row" style={{ gap: 8 }}>
                <Button block busy={busy} onClick={() => generate(theme)}>
                  🔁 {t('Try a different plan')}
                </Button>
                <Button block variant="ghost" onClick={() => setDraft(null)}>
                  {t('Start over')}
                </Button>
              </div>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{t('Plan a night')}</h1>
        <span className="sub">{t('Describe the night you want. Change anything after.')}</span>
      </div>

      <div className="themebox">
        <input
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && generate(theme)}
          placeholder={t('bowling at evening near Tel Aviv')}
          aria-label={t('Date night theme')}
        />
        <Button variant="primary" busy={busy} onClick={() => generate(theme)} aria-label={t('Build the plan')}>
          ✨
        </Button>
      </div>

      <div className="scroller">
        {IDEAS.map((idea) => (
          <button key={idea} type="button" className="chip" onClick={() => setTheme(idea)}>
            {idea}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="row wrap" style={{ gap: 8 }}>
          <Field label={t('When')}>
            <input className="input" type="date" min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t('Start')}>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {[
            { label: t('Tonight'), value: todayKey() },
            { label: t('Tomorrow'), value: addDays(todayKey(), 1) },
            { label: t('Friday'), value: nextWeekday(5) },
            { label: t('Saturday'), value: nextWeekday(6) },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              className={`chip ${date === option.value ? 'on' : ''}`}
              onClick={() => setDate(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {more ? (
          <>
            <Field label={t('Roughly how many hours')}>
              <input
                className="input"
                type="number"
                min={1}
                max={12}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
              />
            </Field>
            <Field label={t('Anything specific for this night')} hint={t('Occasions, someone visiting, a budget cap, a mood.')}>
              <textarea
                className="textarea"
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                placeholder={t('It is our anniversary and we want to be home by midnight.')}
              />
            </Field>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setMore(true)}>
            {t('More options')}
          </Button>
        )}
      </div>

      <p className="faint center">
        {t('It knows your budget, dietary needs and what you have already done — set those in Settings.')}
      </p>
    </div>
  )
}
