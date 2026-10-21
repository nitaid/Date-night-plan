import { z } from 'zod'

export const IngredientSchema = z.object({
  name: z.string().describe('שם המצרך בעברית, כפי שקוראים לו בסופר בישראל'),
  qty: z.number().nullable().describe('כמות מספרית; null עבור "לפי הטעם"'),
  unit: z.string().describe('אחת מהיחידות המותרות'),
  note: z.string().describe('הערה קצרה: "קצוץ", "בטמפרטורת החדר", או ריק'),
  group: z.string().describe('כותרת קבוצה במתכון, למשל "לרוטב"; ריק לרשימה הראשית'),
  catalogId: z.string().nullable().describe('מזהה מוצר מהקטלוג, או null אם אין התאמה'),
})

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string().describe('משפט או שניים שמתארים את המנה'),
  servings: z.number(),
  prepMinutes: z.number(),
  cookMinutes: z.number(),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()).describe('שלבי הכנה, כל שלב פעולה אחת או שתיים, עם זמנים וטמפרטורות במעלות צלזיוס'),
  tags: z.array(z.string()),
  kashrut: z.enum(['meat', 'dairy', 'parve']),
  cuisine: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tips: z.array(z.string()),
  caloriesPerServing: z.number().nullable(),
})

export const ImportSchema = z.object({
  found: z.boolean().describe('false אם בתוכן אין מתכון אמיתי'),
  reason: z.string().describe('כשאין מתכון: הסבר קצר בעברית. אחרת ריק'),
  estimated: z.boolean().describe('true אם נאלצת להעריך כמויות שלא הופיעו במקור'),
  recipe: RecipeSchema,
})

export const MealPlanSchema = z.object({
  note: z.string().describe('משפט אחד על ההיגיון של התפריט, למשל איך הוא עומד בתקציב'),
  days: z.array(
    z.object({
      date: z.string().describe('YYYY-MM-DD מתוך הרשימה שקיבלת'),
      existingRecipeId: z.string().nullable().describe('מזהה מתכון מספר המתכונים של המשתמש, או null'),
      recipe: RecipeSchema.nullable().describe('מתכון חדש מלא כשאין existingRecipeId'),
    }),
  ),
})

export const SingleRecipeSchema = z.object({ recipe: RecipeSchema })
