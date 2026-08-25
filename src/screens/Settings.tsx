import { useEffect, useRef, useState } from 'react'
import type { Budget, Transport } from '../types'
import { isCloudConfigured } from '../lib/sync'
import { checkAiStatus } from '../lib/planApi'
import { exportStateFile, readStateFile } from '../lib/storage'
import { useStore } from '../state/store'
import { Button, Field, Segmented, TagInput } from '../components/ui'

const INTERESTS = ['food', 'live music', 'art', 'theatre', 'hiking', 'beach', 'board games', 'film', 'dancing', 'markets', 'wine', 'sport']
const DIETARY = ['vegetarian', 'vegan', 'kosher', 'halal', 'gluten free', 'nut allergy', 'lactose intolerant', 'no alcohol']
const AVOID = ['loud clubs', 'crowds', 'horror', 'early mornings', 'long queues', 'heights', 'spicy food']

export function Settings() {
  const { t, state, setProfile, setSettings, sync, signIn, signOutOfCloud, joinWithCode, importState, toast } = useStore()
  const { profile, settings } = state
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [ai, setAi] = useState<{ ai: boolean; model: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    checkAiStatus().then(setAi)
  }, [])

  const names = [profile.partnerAName || t('Partner one'), profile.partnerBName || t('Partner two')]

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{t('Settings')}</h1>
        <span className="sub">{t('The better this is filled in, the better the plans get.')}</span>
      </div>

      <div className="card">
        <h3>💞 {t('Us')}</h3>
        <Field label={t('What do you call yourselves')}>
          <input className="input" value={profile.coupleName} onChange={(e) => setProfile({ coupleName: e.target.value })} />
        </Field>
        <div className="row wrap" style={{ gap: 8 }}>
          <Field label={t('One of you')}>
            <input className="input" value={profile.partnerAName} onChange={(e) => setProfile({ partnerAName: e.target.value })} />
          </Field>
          <Field label={t('The other')}>
            <input className="input" value={profile.partnerBName} onChange={(e) => setProfile({ partnerBName: e.target.value })} />
          </Field>
        </div>
        <Field label={t('Which one is this phone?')} hint={t('So hearts and ideas show who added them.')}>
          <Segmented
            value={settings.me}
            onChange={(me) => setSettings({ me })}
            options={[
              { value: 'a', label: names[0] },
              { value: 'b', label: names[1] },
            ]}
          />
        </Field>
        <Field label={t('Anniversary')}>
          <input className="input" type="date" value={profile.anniversary} onChange={(e) => setProfile({ anniversary: e.target.value })} />
        </Field>
      </div>

      <div className="card">
        <h3>📍 {t('Where and how')}</h3>
        <Field label={t('Home base')} hint={t('The city or area plans start from.')}>
          <input
            className="input"
            value={profile.homeCity}
            placeholder={t('Tel Aviv')}
            onChange={(e) => setProfile({ homeCity: e.target.value })}
          />
        </Field>
        <Field label={t('How far you will travel: {n} km', { n: profile.radiusKm })}>
          <input
            type="range"
            min={2}
            max={150}
            step={1}
            value={profile.radiusKm}
            onChange={(e) => setProfile({ radiusKm: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </Field>
        <Field label={t('Getting around')}>
          <select className="select" value={profile.transport} onChange={(e) => setProfile({ transport: e.target.value as Transport })}>
            <option value="walking">{t('On foot')}</option>
            <option value="transit">{t('Public transport')}</option>
            <option value="car">{t('We drive')}</option>
            <option value="taxi">{t('Taxis and ride-shares')}</option>
            <option value="bike">{t('Bikes or scooters')}</option>
          </select>
        </Field>
        <Field label={t('Usual budget')}>
          <select className="select" value={profile.budget} onChange={(e) => setProfile({ budget: e.target.value as Budget })}>
            <option value="shoestring">{t('Shoestring — cheap and cheerful')}</option>
            <option value="moderate">{t('Moderate — a normal night out')}</option>
            <option value="generous">{t('Generous — treat ourselves')}</option>
            <option value="splurge">{t('Splurge — special occasion')}</option>
          </select>
        </Field>
        <Field label={t('Currency')}>
          <input
            className="input"
            value={profile.currency}
            maxLength={3}
            onChange={(e) => setProfile({ currency: e.target.value.toUpperCase() })}
          />
        </Field>
      </div>

      <div className="card">
        <h3>🎯 {t('What you like')}</h3>
        <Field label={t('Into')}>
          <TagInput value={profile.interests} onChange={(interests) => setProfile({ interests })} suggestions={INTERESTS} placeholder={t('Add something you love')} />
        </Field>
        <Field label={t('Never again')} hint={t('Plans will steer around these.')}>
          <TagInput value={profile.avoid} onChange={(avoid) => setProfile({ avoid })} suggestions={AVOID} placeholder={t('Add something to avoid')} />
        </Field>
        <Field label={t('Food needs')} hint={t('These are treated as hard rules, never suggestions.')}>
          <TagInput value={profile.dietary} onChange={(dietary) => setProfile({ dietary })} suggestions={DIETARY} placeholder={t('Add a dietary need')} />
        </Field>
        <Field label={t('Accessibility')}>
          <TagInput value={profile.accessibility} onChange={(accessibility) => setProfile({ accessibility })} placeholder={t('Step-free, quiet rooms, anything else')} />
        </Field>
        <Field label={t('Anything else worth knowing')}>
          <textarea className="textarea" value={profile.notes} onChange={(e) => setProfile({ notes: e.target.value })} />
        </Field>
      </div>

      <div className="card">
        <h3>⏰ {t('Defaults')}</h3>
        <div className="row wrap" style={{ gap: 8 }}>
          <Field label={t('Usual start time')}>
            <input className="input" type="time" value={profile.defaultStartTime} onChange={(e) => setProfile({ defaultStartTime: e.target.value })} />
          </Field>
          <Field label={t('Usual length (hours)')}>
            <input
              className="input"
              type="number"
              min={1}
              max={12}
              value={profile.defaultDurationHours}
              onChange={(e) => setProfile({ defaultDurationHours: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label={t('Nudge us if it has been {n} days', { n: settings.cadenceDays })}>
          <input
            type="range"
            min={3}
            max={60}
            value={settings.cadenceDays}
            onChange={(e) => setSettings({ cadenceDays: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </Field>
      </div>

      <div className="card">
        <h3>🎨 {t('App')}</h3>
        <Field label={t('Theme')}>
          <Segmented
            value={settings.theme}
            onChange={(theme) => setSettings({ theme })}
            options={[
              { value: 'system', label: t('Auto') },
              { value: 'light', label: t('Light') },
              { value: 'dark', label: t('Dark') },
            ]}
          />
        </Field>
        <Field label={t('Language')}>
          <Segmented
            value={settings.language}
            onChange={(language) => setSettings({ language })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'he', label: 'עברית' },
            ]}
          />
        </Field>
      </div>

      <div className="card">
        <h3>🔄 {t('Sharing between your phones')}</h3>
        {!isCloudConfigured() ? (
          <>
            <p className="muted">{t('Cloud sync is not set up, so everything lives on this device only.')}</p>
            <p className="faint">{t('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to turn on live sync — see the README. Until then, use the backup file below to move things across.')}</p>
          </>
        ) : sync.state === 'live' ? (
          <>
            <p className="muted">✅ {t('Synced live as {email}.', { email: sync.email || '' })}</p>
            {sync.inviteCode ? (
              <Field label={t('Invite code for your partner')} hint={t('They install the app, sign in with their own email, then enter this code.')}>
                <input className="input mono" readOnly value={sync.inviteCode} onFocus={(e) => e.target.select()} />
              </Field>
            ) : null}
            <Field label={t('Or join their space instead')}>
              <div className="row">
                <input className="input mono" value={code} placeholder="ABCD1234" onChange={(e) => setCode(e.target.value.toUpperCase())} />
                <Button
                  busy={busy}
                  disabled={code.trim().length < 4}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await joinWithCode(code)
                      toast(t('Joined. Your lists are now shared.'), 'good')
                      setCode('')
                    } catch (error: any) {
                      toast(String(error?.message || error), 'error')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {t('Join')}
                </Button>
              </div>
            </Field>
            <Button variant="danger" onClick={() => signOutOfCloud()}>
              {t('Sign out')}
            </Button>
          </>
        ) : (
          <>
            <p className="muted">{t('Sign in with your email and you will both see the same lists and plans, live.')}</p>
            <div className="row">
              <input
                className="input"
                type="email"
                inputMode="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                variant="primary"
                busy={busy}
                disabled={!email.includes('@')}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await signIn(email)
                    toast(t('Check your email for the sign-in link.'), 'good')
                  } catch (error: any) {
                    toast(String(error?.message || error), 'error')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {t('Send link')}
              </Button>
            </div>
            {sync.message ? <div className="banner error">{sync.message}</div> : null}
          </>
        )}
      </div>

      <div className="card">
        <h3>🤖 {t('AI planner')}</h3>
        {ai === null ? (
          <p className="muted">{t('Checking…')}</p>
        ) : ai.ai ? (
          <p className="muted">✅ {t('Connected, using {model}.', { model: ai.model })}</p>
        ) : (
          <>
            <p className="muted">{t('No API key on the server, so plans come from the built-in planner.')}</p>
            <p className="faint">{t('Add ANTHROPIC_API_KEY to your .env and restart to turn on AI planning.')}</p>
          </>
        )}
      </div>

      <div className="card">
        <h3>💾 {t('Your data')}</h3>
        <p className="faint">{t('Everything is stored on your device (and in your own Supabase project if you set one up). Nothing else leaves your phone except the theme you type, which goes to the planner.')}</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Button onClick={() => exportStateFile(state)}>⬇️ {t('Export a backup')}</Button>
          <Button onClick={() => fileInput.current?.click()}>⬆️ {t('Restore a backup')}</Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            try {
              importState(await readStateFile(file))
              toast(t('Backup merged in.'), 'good')
            } catch {
              toast(t('That file did not look like a backup.'), 'error')
            }
            event.target.value = ''
          }}
        />
      </div>

      <p className="faint center">{t('Date Night · built for two')}</p>
    </div>
  )
}
