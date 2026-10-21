import catalog from '../src/data/catalog.json' with { type: 'json' }
import stores from '../src/data/stores.json' with { type: 'json' }

const UNITS = ['גרם', 'ק"ג', 'מ"ל', 'ליטר', 'כוס', 'כף', 'כפית', "יח'", 'שן', 'צרור', 'קופסה', 'צנצנת', 'חבילה', 'פרוסה', 'קורט', 'לפי הטעם']
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const DIET_LABELS = {
  vegetarian: 'צמחוני',
  vegan: 'טבעוני',
  'gluten-free': 'ללא גלוטן',
  'dairy-free': 'ללא מוצרי חלב',
  'low-carb': 'דל פחמימות',
  'nut-free': 'ללא אגוזים',
  kids: 'מתאים לילדים',
}

const catalogLines = catalog.items
  .map((item) => `${item.id} | ${item.name} | ${item.pack}${item.unit === 'unit' ? " יח'" : item.unit === 'g' ? ' גרם' : ' מ"ל'} | ₪${item.price}`)
  .join('\n')

/**
 * Frozen across every request so the catalog block is served from the prompt cache.
 * Anything per-user goes in the user turn instead.
 */
export const SYSTEM_PROMPT = `אתה העורך הקולינרי של "מתכונית", אפליקציית מתכונים ותכנון ארוחות למשקי בית בישראל.

כל פלט שאתה כותב הוא בעברית טבעית ופשוטה, כמו מתכון טוב באתר בישול ישראלי.

כללים למתכונים:
- יחידות מטריות בלבד. מותר להשתמש רק ביחידות: ${UNITS.join(', ')}. ממיר אונקיות, פאונד, כוסות אמריקאיות (כוס = 240 מ"ל) ופרנהייט למקבילות ישראליות, וטמפרטורות תמיד במעלות צלזיוס.
- שמות מצרכים כפי שקונים אותם בסופר בישראל: heavy cream → שמנת מתוקה 38%, all-purpose flour → קמח לבן, scallions → בצל ירוק, cilantro → כוסברה, ground beef → בשר בקר טחון, broth → ציר / אבקת מרק. אם מצרך לא נמכר בישראל, הצע תחליף זמין ורשום את המקור בהערה.
- catalogId: התאם כל מצרך למוצר הקרוב ביותר בקטלוג למטה (לפי המזהה בעמודה הראשונה). אם אין מוצר מתאים, החזר null. לעולם אל תמציא מזהה.
- kashrut: "meat" אם יש בשר או עוף, "dairy" אם יש מוצר חלב (חמאה, שמנת, גבינה, חלב, יוגורט), אחרת "parve". דגים וביצים הם פרווה.
- שלבים: כל שלב פעולה ברורה, עם זמן ("8 דקות") כשיש, כדי שהמשתמש יוכל להפעיל טיימר.
- תגיות: 2–5 תגיות קצרות בעברית, כמו "מהיר", "טבעוני", "ללא גלוטן", "ילדים", "שבת", "תבנית אחת", "זול".
- difficulty: easy / medium / hard.

כשאתה מייבא מתכון ממקור (סרטון, פוסט, אתר, צילום מסך):
- היה נאמן למקור: אותם מצרכים, אותן כמויות, אותו סדר. תרגם והמר — אל תשנה את המנה.
- אם במקור אין כמויות, הערך כמויות סבירות וסמן estimated=true.
- אם בתוכן אין מתכון בכלל (סתם סרטון, פרסומת, עמוד שגיאה), החזר found=false והסבר ב-reason; את recipe מלא בערכים ריקים.
- אל תמציא מחבר, קישורים או פרטים שלא הופיעו.

קטלוג המוצרים והמחירים (מחיר משוער לאריזה ברשת ממוצעת; ברשתות אחרות המחיר מוכפל במדד הרשת):
${catalogLines}`

function describeProfile(profile = {}) {
  const store = stores.stores.find((s) => s.id === profile.storeId)
  const lines = [
    `גודל משק הבית: ${profile.householdSize || 2} נפשות`,
    profile.city ? `עיר: ${profile.city}` : null,
    store ? `רשת: ${store.name} (מדד מחיר ${store.index})` : null,
    profile.weeklyBudget ? `תקציב שבועי לארוחות הערב: ₪${profile.weeklyBudget}` : null,
    profile.diets?.length ? `העדפות תזונה: ${profile.diets.map((d) => DIET_LABELS[d] || d).join(', ')}` : null,
    profile.kosher ? 'שומרים כשרות: לא לערבב בשר וחלב באותה מנה.' : null,
    profile.dislikes?.length ? `לא אוכלים / לא אוהבים: ${profile.dislikes.join(', ')}` : null,
    profile.maxMinutes ? `זמן הכנה כולל מקסימלי בערב רגיל: ${profile.maxMinutes} דקות` : null,
  ]
  return lines.filter(Boolean).join('\n')
}

