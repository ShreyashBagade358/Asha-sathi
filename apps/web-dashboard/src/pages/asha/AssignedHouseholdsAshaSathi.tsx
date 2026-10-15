import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
import { ashaService } from '@/services/asha.service'
import { Icon, type IconName } from '@/components/common/Icons'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { householdService } from '@/services/household.service'

const PAGE_SIZE = 1000
const DEBOUNCE_MS = 300

type FilterKey = 'all' | 'planned' | 'visited' | 'pregnant'
type Cta = 'visit' | 'review' | 'planned'

const FILTERS: FilterKey[] = ['all', 'planned', 'visited', 'pregnant']
const FILTER_LABEL: Record<FilterKey, string> = {
  all: 'asha.filterAll',
  planned: 'asha.planned',
  visited: 'asha.filterVisited',
  pregnant: 'asha.filterPregnant',
}

const STATUS: Record<Cta, { labelKey: string; chip: string; icon: IconName; rail: string }> = {
  visit: {
    labelKey: 'asha.visitDue',
    chip: 'bg-error-container text-on-error-container',
    icon: 'alert',
    rail: 'bg-error',
  },
  review: {
    labelKey: 'asha.followUp',
    chip: 'bg-secondary-container text-on-secondary-container',
    icon: 'checkCircle',
    rail: 'bg-secondary',
  },
  planned: {
    labelKey: 'asha.scheduled',
    chip: 'bg-surface-container text-on-surface-variant',
    icon: 'calendar',
    rail: 'bg-outline-variant',
  },
}

const OPEN_TASK_STATUSES = new Set(['pending', 'in_progress', 'open'])
const DONE_TASK_STATUSES = new Set(['completed', 'done'])

interface HouseholdStats {
  openTasks: number
  completedTasks: number
  nextTaskDate?: string
  lastVisitDate?: string
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(date: string, today: string): number {
  const then = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(then) || Number.isNaN(now)) return 0
  return Math.max(0, Math.round((now - then) / 86_400_000))
}

