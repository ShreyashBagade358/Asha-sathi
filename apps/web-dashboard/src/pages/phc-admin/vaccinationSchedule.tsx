import { Fragment, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { vaccinationService } from '@/services/vaccination.service'
import type { Immunization } from '@/types'
import type { VaccinationScheduleEntry } from '@/services/vaccination.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const AGE_GROUP_ORDER = ['Birth', '6 weeks', '10 weeks', '14 weeks', '9-12 months', '16-24 months', '5-6 years', '10-16 years']

const STATUS_CHIPS: Record<string, { label: string; className: string; icon: string }> = {
  given: { label: 'Given', className: 'bg-secondary-container text-on-secondary-container', icon: 'check_circle' },
  due: { label: 'Due', className: 'bg-primary-container text-on-primary-container', icon: 'schedule' },
  overdue: { label: 'Overdue', className: 'bg-error-container text-on-error-container', icon: 'warning' },
  upcoming: { label: 'Upcoming', className: 'bg-surface-container-high text-on-surface-variant', icon: 'event_upcoming' },
}

function statusChip(status: string) {
  return STATUS_CHIPS[status] ?? STATUS_CHIPS.upcoming
}

function baseVaccineCode(code: string): string {
  return code.toUpperCase().replace(/\d+$/, '')
}

function ageMonthsAt(iso: string | null | undefined, dob: string | null): number | null {
  if (!iso || !dob) return null
  const end = new Date(iso).getTime()
  const start = new Date(dob).getTime()
  if (Number.isNaN(end) || Number.isNaN(start)) return null
  return (end - start) / (30.4375 * 86400000)
}

function childAgeInMonths(dob: string | null): number | null {
  return ageMonthsAt(new Date().toISOString(), dob)
}

function computeStatusFromAge(entry: VaccinationScheduleEntry, childMonths: number | null): 'due' | 'overdue' | 'upcoming' {
  if (childMonths == null) return 'upcoming'
  if (childMonths >= entry.age_months + 2) return 'overdue'
  if (childMonths >= entry.age_months - 0.5) return 'due'
  return 'upcoming'
}

function expectedDueDate(entry: VaccinationScheduleEntry, dob: string | null): string {
  if (!dob) return ''
  const start = new Date(dob).getTime()
  if (Number.isNaN(start)) return ''
  return new Date(start + entry.age_months * 30.4375 * 86400000).toISOString().slice(0, 10)
}

interface MergedDose {
  key: string
  vaccineCode: string
  vaccineName: string
  dose: number
  age: string
  status: 'given' | 'due' | 'overdue' | 'upcoming'
  date: string
  route: string
  site: string
  inSchedule: boolean
}

function mergeScheduleWithRecorded(
  schedule: VaccinationScheduleEntry[],
  recorded: Immunization[],
  childDob: string | null,
): { gridRows: MergedDose[]; extraRecorded: Immunization[] } {
  const childMonths = childAgeInMonths(childDob)

  // Group schedule entries and recorded doses by normalized vaccine code so
  // legacy dose numbering (e.g. seed data's OPV-0..3 vs NIP OPV0/OPV1..4)
  // still lines up via age ordering.
  const schedByBase = new Map<string, VaccinationScheduleEntry[]>()
  for (const entry of schedule) {
    const base = baseVaccineCode(entry.vaccine_code)
    const list = schedByBase.get(base) ?? []
    list.push(entry)
    schedByBase.set(base, list)
  }
  for (const list of schedByBase.values()) {
    list.sort((a, b) => a.age_months - b.age_months)
  }

  const recByBase = new Map<string, Immunization[]>()
  for (const imm of recorded) {
    const base = baseVaccineCode(imm.vaccineCode)
    const list = recByBase.get(base) ?? []
    list.push(imm)
    recByBase.set(base, list)
  }
  for (const list of recByBase.values()) {
    list.sort((a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'))
  }

  const matched = new Map<string, Immunization>() // `${code}-${dose}` -> immunization
  const usedRecIds = new Set<string>()

  for (const [base, schedList] of schedByBase) {
    const recList = recByBase.get(base) ?? []

    // Pass 1: align by age — for each schedule entry (ascending age), take the
    // earliest recorded dose that was due no later than the entry's due age + 2.5mo
    // grace, preferring a matching dose number.
    for (const entry of schedList) {
      let pick: Immunization | undefined
      let firstQualifying: Immunization | undefined
      for (const imm of recList) {
        if (usedRecIds.has(imm.id)) continue
        const months = ageMonthsAt(imm.dueDate, childDob)
        if (months == null) break // sorted by due date; no more datable doses
        if (months > entry.age_months + 2.5) break // sorted ascending; nothing later qualifies
        if (!firstQualifying) firstQualifying = imm
        if (imm.doseNumber === entry.dose) {
          pick = imm
          break
        }
      }
      pick = pick ?? firstQualifying
      if (pick) {
        usedRecIds.add(pick.id)
        matched.set(`${entry.vaccine_code}-${entry.dose}`, pick)
      }
    }

    // Pass 2: exact dose-number match for recorded doses without a usable due date.
    for (const entry of schedList) {
      const key = `${entry.vaccine_code}-${entry.dose}`
      if (matched.has(key)) continue
      const pick = recList.find(
        (imm) => !usedRecIds.has(imm.id) && imm.doseNumber === entry.dose && !imm.dueDate,
      )
      if (pick) {
        usedRecIds.add(pick.id)
        matched.set(key, pick)
      }
    }
  }

  const gridRows: MergedDose[] = schedule.map((entry) => {
    const imm = matched.get(`${entry.vaccine_code}-${entry.dose}`)

    const status: MergedDose['status'] = imm
      ? imm.status === 'given'
        ? 'given'
        : imm.status === 'overdue'
          ? 'overdue'
          : 'due'
      : computeStatusFromAge(entry, childMonths)

    const date = imm
      ? (imm.administeredDate ?? imm.dueDate ?? '')
      : status === 'upcoming'
        ? ''
        : expectedDueDate(entry, childDob)

    return {
      key: `${entry.vaccine_code}-${entry.dose}`,
      vaccineCode: entry.vaccine_code,
      vaccineName: entry.vaccine_name,
      dose: entry.dose,
      age: entry.age,
      status,
      date,
      route: entry.route,
      site: entry.site,
      inSchedule: true,
    }
  })

  const extraRecorded = recorded.filter((r) => !usedRecIds.has(r.id))
  return { gridRows, extraRecorded }
}

export default function ChildVaccinationSchedulePhcAdmin() {
  const { id } = useParams<{ id: string }>()

  const { data: child, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['child', id],
    queryFn: () => childService.getChild(id ?? ''),
    enabled: !!id,
  })

  const { data: immunizations, isLoading: immLoading, isError: immError, error: immErrObj, refetch: immRefetch } = useQuery({
    queryKey: ['child-immunizations', id],
    queryFn: () => childService.listImmunizations(id ?? ''),
    enabled: !!id,
  })

  const { data: scheduleData, isLoading: schedLoading } = useQuery({
    queryKey: ['vaccination-schedule'],
    queryFn: () => vaccinationService.getSchedule(),
  })

  const { data: benData } = useQuery({
    queryKey: ['beneficiaries-map'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })

  const beneficiary = useMemo(() => {
    if (!child) return undefined
    return benData?.items?.find((b) => b.id === child.beneficiaryId)
  }, [benData, child])

  const name = beneficiary?.name ?? child?.name ?? '—'

  const { gridRows, extraRecorded } = useMemo(
    () => mergeScheduleWithRecorded(scheduleData?.schedule ?? [], immunizations ?? [], child?.dob ?? null),
    [scheduleData, immunizations, child?.dob],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, MergedDose[]>()
    for (const row of gridRows) {
      const list = map.get(row.age) ?? []
      list.push(row)
      map.set(row.age, list)
    }
    const ordered = AGE_GROUP_ORDER.filter((g) => map.has(g))
    for (const key of map.keys()) {
      if (!ordered.includes(key)) ordered.push(key)
    }
    return ordered.map((group) => ({ group, rows: map.get(group) ?? [] }))
  }, [gridRows])

  const givenCount = gridRows.filter((r) => r.status === 'given').length
  const dueCount = gridRows.filter((r) => r.status === 'due').length
  const overdueCount = gridRows.filter((r) => r.status === 'overdue').length
  const totalDoses = gridRows.length || (immunizations ?? []).length
  const shownGiven = scheduleData ? givenCount : (immunizations ?? []).filter((i) => i.status === 'given').length
  const shownDue = scheduleData ? dueCount + overdueCount : (immunizations ?? []).filter((i) => i.status === 'due' || i.status === 'overdue').length
  const onTrack = overdueCount === 0 && (scheduleData ? givenCount >= totalDoses : (immunizations ?? []).length > 0 && shownGiven >= totalDoses)

  if (isLoading) {
    return (
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading vaccination record…" />
        </div>
    )
  }

  if (isError) {
    return (
        <div className="flex items-center justify-center py-24">
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </div>
    )
  }

  const showScheduleGrid = !!scheduleData?.schedule?.length

  return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
          <div>
            <Link className="flex items-center text-primary text-label-md hover:underline mb-1" to={`/phc/children/${id}`}>
              <span className="material-symbols-outlined text-[16px] mr-1">arrow_back</span>
              Back to Child Profile
            </Link>
            {scheduleData ? (
              <p className="text-caption text-on-surface-variant mt-0.5">{scheduleData.source} · Updated {formatDate(scheduleData.updated_at)}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-sm w-full md:w-auto">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              {(name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-label-md text-on-surface">{name}</p>
            </div>
            <div className={`ml-auto md:ml-3 px-2 py-1 rounded-full text-caption flex items-center gap-1 ${overdueCount > 0 ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
              <span className="material-symbols-outlined text-[14px]">check_circle</span> {overdueCount > 0 ? 'Overdue' : onTrack ? 'On Track' : 'In Progress'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-surface-container-lowest border border-outline-variant rounded-t-xl p-4 border-b-0">
              <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_month</span>
                Immunization Schedule
              </h2>
              <Link to="/phc/vaccination/new" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md flex items-center gap-1 hover:bg-surface-tint transition-colors">
                <span className="material-symbols-outlined text-[18px]">add</span> Record Dose
              </Link>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-b-xl rounded-t-none shadow-sm flex flex-col overflow-hidden">
              {immLoading || (showScheduleGrid === false && schedLoading) ? (
                <LoadingState label="Loading immunizations…" />
              ) : immError && !showScheduleGrid ? (
                <div className="p-4"><ErrorState message={getErrorMessage(immErrObj)} onRetry={immRefetch} /></div>
              ) : !showScheduleGrid ? (
                <div className="p-8 text-center text-body-md text-on-surface-variant">No immunization schedule available.</div>
              ) : (
                <div className="flex flex-col">
                  <div className="bg-surface-container-low px-4 py-2 border-y border-outline-variant flex items-center justify-between">
                    <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider">National Immunization Schedule</h3>
                    <span className="text-caption text-on-surface-variant">{givenCount}/{totalDoses} given{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[640px]">
                      <thead>
                        <tr className="bg-surface border-b border-outline-variant">
                          <th className="p-3 px-4 text-label-md text-on-surface-variant font-medium">Vaccine</th>
                          <th className="p-3 text-label-md text-on-surface-variant font-medium">Dose</th>
                          <th className="p-3 text-label-md text-on-surface-variant font-medium">Age</th>
                          <th className="p-3 text-label-md text-on-surface-variant font-medium">Status</th>
                          <th className="p-3 text-label-md text-on-surface-variant font-medium text-right px-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/50">
                        {grouped.map(({ group, rows }) => (
                          <Fragment key={group}>
                            <tr className="bg-surface-container-low">
                              <td colSpan={5} className="p-2 px-4 text-label-md text-primary font-semibold uppercase tracking-wide">
                                {group}
                              </td>
                            </tr>
                            {rows.map((row) => {
                              const chip = statusChip(row.status)
                              return (
                                <tr key={row.key} className="hover:bg-surface-container-low transition-colors">
                                  <td className="p-3 px-4">
                                    <div className="text-body-md text-on-surface font-medium">{row.vaccineName}</div>
                                    <div className="text-caption text-on-surface-variant">{row.vaccineCode} · {row.route} · {row.site}</div>
                                  </td>
                                  <td className="p-3 text-body-md text-on-surface">Dose {row.dose}</td>
                                  <td className="p-3 text-body-md text-on-surface-variant">{row.age}</td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-caption font-semibold ${chip.className}`}>
                                      <span className="material-symbols-outlined text-[12px]">{chip.icon}</span>
                                      {chip.label}
                                    </span>
                                  </td>
                                  <td className="p-3 px-4 text-right text-body-md text-on-surface-variant">{row.date ? formatDate(row.date) : '—'}</td>
                                </tr>
                              )
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {extraRecorded.length > 0 ? (
                    <div className="border-t border-outline-variant">
                      <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant">
                        <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider">Additional Recorded Doses</h3>
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        {extraRecorded.map((imm) => {
                          const isGiven = imm.status === 'given'
                          return (
                            <div key={imm.id} className={`flex flex-col md:flex-row justify-between md:items-center bg-surface border rounded-lg p-3 relative overflow-hidden ${isGiven ? 'border-outline-variant' : 'border-primary border-2'}`}>
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${isGiven ? 'bg-secondary' : 'bg-primary'}`}></div>
                              <div className="pl-2 flex flex-col">
                                <span className="text-label-md text-on-surface">{imm.vaccineName}</span>
                                <span className="text-caption text-on-surface-variant">Dose {imm.doseNumber} · {imm.vaccineCode}</span>
                              </div>
                              <div className="mt-2 md:mt-0 flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                                <div className="flex flex-col text-left md:text-right">
                                  <span className={`text-label-md flex items-center gap-1 ${isGiven ? 'text-secondary' : 'text-primary font-bold'}`}>
                                    <span className="material-symbols-outlined text-[16px]">{isGiven ? 'done_all' : 'schedule'}</span>
                                    {isGiven ? 'Administered' : 'Due'}
                                  </span>
                                  <span className="text-caption text-on-surface-variant">{isGiven ? formatDate(imm.administeredDate ?? '') : `Due: ${formatDate(imm.dueDate)}`}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="bg-tertiary-container p-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-on-tertiary-container">event</span>
                <h3 className="text-label-md text-on-tertiary-container">Immunization Summary</h3>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant">Total doses</span>
                  <span className="text-lg font-semibold text-on-surface">{totalDoses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant">Given</span>
                  <span className="text-lg font-semibold text-secondary">{shownGiven}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-caption text-on-surface-variant">Due</span>
                  <span className="text-lg font-semibold text-primary">{shownDue}</span>
                </div>
                {scheduleData ? (
                  <div className="flex justify-between items-center">
                    <span className="text-caption text-on-surface-variant">Overdue</span>
                    <span className="text-lg font-semibold text-error">{overdueCount}</span>
                  </div>
                ) : null}
                <div className="mt-1 w-full bg-surface-container-high rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${overdueCount > 0 ? 'bg-error' : onTrack ? 'bg-secondary' : 'bg-tertiary'}`}
                    style={{ width: `${totalDoses > 0 ? Math.min(100, Math.round((shownGiven / totalDoses) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden shadow-md border border-outline-variant p-4 isolate">
              <div className="absolute inset-0 bg-gradient-to-br from-surface-variant/50 to-surface-bright/80 backdrop-blur-md -z-10"></div>
              <h3 className="text-label-md text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">monitor_weight</span> Vitals Summary
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-container-lowest/70 p-3 rounded-lg border border-outline-variant/50 text-center">
                  <span className="block text-caption text-on-surface-variant mb-1">Birth Weight</span>
                  <span className="block text-lg font-semibold text-on-surface">{child?.birthWeightKg != null ? `${child.birthWeightKg} kg` : '—'}</span>
                </div>
                <div className="bg-surface-container-lowest/70 p-3 rounded-lg border border-outline-variant/50 text-center">
                  <span className="block text-caption text-on-surface-variant mb-1">Gestation</span>
                  <span className="block text-lg font-semibold text-on-surface">{child?.gestationalAgeWeeks != null ? `${child.gestationalAgeWeeks} wks` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}
