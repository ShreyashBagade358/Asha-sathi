import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'

interface SearchEntry {
  id: string
  name: string
  meta: string
  to: string
}

const SEARCH_DATA: { patients: SearchEntry[]; households: SearchEntry[]; villages: SearchEntry[] } = {
  patients: [
    { id: 'p1', name: 'Sita Devi', meta: 'BHF-2023-8942 • High Risk', to: '/asha/patients/1' },
    { id: 'p2', name: 'Ramesh Kumar', meta: 'BHF-2023-8890', to: '/asha/patients/2' },
    { id: 'p3', name: 'Anjali Devi', meta: 'BHF-2023-8876 • 3rd Trimester', to: '/asha/patients/3' },
    { id: 'p4', name: 'Sunita Patel', meta: 'BHF-2023-8841', to: '/asha/patients/4' },
  ],
  households: [
    { id: 'h1', name: 'HH-2023-8942', meta: 'Ramesh Kumar • Ward 3', to: '/asha/households' },
    { id: 'h2', name: 'HH-2023-8931', meta: 'Sunita Devi • Ward 1', to: '/asha/households' },
  ],
  villages: [
    { id: 'v1', name: 'Rampur', meta: 'Ward 1', to: '/asha/households' },
    { id: 'v2', name: 'Sitapur', meta: 'Ward 2', to: '/asha/households' },
    { id: 'v3', name: 'Lakshmanpur', meta: 'Ward 3', to: '/asha/households' },
  ],
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const matches = (entries: SearchEntry[]) =>
      entries.filter(
        (e) => e.name.toLowerCase().includes(q) || e.meta.toLowerCase().includes(q),
      )
    return {
      patients: matches(SEARCH_DATA.patients),
      households: matches(SEARCH_DATA.households),
      villages: matches(SEARCH_DATA.villages),
    }
  }, [query])

  const total = results ? results.patients.length + results.households.length + results.villages.length : 0

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[700]">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative mx-auto mt-20 w-[92%] max-w-lg overflow-hidden rounded-xl bg-surface-container-lowest shadow-modal animate-fade-up">
        <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
          <Icon name="search" size={20} className="text-on-surface-variant" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nav.searchPlaceholder')}
            className="h-10 flex-1 bg-transparent font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQuery('')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <Icon name="x" size={18} />
            </button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!results ? (
            <p className="px-3 py-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('nav.searchHint')}
            </p>
          ) : total === 0 ? (
            <p className="px-3 py-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('common.noResults')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[
                { key: 'patients', entries: results.patients, title: t('nav.searchPatients'), icon: 'users' as const },
                { key: 'households', entries: results.households, title: t('nav.searchHouseholds'), icon: 'box' as const },
                { key: 'villages', entries: results.villages, title: t('nav.searchVillages'), icon: 'mapPin' as const },
              ]
                .filter((group) => group.entries.length > 0)
                .map((group) => (
                  <div key={group.key}>
                    <p className="px-3 pb-1 pt-2 text-label-md uppercase tracking-wide text-on-surface-variant">
                      {group.title}
                    </p>
                    <ul className="space-y-0.5">
                      {group.entries.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => go(entry.to)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary">
                              <Icon name={group.icon} size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-body-md text-body-md font-semibold text-on-surface">
                                {entry.name}
                              </span>
                              <span className="block truncate font-caption text-caption text-on-surface-variant">
                                {entry.meta}
                              </span>
                            </span>
                            <Icon name="chevronRight" size={16} className="shrink-0 text-on-surface-variant" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