function formatDay(iso?: string): string {
  if (!iso) return ''
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function minDay(current: string | undefined, next: string): string {
  if (!current) return next
  return next < current ? next : current
}

function maxDay(current: string | undefined, next: string): string {
  if (!current) return next
  return next > current ? next : current
}

function statsOf(map: Map<string, HouseholdStats>, householdId: string): HouseholdStats {
  return map.get(householdId) ?? { openTasks: 0, completedTasks: 0 }
}

function ctaFor(stats: HouseholdStats, today: string): Cta {
  if (stats.openTasks === 0 && stats.completedTasks > 0) return 'review'
  if (stats.nextTaskDate && stats.nextTaskDate > today) return 'planned'
  return 'visit'
}

export default function AssignedHouseholdsAshaSathi() {
  const { t } = useLocalization()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const debouncedQuery = useDebounced(query.trim(), DEBOUNCE_MS)

  // `/households?q=` only matches `hhid`, so name/address searches are
  // filtered client-side from the full list instead.
  const serverSearch = /^hh/i.test(debouncedQuery) ? debouncedQuery : undefined

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['households', 'asha-assigned', { search: serverSearch ?? '', ashaId: user?.id ?? '' }],
    // The page is "assigned to you": scope the fetch to this ASHA's own
    // households. The backend also scopes ASHA-role requests server-side.
    queryFn: () =>
      householdService.listHouseholds({ search: serverSearch, ashaId: user?.id, page: 1, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const tasksQuery = useQuery({
    queryKey: ['asha', 'tasks', 'household-status'],
    queryFn: () => ashaService.listMyTasks({}),
    staleTime: 60_000,
  })

  const households = useMemo(() => data?.items ?? [], [data])
  const today = todayISO()

  // Same derivation as the mobile card: open tasks decide Start Visit vs
  // Planned, completed tasks decide Review Record, plus the last/next dates.
  const statsByHousehold = useMemo(() => {
    const map = new Map<string, HouseholdStats>()
    for (const task of tasksQuery.data ?? []) {
      if (!task.householdId) continue
      const stats =
        map.get(task.householdId) ?? { openTasks: 0, completedTasks: 0, nextTaskDate: undefined, lastVisitDate: undefined }
      const day = task.taskDate || task.completedTime?.slice(0, 10) || ''
      if (OPEN_TASK_STATUSES.has(task.status)) {
        stats.openTasks += 1
        if (day) stats.nextTaskDate = minDay(stats.nextTaskDate, day)
      } else if (DONE_TASK_STATUSES.has(task.status)) {
        stats.completedTasks += 1
        if (day) stats.lastVisitDate = maxDay(stats.lastVisitDate, day)
      }
      map.set(task.householdId, stats)
    }
    return map
  }, [tasksQuery.data])

  const searched = useMemo(() => {
    const needle = debouncedQuery.toLowerCase()
    if (!needle) return households
    return households.filter((household) =>
      [household.householdId, household.headName, household.address, household.village].some(
        (value) => String(value ?? '').toLowerCase().includes(needle),
      ),
    )
  }, [households, debouncedQuery])

  const counts = useMemo(
    () => ({
      all: searched.length,
      planned: searched.filter(
        (household) => ctaFor(statsOf(statsByHousehold, household.id), today) === 'planned',
      ).length,
      visited: searched.filter((household) => statsOf(statsByHousehold, household.id).completedTasks > 0)
        .length,
      pregnant: searched.filter((household) => household.pregnantWomen > 0).length,
    }),
    [searched, statsByHousehold, today],
  )

  const visible = useMemo(
    () =>
      searched.filter((household) => {
        if (filter === 'all') return true
        const stats = statsOf(statsByHousehold, household.id)
        if (filter === 'visited') return stats.completedTasks > 0
        if (filter === 'pregnant') return household.pregnantWomen > 0
        return ctaFor(stats, today) === 'planned'
      }),
    [searched, filter, statsByHousehold, today],
  )

  const hasQuery = debouncedQuery.length > 0 || filter !== 'all'

  const resetFilters = () => {
    setQuery('')
    setFilter('all')
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Icon name="search" size={18} className="absolute inset-y-0 left-3.5 my-auto text-on-surface-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('asha.householdSearchPlaceholder')}
            aria-label={t('asha.householdSearchPlaceholder')}
            className="h-touch-target w-full rounded-lg border border-outline bg-surface-container-lowest pl-10 pr-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-label-md text-label-md font-semibold transition-colors ${
                filter === key
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {t(FILTER_LABEL[key])}
              <span
                className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
                  filter === key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading || tasksQuery.isLoading ? (
        <LoadingState label={t('common.loading')} />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : households.length === 0 && !serverSearch ? (
        <EmptyState
          icon="home"
          title={t('asha.noHouseholds')}
          description={t('asha.householdsEmptyHint')}
          action={
            <Link
              to="/asha/households/new"
              className="mt-2 inline-flex h-touch-target items-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
            >
              <Icon name="plus" size={18} />
              {t('asha.addHousehold')}
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="search"
          title={t('common.noResults')}
          action={
            hasQuery ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 inline-flex h-touch-target items-center gap-2 rounded-full border border-outline-variant px-5 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <Icon name="x" size={18} />
                {t('common.clear')}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((household) => {
            const stats = statsOf(statsByHousehold, household.id)
            const cta = ctaFor(stats, today)
            const status = STATUS[cta]
            const meta =
              cta === 'planned' && stats.nextTaskDate
                ? t('asha.nextVisit', { day: formatDay(stats.nextTaskDate) })
                : cta === 'review' && stats.lastVisitDate
                  ? t('asha.lastVisit', { days: daysAgo(stats.lastVisitDate, today) })
                  : null

            return (
              <article
                key={household.id}
                className={`relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card ${
                  cta === 'planned' ? 'opacity-75' : ''
                }`}
              >
                <span className={`absolute bottom-0 left-0 top-0 w-2 ${status.rail}`} />
                <div className="flex flex-col gap-2 p-5 pl-8">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                        <Link to={`/asha/households/${household.id}`} className="hover:text-primary">
                          {household.headName || household.householdId}
                        </Link>
                      </h3>
                      <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
                        <Icon name="users" size={16} />
                        {t('asha.familySize', { count: household.memberCount })}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-caption text-caption font-bold ${status.chip}`}
                    >
                      <Icon name={status.icon} size={14} />
                      {t(status.labelKey)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body-md text-body-md text-on-surface-variant">
                    <span className="font-caption text-caption">{household.householdId}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      <Icon name="mapPin" size={14} />
                      <span className="truncate">{household.address || household.village || '—'}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {household.pregnantWomen > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-3 py-1 font-caption text-caption font-bold text-on-tertiary-container">
                        <Icon name="heart" size={14} />
                        {t('asha.pregnantCount', { count: household.pregnantWomen })}
                      </span>
                    ) : null}
                    {household.childrenUnder5 > 0 ? (
                      <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
                        {t('asha.childrenUnder5', { count: household.childrenUnder5 })}
                      </span>
                    ) : null}
                    {meta ? (
                      <span className="font-caption text-caption text-on-surface-variant">{meta}</span>
                    ) : null}
                  </div>
                </div>

                <div className="p-5 pt-0 pl-8">
                  {cta === 'visit' ? (
                    <Link
                      to={`/asha/households/${household.id}/visit`}
                      className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                    >
                      <Icon name="activity" size={18} />
                      {t('asha.startVisit')}
                    </Link>
                  ) : cta === 'review' ? (
                    <Link
                      to={`/asha/households/${household.id}`}
                      className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full border-2 border-primary font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-primary-container"
                    >
                      <Icon name="eye" size={18} />
                      {t('asha.reviewRecord')}
                    </Link>
                  ) : (
                    <Link
                      to={`/asha/households/${household.id}`}
                      className="flex h-touch-target w-full items-center justify-center gap-2 rounded-full bg-surface-container font-label-md text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                    >
                      <Icon name="calendar" size={18} />
                      {t('asha.planned')}
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <button
        type="button"
        aria-label={t('asha.addHousehold')}
        onClick={() => navigate('/asha/households/new')}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg transition-all hover:bg-on-primary-fixed-variant active:scale-95 lg:bottom-8"
      >
        <Icon name="plus" size={28} />
      </button>
    </div>
  )
}
