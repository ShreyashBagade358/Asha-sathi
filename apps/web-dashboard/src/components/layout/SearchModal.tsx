import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon, type IconName } from '@/components/common/Icons'
import { beneficiaryService } from '@/services/beneficiary.service'
import { householdService } from '@/services/household.service'

interface SearchEntry {
  id: string
  name: string
  meta: string
  to: string
}

const DEBOUNCE_MS = 300
const PAGE_SIZE = 5

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS)

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

  const enabled = open && debounced.length > 0

  const patients = useQuery({
    queryKey: ['search', 'beneficiaries', debounced],
    queryFn: () => beneficiaryService.listBeneficiaries({ search: debounced, page: 1, pageSize: PAGE_SIZE }),
    enabled,
  })

  const households = useQuery({
    queryKey: ['search', 'households', debounced],
    queryFn: () => householdService.listHouseholds({ search: debounced, page: 1, pageSize: PAGE_SIZE }),
    enabled,
  })

  const patientEntries: SearchEntry[] = (patients.data?.items ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    meta: [b.village, b.isPregnant ? 'Pregnant' : null, b.gender].filter(Boolean).join(' • '),
    to: `/asha/patients/${b.id}`,
  }))

  const householdEntries: SearchEntry[] = (households.data?.items ?? []).map((h) => ({
    id: h.id,
    name: h.headName || h.householdId,
    meta: [h.householdId, h.village].filter(Boolean).join(' • '),
    to: `/asha/households/${h.id}/visit`,
  }))

  const isSearching = patients.isFetching || households.isFetching
  const total = patientEntries.length + householdEntries.length
  const showResults = debounced.length > 0

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
          {!showResults ? (
            <p className="px-3 py-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('nav.searchHint')}
            </p>
          ) : isSearching && total === 0 ? (
            <p className="px-3 py-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('asha.syncing')}
            </p>
          ) : total === 0 ? (
            <p className="px-3 py-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('common.noResults')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {[
                { key: 'patients', entries: patientEntries, title: t('nav.searchPatients'), icon: 'users' as IconName },
                { key: 'households', entries: householdEntries, title: t('nav.searchHouseholds'), icon: 'box' as IconName },
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