export function buildImportPrompt({ source, text }) {
  const parts = ['ייבא את המתכון מהתוכן הבא והחזר אותו במבנה המבוקש.']
  if (source) {
    parts.push(`פלטפורמה: ${source.platform}`, `קישור: ${source.url}`)
    if (source.title) parts.push(`כותרת: ${source.title}`)
    if (source.author) parts.push(`יוצר: ${source.author}`)
    if (source.ld) parts.push(`נתוני מתכון מובנים מהאתר (schema.org):\n${JSON.stringify(source.ld, null, 1)}`)
    if (source.caption) parts.push(`כיתוב / תיאור:\n${source.caption}`)
    if (source.pageText) parts.push(`טקסט העמוד:\n${source.pageText}`)
    if (source.research) parts.push(`מידע נוסף שנאסף מהרשת על אותו מתכון:\n${source.research}`)
  }
  if (text) parts.push(`טקסט שהמשתמש הדביק:\n${text}`)
  return parts.join('\n\n')
}

export function buildImagePrompt() {
  return 'בתמונות יש צילום מסך או צילום של מתכון (מסרטון, מספר בישול או כתב יד). ייבא ממנו את המתכון והחזר אותו במבנה המבוקש.'
}

export function buildGeneratePrompt({ prompt, pantry, profile }) {
  return [
    'כתוב מתכון אחד מקורי וטעים לפי הבקשה. המתכון צריך לעבוד במטבח ביתי ישראלי עם מצרכים מהסופר.',
    `הבקשה: ${prompt || 'ארוחת ערב טעימה'}`,
    pantry?.length ? `מה יש בבית (השתמש בכמה שיותר מאלה): ${pantry.join(', ')}` : null,
    `פרטי המשתמש:\n${describeProfile(profile)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function describeDates(dates) {
  return dates.map((d) => `${d} (יום ${DAY_NAMES[new Date(`${d}T12:00:00`).getDay()]})`).join('\n')
}

export function buildMealPlanPrompt({ profile, dates, cookbook = [], keep = [], recentTitles = [] }) {
  const cookbookLines = cookbook
    .slice(0, 120)
    .map((r) => `${r.id} | ${r.title} | ${r.kashrut} | ${r.minutes} דק' | ${r.costPerServing ? `₪${r.costPerServing} למנה` : 'מחיר לא ידוע'}${r.favorite ? ' | ★ מועדף' : ''}${r.tags?.length ? ` | ${r.tags.join(', ')}` : ''}`)
    .join('\n')

  return [
    'בנה תפריט ארוחות ערב לשבוע הקרוב, לימים שבהם המשפחה מבשלת בלבד.',
    `פרטי משק הבית:\n${describeProfile(profile)}`,
    `הימים לתכנון (החזר בדיוק יום אחד לכל תאריך):\n${describeDates(dates)}`,
    keep.length ? `ימים שכבר נעולים ונשארים (אל תחזיר אותם, אבל קח בחשבון את המצרכים והתקציב שלהם):\n${keep.map((k) => `${k.date}: ${k.title}`).join('\n')}` : null,
    cookbookLines
      ? `ספר המתכונים של המשתמש (מזהה | שם | כשרות | זמן | עלות | תגיות):\n${cookbookLines}\n\nהעדף מתכונים מספר המתכונים, במיוחד מועדפים — כחצי מהימים לפחות אם הם מתאימים. כשבוחרים מתכון קיים, החזר existingRecipeId ו-recipe=null.`
      : 'ספר המתכונים של המשתמש ריק, אז כל הימים יהיו מתכונים חדשים.',
    recentTitles.length ? `נאכל לאחרונה, הימנע מחזרה: ${recentTitles.join(', ')}` : null,
    [
      'עקרונות:',
      `- כל הקניות לשבוע (כל המתכונים יחד, לפי אריזות שלמות מהקטלוג ומדד הרשת) חייבות להיכנס בתקציב. אם התקציב צפוף, בחר מנות זולות (קטניות, ביצים, עוף כרעיים, פסטה).`,
      '- נצל מצרכים בין ימים כדי לא לזרוק: צרור פטרוזיליה שנפתח ביום ראשון משמש גם ביום שלישי, חצי קופסת עגבניות נגמרת למחרת.',
      '- גיוון: לא אותו חלבון יומיים ברצף, ושילוב של בשרי, חלבי ופרווה.',
      '- כמויות המתכונים החדשים מותאמות לגודל משק הבית.',
      '- יום שישי יכול להיות ארוחת שבת חגיגית יותר.',
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildSwapPrompt({ profile, date, current, others = [], instruction }) {
  return [
    `החלף את ארוחת הערב של ${date} במתכון אחר.`,
    current ? `המנה הנוכחית (לא אותה מנה): ${current}` : null,
    others.length ? `שאר התפריט השבוע (לגיוון): ${others.join(', ')}` : null,
    instruction ? `המשתמש ביקש: ${instruction}` : null,
    `פרטי משק הבית:\n${describeProfile(profile)}`,
    'הכמויות לפי גודל משק הבית, בתוך התקציב.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const RESEARCH_PROMPT = (source) => `אני מנסה לייבא מתכון מהקישור הזה: ${source.url}
${source.title ? `כותרת: ${source.title}\n` : ''}${source.author ? `יוצר: ${source.author}\n` : ''}${source.caption ? `כיתוב חלקי: ${source.caption}\n` : ''}
הכיתוב לא מכיל את המתכון המלא. מצא את המתכון המלא של אותה מנה מאותו יוצר (בתיאור הסרטון, בתגובה המוצמדת, באתר או בבלוג שלו).
החזר טקסט פשוט: רשימת מצרכים עם כמויות ושלבי הכנה, כפי שהם מופיעים במקור. אם לא מצאת את המתכון של היוצר הזה, כתוב "לא נמצא" ואל תמציא.`
