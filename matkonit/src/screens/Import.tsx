import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { go } from '../lib/router'
import { ApiError, aiStatus, generateRecipe, imageToBase64, importImages, importText, importUrl, type RecipeDraft } from '../lib/api'
import { makeRecipe } from '../lib/recipes'
import { toast } from '../lib/toast'
import { Button, Field, Segmented, TagInput } from '../components/ui'
import type { Source } from '../types'

type Mode = 'link' | 'photo' | 'text' | 'ai'

const STAGES = {
  link: ['פותחים את הקישור…', 'קוראים את הכיתוב והתיאור…', 'מסדרים מצרכים וכמויות…', 'ממירים ליחידות ישראליות…', 'כמעט מוכן…'],
  photo: ['קוראים את התמונה…', 'מזהים מצרכים ושלבים…', 'כמעט מוכן…'],
  text: ['קוראים את הטקסט…', 'מסדרים מצרכים ושלבים…', 'כמעט מוכן…'],
  ai: ['חושבים על משהו טעים…', 'בודקים מה יש בסופר…', 'כותבים את השלבים…', 'כמעט מוכן…'],
}

const PLATFORM_SOURCE: Record<string, Source> = { tiktok: 'tiktok', instagram: 'instagram', youtube: 'youtube', facebook: 'facebook', web: 'web' }

