import type { Recipe } from '../types'
import { formatMinutes, shekel } from '../lib/format'
import { KASHRUT_LABEL, totalMinutes } from '../lib/recipes'

const KASHRUT_GLYPH = { meat: '🍖', dairy: '🧀', parve: '🥗' }

export function RecipeThumb({ recipe, size = 'card' }: { recipe: Pick<Recipe, 'imageUrl' | 'kashrut' | 'title'>; size?: 'card' | 'row' | 'hero' }) {
  return (
    <div className={`thumb ${size} k-${recipe.kashrut}`}>
      {recipe.imageUrl ? (
        <img src={recipe.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
      ) : null}
      <span className="thumb-glyph" aria-hidden>
        {KASHRUT_GLYPH[recipe.kashrut]}
      </span>
    </div>
  )
}

export function RecipeCard({
  recipe,
  costPerServing,
  onOpen,
  onFavorite,
  action,
}: {
  recipe: Recipe
  costPerServing?: number
  onOpen: () => void
  onFavorite?: () => void
  action?: React.ReactNode
}) {
  return (
    <article className="recipe-card">
      <button type="button" className="recipe-card-hit" onClick={onOpen} aria-label={recipe.title}>
        <RecipeThumb recipe={recipe} />
      </button>
      {onFavorite ? (
        <button type="button" className={`fav ${recipe.favorite ? 'on' : ''}`} onClick={onFavorite} aria-label={recipe.favorite ? 'הסרה מהמועדפים' : 'הוספה למועדפים'} aria-pressed={recipe.favorite}>
          {recipe.favorite ? '♥' : '♡'}
        </button>
      ) : null}
      <div className="recipe-card-body" onClick={onOpen}>
        <h3 className="clamp2">{recipe.title}</h3>
        <div className="row wrap faint" style={{ gap: 6 }}>
          <span>{formatMinutes(totalMinutes(recipe))}</span>
          <span>·</span>
          <span>{KASHRUT_LABEL[recipe.kashrut]}</span>
          {costPerServing ? (
            <>
              <span>·</span>
              <span>{shekel(costPerServing, 0)} למנה</span>
            </>
          ) : null}
        </div>
      </div>
      {action ? <div className="recipe-card-action">{action}</div> : null}
    </article>
  )
}
