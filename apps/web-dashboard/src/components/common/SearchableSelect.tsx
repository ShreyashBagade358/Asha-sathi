import { useEffect, useMemo, useRef, useState } from 'react'

export interface SearchableOption {
  id: string
  name: string
  code?: string
}

interface SearchableSelectProps {
  id?: string
  label?: string
  options: SearchableOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  disabledHint?: string
  emptyLabel?: string
  error?: string
  required?: boolean
  showCode?: boolean
  /** Matches the surrounding form inputs (h-12 vs the compact py-2.5 rows). */
  compact?: boolean
}

const MAX_RENDER = 200

const FIELD_CLS =
  'w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function SearchableSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  loading = false,
  loadingLabel = 'Loading…',
  disabled = false,
  disabledHint,
  emptyLabel = 'No options',
  error,
  required = false,
  showCode = false,
  compact = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const fieldCls = `${FIELD_CLS} ${compact ? 'py-2.5' : 'h-12'} ${
    disabled ? 'cursor-not-allowed opacity-50' : ''
  }`

  return (
    <div className="flex flex-col gap-1" ref={wrapRef}>
      {label && (
        <label className="text-label-md text-on-surface-variant" htmlFor={id}>
          {label}
          {required && ' *'}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled || loading}
          onClick={() => setOpen((o) => !o)}
          className={`${fieldCls} flex items-center justify-between gap-2 text-left`}
        >
          <span
            className={`truncate ${selected ? 'text-on-surface' : 'text-on-surface-variant'}`}
          >
            {loading ? loadingLabel : selected ? selected.name : (disabled ? disabledHint ?? placeholder : placeholder)}
          </span>
          <span className="material-symbols-outlined shrink-0 text-[20px] text-on-surface-variant">
            {loading ? 'progress_activity' : 'search'}
          </span>
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-outline bg-surface shadow-lg">
            <div className="flex items-center gap-2 border-b border-outline-variant px-3 py-2">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                search
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered.length > 0) {
                    e.preventDefault()
                    pick(filtered[0].id)
                  }
                }}
                placeholder="Type to filter…"
                className="h-8 w-full bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/70"
              />
              <span className="shrink-0 rounded-full bg-surface-container-highest px-2 py-0.5 text-caption font-semibold text-on-surface-variant tabular-nums">
                {filtered.length} / {options.length}
              </span>
            </div>

            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {loading && (
                <li className="px-4 py-3 text-label-sm text-on-surface-variant">{loadingLabel}</li>
              )}
              {!loading && filtered.length === 0 && (
                <li className="px-4 py-3 text-label-sm text-on-surface-variant">{emptyLabel}</li>
              )}
              {!loading &&
                filtered.slice(0, MAX_RENDER).map((o) => {
                  const isSelected = o.id === value
                  return (
                    <li key={o.id} role="option" aria-selected={isSelected}>
                      <button
                        type="button"
                        onClick={() => pick(o.id)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-container-highest ${
                          isSelected ? 'bg-primary/10' : ''
                        }`}
                      >
                        <span className="truncate text-label-sm font-medium text-on-surface">
                          {o.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {showCode && o.code && (
                            <span className="text-caption text-on-surface-variant">{o.code}</span>
                          )}
                          {isSelected && (
                            <span className="material-symbols-outlined text-[16px] text-primary">
                              check
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              {!loading && filtered.length > MAX_RENDER && (
                <li className="px-4 py-2 text-caption text-on-surface-variant">
                  Showing {MAX_RENDER} of {filtered.length} matches — keep typing to narrow down.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-caption text-error">{error}</p>}
    </div>
  )
}
