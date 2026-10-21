import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { back, go } from '../lib/router'
import { detectTimers } from '../lib/recipes'
import { nowIso } from '../lib/format'
import { toast } from '../lib/toast'
import { Button, IconButton, Stars } from '../components/ui'
import { ingredientText } from './RecipeDetail'

interface Timer {
  id: string
  label: string
  endsAt: number
  total: number
  done: boolean
}

function beep() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.2
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.35)
      osc.stop(ctx.currentTime + i * 0.35 + 0.2)
    }
    navigator.vibrate?.([300, 150, 300, 150, 300])
  } catch {
    // No audio on this device — the flashing timer still shows.
  }
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Keeps the screen on while cooking — flour-covered hands can't unlock a phone. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) || null
      } catch {
        lock = null
      }
    }
    acquire()
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}

export default function CookMode({ id }: { id: string }) {
  const { state, recipe: find, patchRecipe, update } = useStore()
  const recipe = find(id)
  const [step, setStep] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const [timers, setTimers] = useState<Timer[]>([])
  const [now, setNow] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const touch = useRef<number | null>(null)
  useWakeLock()

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const due = timers.filter((t) => !t.done && t.endsAt <= now)
    if (!due.length) return
    beep()
    setTimers((list) => list.map((t) => (due.some((d) => d.id === t.id) ? { ...t, done: true } : t)))
  }, [now, timers])

  if (!recipe) {
    go('')
    return null
  }

  const steps = recipe.steps.length ? recipe.steps : ['אין שלבים במתכון הזה.']
  const current = steps[step]
  const suggestions = detectTimers(current)
  const scale = state.settings.cookFontScale
  const startTimer = (label: string, seconds: number) =>
    setTimers((list) => [...list, { id: `${Date.now()}`, label: `שלב ${step + 1}: ${label}`, endsAt: Date.now() + seconds * 1000, total: seconds, done: false }])

  const next = () => (step < steps.length - 1 ? setStep(step + 1) : setFinished(true))
  const prev = () => setStep(Math.max(0, step - 1))

  return (
    <div
      className="cook"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return
        const dx = e.changedTouches[0].clientX - touch.current
        // RTL: swiping left moves forward.
        if (dx < -60) next()
        if (dx > 60) prev()
        touch.current = null
      }}
    >
      <div className="row between">
        <IconButton label="יציאה ממצב בישול" onClick={() => back(`recipe/${recipe.id}`)}>
          ✕
        </IconButton>
        <span className="strong truncate">{recipe.title}</span>
        <div className="row" style={{ gap: 4 }}>
          <IconButton label="טקסט קטן יותר" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, cookFontScale: Math.max(0.8, scale - 0.15) } }))}>
            א-
          </IconButton>
          <IconButton label="טקסט גדול יותר" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, cookFontScale: Math.min(1.9, scale + 0.15) } }))}>
            א+
          </IconButton>
        </div>
      </div>

      <div className="cook-progress" aria-hidden>
        {steps.map((_, i) => (
          <span key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {finished ? (
        <div className="cook-step center col" style={{ alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: '3.5rem' }}>🎉</div>
          <h1>בתיאבון!</h1>
          <p className="muted">איך יצא?</p>
          <Stars value={recipe.rating} onChange={(rating) => patchRecipe(recipe.id, { rating })} />
          <Button
            variant="primary"
            onClick={() => {
              patchRecipe(recipe.id, { cookedCount: recipe.cookedCount + 1, lastCookedAt: nowIso() })
              toast('נרשם שבישלתם את זה', 'good')
              go('recipe', recipe.id)
            }}
          >
            סיום
          </Button>
        </div>
      ) : (
        <div className="cook-step">
          <div className="faint">
            שלב {step + 1} מתוך {steps.length}
          </div>
          <p style={{ fontSize: `${1.55 * scale}rem`, lineHeight: 1.45 }}>{current}</p>
          {suggestions.length ? (
            <div className="row wrap" style={{ gap: 8 }}>
              {suggestions.map((s, i) => (
                <Button key={i} onClick={() => startTimer(s.label, s.seconds)}>
                  ⏲ טיימר {s.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {timers.length ? (
        <div className="timers">
          {timers.map((t) => (
            <div key={t.id} className={`timer ${t.done ? 'done' : ''}`}>
              <span className="truncate grow">{t.label}</span>
              <span className="mono strong">{t.done ? 'הזמן נגמר!' : clock((t.endsAt - now) / 1000)}</span>
              <button type="button" className="iconbtn" aria-label="ביטול טיימר" onClick={() => setTimers((list) => list.filter((x) => x.id !== t.id))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showIngredients ? (
        <div className="card cook-ingredients">
          {recipe.ingredients.map((ing) => (
            <div key={ing.id}>
              <span className="qty">{ingredientText(ing, 1)}</span> {ing.name}
              {ing.note ? <span className="faint"> · {ing.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {!finished ? (
        <div className="row cook-nav">
          <Button onClick={prev} disabled={step === 0}>
            → הקודם
          </Button>
          <Button variant="ghost" onClick={() => setShowIngredients(!showIngredients)}>
            {showIngredients ? 'הסתרת מצרכים' : 'מצרכים'}
          </Button>
          <Button variant="primary" onClick={next}>
            {step === steps.length - 1 ? 'סיימתי' : 'הבא ←'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
