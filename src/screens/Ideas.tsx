import { useMemo, useState } from 'react'
import type { WishItem, WishStatus } from '../types'
import { formatMoney } from '../lib/format'
import { useStore } from '../state/store'
import { Button, Chip, Empty, Field, IconButton, Segmented, Sheet, TagInput } from '../components/ui'

const TAG_SUGGESTIONS = ['food', 'outdoors', 'cheap', 'splurge', 'active', 'cosy', 'culture', 'weekend', 'day trip', 'rainy day']

export function Ideas({ onPlanWith }: { onPlanWith: (theme: string) => void }) {
  const { t, language, state, addWish, updateWish, removeWish, toggleHeart, me } = useStore()
  const [filter, setFilter] = useState<WishStatus | 'all'>('idea')
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<WishItem | null>(null)
  const [creating, setCreating] = useState(false)

  const allTags = useMemo(
    () => [...new Set(state.wishlist.flatMap((item) => item.tags))].sort(),
    [state.wishlist],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return state.wishlist
      .filter((item) => (filter === 'all' ? true : item.status === filter))
      .filter((item) => (tagFilter ? item.tags.includes(tagFilter) : true))
      .filter((item) =>
        needle ? `${item.title} ${item.notes} ${item.tags.join(' ')} ${item.location}`.toLowerCase().includes(needle) : true,
      )
      .sort((a, b) => b.hearts.length - a.hearts.length || b.createdAt.localeCompare(a.createdAt))
  }, [state.wishlist, filter, tagFilter, query])

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{t('Ideas')}</h1>
        <span className="sub">{t('Everything you have both said "we should do that" about.')}</span>
      </div>

      <div className="themebox">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search ideas')} />
        <Button variant="primary" onClick={() => setCreating(true)} aria-label={t('Add an idea')}>
          ＋
        </Button>
      </div>

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'idea', label: t('Ideas') },
          { value: 'planned', label: t('Planned') },
          { value: 'done', label: t('Done') },
          { value: 'all', label: t('All') },
        ]}
      />

      {allTags.length ? (
        <div className="scroller">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip ${tagFilter === tag ? 'on' : ''}`}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length ? (
        <div className="col">
          {visible.map((item) => (
            <div key={item.id} className="card tight">
              <div className="row between top">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="grow"
                  style={{ background: 'none', border: 0, padding: 0, textAlign: 'start', cursor: 'pointer', minWidth: 0 }}
                >
                  <h3>{item.title}</h3>
                  {item.notes ? <p className="muted">{item.notes}</p> : null}
                </button>
                <IconButton
                  label={item.hearts.includes(me) ? t('Remove your heart') : t('Heart this')}
                  on={item.hearts.includes(me)}
                  onClick={() => toggleHeart(item.id)}
                >
                  {item.hearts.includes(me) ? '❤️' : '🤍'}
                </IconButton>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {item.hearts.length >= 2 ? <Chip tone="gold">{t('You both want this')}</Chip> : null}
                {item.status === 'planned' ? <Chip tone="good">{t('Planned')}</Chip> : null}
                {item.status === 'done' ? <Chip tone="plain">✅ {t('Done')}</Chip> : null}
                {item.location ? <Chip tone="plain">📍 {item.location}</Chip> : null}
                {item.estCost ? <Chip tone="plain">{formatMoney(item.estCost, state.profile.currency, language)}</Chip> : null}
                {item.tags.map((tag) => (
                  <Chip key={tag} tone="plain">
                    {tag}
                  </Chip>
                ))}
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Button
                  size="small"
                  variant="primary"
                  onClick={() =>
                    onPlanWith(`${item.title}${item.location ? ` near ${item.location}` : ''}${item.notes ? ` — ${item.notes}` : ''}`)
                  }
                >
                  ✨ {t('Plan this')}
                </Button>
                {item.status !== 'done' ? (
                  <Button size="small" onClick={() => updateWish(item.id, { status: 'done' })}>
                    ✅ {t('Mark done')}
                  </Button>
                ) : (
                  <Button size="small" onClick={() => updateWish(item.id, { status: 'idea' })}>
                    ↩︎ {t('Back to ideas')}
                  </Button>
                )}
                {item.url ? (
                  <a className="btn small" href={item.url} target="_blank" rel="noreferrer">
                    🔗 {t('Link')}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          glyph="💡"
          title={t('Nothing here yet')}
          body={t('Add the things you keep saying you should do.')}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              ＋ {t('Add an idea')}
            </Button>
          }
        />
      )}

      {creating ? (
        <IdeaSheet
          tags={[...new Set([...TAG_SUGGESTIONS, ...allTags])]}
          onClose={() => setCreating(false)}
          onSave={(draft) => {
            addWish({ ...draft, title: draft.title })
            setCreating(false)
          }}
        />
      ) : null}

      {editing ? (
        <IdeaSheet
          item={editing}
          tags={[...new Set([...TAG_SUGGESTIONS, ...allTags])]}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            updateWish(editing.id, draft)
            setEditing(null)
          }}
          onDelete={() => {
            removeWish(editing.id)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function IdeaSheet({
  item,
  tags,
  onClose,
  onSave,
  onDelete,
}: {
  item?: WishItem
  tags: string[]
  onClose: () => void
  onSave: (draft: { title: string; notes: string; tags: string[]; location: string; url: string; estCost: number | null }) => void
  onDelete?: () => void
}) {
  const { t, state } = useStore()
  const [draft, setDraft] = useState({
    title: item?.title ?? '',
    notes: item?.notes ?? '',
    tags: item?.tags ?? [],
    location: item?.location ?? '',
    url: item?.url ?? '',
    estCost: item?.estCost ?? null,
  })

  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <Sheet
      title={item ? t('Edit idea') : t('Add an idea')}
      onClose={onClose}
      footer={
        <div className="col">
          <Button variant="primary" block disabled={!draft.title.trim()} onClick={() => onSave({ ...draft, title: draft.title.trim() })}>
            {t('Save')}
          </Button>
          {onDelete ? (
            <Button variant="danger" block onClick={onDelete}>
              {t('Delete this idea')}
            </Button>
          ) : null}
        </div>
      }
    >
      <Field label={t('What is it')}>
        <input
          className="input"
          autoFocus
          value={draft.title}
          onChange={(event) => set({ title: event.target.value })}
          placeholder={t('Sunrise hike, then breakfast')}
        />
      </Field>
      <Field label={t('Notes')}>
        <textarea className="textarea" value={draft.notes} onChange={(event) => set({ notes: event.target.value })} />
      </Field>
      <div className="row wrap" style={{ gap: 8 }}>
        <Field label={t('Where')}>
          <input className="input" value={draft.location} onChange={(event) => set({ location: event.target.value })} />
        </Field>
        <Field label={`${t('Rough cost each')} (${state.profile.currency})`}>
          <input
            className="input"
            type="number"
            min={0}
            value={draft.estCost ?? ''}
            onChange={(event) => set({ estCost: event.target.value === '' ? null : Number(event.target.value) })}
          />
        </Field>
      </div>
      <Field label={t('Link')}>
        <input className="input" inputMode="url" value={draft.url} onChange={(event) => set({ url: event.target.value })} />
      </Field>
      <Field label={t('Tags')}>
        <TagInput value={draft.tags} onChange={(next) => set({ tags: next })} suggestions={tags} placeholder={t('Add a tag')} />
      </Field>
    </Sheet>
  )
}
