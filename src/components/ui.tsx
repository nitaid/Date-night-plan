import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'

export function Button({
  children,
  variant = 'default',
  size,
  block,
  busy,
  ...rest
}: {
  children: ReactNode
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'onhero'
  size?: 'small'
  block?: boolean
  busy?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = ['btn', variant, size, block ? 'block' : '', rest.className || ''].filter(Boolean).join(' ')
  return (
    <button {...rest} className={classes} disabled={rest.disabled || busy}>
      {busy ? <span className="spinner" /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  on,
  children,
  ...rest
}: { label: string; on?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`iconbtn ${on ? 'on' : ''} ${rest.className || ''}`} aria-label={label} title={label}>
      {children}
    </button>
  )
}

export function Chip({
  children,
  on,
  tone,
  onClick,
}: {
  children: ReactNode
  on?: boolean
  tone?: 'gold' | 'good' | 'plain'
  onClick?: () => void
}) {
  const classes = ['chip', on ? 'on' : '', tone || '', onClick ? '' : 'static'].filter(Boolean).join(' ')
  if (!onClick) return <span className={classes}>{children}</span>
  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Labels a form control. The label is wired to the control with htmlFor/id so
 * screen readers (and tests) can associate them — the id is injected into the
 * child rather than asked for at every call site.
 */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  const id = useId()
  const hintId = `${id}-hint`
  const control =
    isValidElement(children) && !(children.props as { id?: string }).id
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id,
          ...(hint ? { 'aria-describedby': hintId } : {}),
        })
      : children

  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      {control}
      {hint ? (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? 'on' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}

export function Stars({
  value,
  onChange,
  readOnly,
}: {
  value: number | null
  onChange?: (value: number) => void
  readOnly?: boolean
}) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${value && n <= value ? 'on' : ''}`}
          disabled={readOnly}
          aria-label={`${n} of 5`}
          onClick={() => onChange?.(n)}
        >
          ★
        </button>
      ))}
    </span>
  )
}

export function Empty({ glyph, title, body, action }: { glyph: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{glyph}</div>
      <h3>{title}</h3>
      {body ? <p className="muted">{body}</p> : null}
      {action}
    </div>
  )
}

/** Comma/enter separated tags with removable pills. */
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  id: providedId,
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  suggestions?: string[]
  /** Injected by `Field` so its label points at the text input. */
  id?: string
}) {
  const [draft, setDraft] = useState('')
  const fallbackId = useId()
  const id = providedId ?? fallbackId

  const commit = (raw: string) => {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const part of parts) if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part)
    onChange(next)
    setDraft('')
  }

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))

  return (
    <div className="col" style={{ gap: 8 }}>
      {value.length ? (
        <div className="row wrap" style={{ gap: 6 }}>
          {value.map((tag) => (
            <span key={tag} className="chip">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== tag))}
                aria-label={`Remove ${tag}`}
                style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        id={id}
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit(draft)
          } else if (event.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
      />
      {unused.length ? (
        <div className="row wrap" style={{ gap: 6 }}>
          {unused.slice(0, 8).map((suggestion) => (
            <Chip key={suggestion} tone="plain" onClick={() => commit(suggestion)}>
              + {suggestion}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string; tone: string }[]
  onDismiss: (id: string) => void
}) {
  if (!toasts.length) return null
  return (
    <div
      style={{
        position: 'fixed',
        insetInline: 12,
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onDismiss(item.id)}
          className={`banner ${item.tone === 'error' ? 'error' : item.tone === 'good' ? 'good' : ''}`}
          style={{
            pointerEvents: 'auto',
            maxWidth: 520,
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer',
            textAlign: 'start',
            border: 0,
          }}
        >
          {item.message}
        </button>
      ))}
    </div>
  )
}