export default function ImportScreen({ shared }: { shared: string | null }) {
  const { state, saveRecipe } = useStore()
  const [mode, setMode] = useState<Mode>('link')
  const [link, setLink] = useState(shared || '')
  const [text, setText] = useState('')
  const [prompt, setPrompt] = useState('')
  const [pantry, setPantry] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ai, setAi] = useState<boolean | null>(null)
  const controller = useRef<AbortController | null>(null)
  const autoStarted = useRef(false)

  useEffect(() => {
    aiStatus().then((s) => setAi(s.ai))
  }, [])

  useEffect(() => {
    if (!busy) return
    setStage(0)
    const timer = setInterval(() => setStage((s) => s + 1), 2800)
    return () => clearInterval(timer)
  }, [busy])

  const finish = (draft: RecipeDraft, source: Source, estimated?: boolean) => {
    const recipe = makeRecipe(draft, source)
    saveRecipe(recipe)
    toast(estimated ? 'נשמר. חלק מהכמויות הן הערכה, כדאי לעבור עליהן.' : 'המתכון נשמר בספר המתכונים', 'good')
    go('recipe', recipe.id)
  }

  const run = async (work: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusy(true)
    setError(null)
    try {
      await work(ctrl.signal)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError(e instanceof ApiError ? e.message : 'משהו השתבש. נסו שוב.')
    } finally {
      setBusy(false)
    }
  }

  const doLink = () =>
    run(async (signal) => {
      const result = await importUrl(link, link, signal)
      finish(result.recipe, PLATFORM_SOURCE[result.platform || 'web'] || 'web', result.estimated)
      if (!result.ai) toast('יובא מהאתר בלי AI, ולכן בשפת המקור', 'info')
    })

  // Arriving from the share sheet: start immediately, like the original app does.
  useEffect(() => {
    if (shared && !autoStarted.current) {
      autoStarted.current = true
      doLink()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared])

  const doPhoto = () =>
    run(async (signal) => {
      const images = await Promise.all(files.slice(0, 6).map((f) => imageToBase64(f)))
      const result = await importImages(images, signal)
      finish(result.recipe, 'photo', result.estimated)
    })

  const doText = () =>
    run(async (signal) => {
      const result = await importText(text, signal)
      finish(result.recipe, 'text', result.estimated)
    })

  const doAi = () =>
    run(async (signal) => {
      const result = await generateRecipe(prompt, pantry, state.profile, signal)
      finish(result.recipe, 'ai')
    })

  const stages = STAGES[mode === 'link' ? 'link' : mode]
  const needsAi = mode !== 'link' && ai === false

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>הוספת מתכון</h1>
        <p className="sub">מסרטון, מאתר, מצילום מסך, או מאפס</p>
      </header>

      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError(null)
        }}
        options={[
          { value: 'link', label: 'קישור' },
          { value: 'photo', label: 'צילום' },
          { value: 'text', label: 'טקסט' },
          { value: 'ai', label: '✨ AI' },
        ]}
      />

      {busy ? (
        <div className="card thinking">
          <div className="pulse">🍳</div>
          <p className="strong">{stages[Math.min(stage, stages.length - 1)]}</p>
          <p className="faint">זה לוקח בדרך כלל 15–40 שניות</p>
          <Button variant="ghost" onClick={() => controller.current?.abort()}>
            ביטול
          </Button>
        </div>
      ) : (
        <>
          {mode === 'link' ? (
            <div className="col">
              <Field label="קישור לסרטון או למתכון" hint="TikTok, Instagram Reels, YouTube Shorts, Facebook, או כל אתר מתכונים">
                <textarea className="textarea" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.tiktok.com/@…" rows={3} />
              </Field>
              <div className="row">
                <Button
                  onClick={async () => {
                    try {
                      setLink(await navigator.clipboard.readText())
                    } catch {
                      toast('אין גישה ללוח. הדביקו ידנית.', 'error')
                    }
                  }}
                >
                  📋 הדבקה
                </Button>
                <Button variant="primary" block onClick={doLink} disabled={!/https?:\/\//.test(link)}>
                  ייבוא המתכון
                </Button>
              </div>
              <div className="card flat tight">
                <p className="strong">הכי מהיר: לשתף ישר מהאפליקציה</p>
                <p className="faint">
                  באנדרואיד, אחרי שמוסיפים את מתכונית למסך הבית, היא מופיעה ברשימת השיתוף של טיקטוק ואינסטגרם. באייפון מעתיקים קישור (שיתוף ← העתקת קישור) ולוחצים כאן "הדבקה".
                </p>
              </div>
              {ai === false ? <div className="banner">בלי מפתח AI אפשר לייבא רק מאתרי מתכונים עם סימון מובנה. סרטונים וצילומים דורשים AI.</div> : null}
            </div>
          ) : null}

          {mode === 'photo' ? (
            <div className="col">
              <label className="dropzone">
                <input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...(e.target.files || [])])} />
                <span style={{ fontSize: '2rem' }}>📸</span>
                <span className="strong">{files.length ? `${files.length} תמונות נבחרו` : 'בחירת צילומי מסך או צילום של מתכון'}</span>
                <span className="faint">צילום מסך מסרטון, דף מספר בישול, או המתכון בכתב היד של סבתא</span>
              </label>
              <Button variant="primary" block onClick={doPhoto} disabled={!files.length || needsAi}>
                קריאת המתכון מהתמונה
              </Button>
            </div>
          ) : null}

          {mode === 'text' ? (
            <div className="col">
              <Field label="הדביקו את טקסט המתכון" hint="מתיאור של סרטון, מהודעת וואטסאפ, או מכל מקום">
                <textarea className="textarea" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'2 כוסות קמח\n3 ביצים\n…'} />
              </Field>
              <Button variant="primary" block onClick={doText} disabled={!text.trim() || needsAi}>
                סידור המתכון
              </Button>
            </div>
          ) : null}

          {mode === 'ai' ? (
            <div className="col">
              <Field label="מה בא לכם?" hint="למשל: ארוחת ערב צמחונית מהירה לילדים, משהו עם עוף ובטטה, עוגה בלי ביצים">
                <textarea className="textarea" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </Field>
              <Field label="מה יש לכם במקרר? (לא חובה)">
                <TagInput value={pantry} onChange={setPantry} placeholder="חצי כרובית, יוגורט, שמנת…" suggestions={['ביצים', 'עוף', 'אורז', 'פסטה', 'עגבניות', 'גבינה צהובה']} />
              </Field>
              <Button variant="primary" block onClick={doAi} disabled={(!prompt.trim() && !pantry.length) || needsAi}>
                ✨ כתבו לי מתכון
              </Button>
            </div>
          ) : null}

          {needsAi ? <div className="banner">האפשרות הזו דורשת מפתח AI בשרת (ANTHROPIC_API_KEY). אפשר לייבא קישור לאתר מתכונים או להזין ידנית.</div> : null}
          {error ? <div className="banner error">{error}</div> : null}

          <hr className="divider" />
          <Button variant="ghost" onClick={() => go('edit')}>
            ✎ או הזנה ידנית
          </Button>
        </>
      )}
    </div>
  )
}
