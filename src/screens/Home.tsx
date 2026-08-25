import { useMemo } from 'react'
import { daysBetween, formatDate, formatMoney, relativeDays, todayKey } from '../lib/format'
import { useStore } from '../state/store'
import { Button, Chip, Empty } from '../components/ui'

export function Home({
  onOpenPlan,
  onPlanWith,
  onGoIdeas,
}: {
  onOpenPlan: (id: string) => void
  onPlanWith: (theme: string, generateNow?: boolean) => void
  onGoIdeas: () => void
}) {
  const { t, state, language, setSettings } = useStore()
  const { profile, plans, wishlist, settings } = state
  const today = todayKey()

  const upcoming = useMemo(
    () =>
      plans
        .filter((plan) => plan.status !== 'cancelled' && plan.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [plans, today],
  )

  const lastNight = useMemo(
    () =>
      plans
        .filter((plan) => plan.date < today && plan.status !== 'cancelled')
        .sort((a, b) => b.date.localeCompare(a.date))[0],
    [plans, today],
  )

  const daysSince = lastNight ? daysBetween(lastNight.date, today) : null
  const overdue = daysSince !== null && daysSince > settings.cadenceDays && settings.lastNudgeDismissed !== today

  const topIdeas = useMemo(
    () =>
      [...wishlist]
        .filter((item) => item.status === 'idea')
        .sort((a, b) => b.hearts.length - a.hearts.length || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3),
    [wishlist],
  )

  const names = [profile.partnerAName, profile.partnerBName].filter(Boolean)
  const greeting = profile.coupleName || (names.length === 2 ? t('{a} & {b}', { a: names[0], b: names[1] }) : names[0] || t('Date night'))

  const surprise = () => {
    const pool = wishlist.filter((item) => item.status === 'idea')
    const loved = pool.filter((item) => item.hearts.length >= 2)
    const source = loved.length ? loved : pool
    if (source.length) {
      const pick = source[Math.floor(Math.random() * source.length)]
      onPlanWith(`${pick.title}${pick.location ? ` near ${pick.location}` : profile.homeCity ? ` near ${profile.homeCity}` : ''}`, true)
      return
    }
    onPlanWith(t('surprise us with something we would not think of, near {city}', { city: profile.homeCity || 'us' }), true)
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{greeting}</h1>
        <span className="sub">
          {upcoming.length
            ? t('Next up {when}.', { when: relativeDays(upcoming[0].date, language) })
            : t('Nothing in the diary yet.')}
        </span>
      </div>

      {upcoming.length ? (
        <button
          type="button"
          className="hero"
          onClick={() => onOpenPlan(upcoming[0].id)}
          style={{ textAlign: 'start', border: 0, cursor: 'pointer', font: 'inherit' }}
        >
          <span className="muted">{relativeDays(upcoming[0].date, language)}</span>
          <h2>{upcoming[0].title}</h2>
          <p className="muted">
            {formatDate(upcoming[0].date, language, { weekday: 'long', day: 'numeric', month: 'long' })}
            {upcoming[0].stops[0] ? ` · ${upcoming[0].stops[0].startTime}` : ''}
          </p>
          <div className="row wrap" style={{ gap: 6 }}>
            {upcoming[0].stops.slice(0, 4).map((stop) => (
              <span
                key={stop.id}
                className="chip"
                style={{ background: 'rgb(255 255 255 / 0.18)', borderColor: 'transparent', color: '#fff' }}
              >
                {stop.venueName || stop.title}
              </span>
            ))}
          </div>
          {upcoming[0].calendarExportedAt ? null : (
            <span className="muted">📆 {t('Not in your calendar yet — tap to add it.')}</span>
          )}
        </button>
      ) : null}

      {overdue ? (
        <div className="card accent">
          <div className="row between top">
            <div className="grow">
              <h3>{t('It has been {n} days.', { n: daysSince! })}</h3>
              <p className="muted">{t('Last one was "{title}". Time for another?', { title: lastNight!.title })}</p>
            </div>
            <button
              type="button"
              className="iconbtn"
              aria-label={t('Dismiss')}
              onClick={() => setSettings({ lastNudgeDismissed: today })}
            >
              ✕
            </button>
          </div>
          <Button variant="primary" onClick={surprise}>
            ✨ {t('Surprise us')}
          </Button>
        </div>
      ) : null}

      <div className="card">
        <h3>{t('What are we doing?')}</h3>
        <div className="themebox">
          <input
            placeholder={t('bowling at evening near Tel Aviv')}
            aria-label={t('Date night theme')}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const value = (event.target as HTMLInputElement).value.trim()
                if (value) onPlanWith(value, true)
              }
            }}
          />
          <Button variant="primary" onClick={surprise} aria-label={t('Surprise us')}>
            🎲
          </Button>
        </div>
        <span className="faint">{t('Type a theme, or hit the dice to pull something off your list.')}</span>
      </div>

      {topIdeas.length ? (
        <div className="card">
          <div className="row between">
            <h3>💡 {t('On your list')}</h3>
            <Button size="small" variant="ghost" onClick={onGoIdeas}>
              {t('See all')}
            </Button>
          </div>
          {topIdeas.map((item) => (
            <button
              key={item.id}
              type="button"
              className="row between"
              onClick={() => onPlanWith(item.title)}
              style={{ background: 'none', border: 0, padding: '6px 0', cursor: 'pointer', textAlign: 'start', width: '100%' }}
            >
              <span className="grow truncate">{item.title}</span>
              {item.hearts.length >= 2 ? <Chip tone="gold">❤️❤️</Chip> : item.hearts.length === 1 ? <Chip tone="plain">❤️</Chip> : null}
            </button>
          ))}
        </div>
      ) : null}

      {plans.length ? (
        <div className="card tight">
          <div className="row wrap between">
            <span className="muted">🎉 {t('{n} nights together', { n: plans.filter((p) => p.status === 'done').length })}</span>
            <span className="muted">
              💸 {formatMoney(
                plans.reduce((sum, plan) => sum + (plan.actualCostPerPerson ?? 0), 0) * 2,
                profile.currency,
                language,
              )}{' '}
              {t('spent together')}
            </span>
          </div>
        </div>
      ) : (
        <Empty
          glyph="💘"
          title={t('Your first night out')}
          body={t('Type what you feel like doing and it will build the whole evening for you.')}
        />
      )}
    </div>
  )
}
