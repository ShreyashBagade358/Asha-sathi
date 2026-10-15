import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import {
  householdService,
  type HouseholdMember,
  type HouseholdSurvey,
} from '@/services/household.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { pregnancyService } from '@/services/pregnancy.service'
import { relationshipLabel, relationshipOptions } from '@/lib/relationship'

const GENDER_KEY: Record<string, string> = {
  female: 'asha.female',
  male: 'asha.male',
  other: 'asha.other',
  transgender: 'asha.other',
}

const RISK_KEY: Record<string, string> = {
  high: 'asha.riskHighLabel',
  medium: 'asha.riskMediumLabel',
  low: 'asha.riskLowLabel',
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function visitDate(survey: HouseholdSurvey): string {
  return survey.visitedAt || survey.createdAt
}

function visitHasConcern(survey: HouseholdSurvey): boolean {
  return survey.memberChecks.some((check) => check.result === 'concern')
}

export default function HouseholdDetailAshaSathi() {
  const { t } = useLocalization()
  const { id } = useParams<{ id: string }>()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()

  const [showAdd, setShowAdd] = useState(false)
  const [memberMode, setMemberMode] = useState<'new' | 'search'>('new')
  const [memberName, setMemberName] = useState('')
  const [memberGender, setMemberGender] = useState('')
  const [memberAgeInput, setMemberAgeInput] = useState('')
  const [memberRelationship, setMemberRelationship] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const householdQuery = useQuery({
    queryKey: ['household', id],
    queryFn: () => householdService.getHousehold(id!),
    enabled: Boolean(id),
    retry: (failureCount, err) =>
      !(isAxiosError(err) && err.response?.status === 404) && failureCount < 2,
  })

  const membersQuery = useQuery({
    queryKey: ['household-members', id],
    queryFn: () => householdService.listHouseholdMembers(id!, { page: 1, pageSize: 100 }),
    enabled: Boolean(id),
  })

  const surveysQuery = useQuery({
    queryKey: ['household-surveys', id],
    queryFn: () => householdService.listSurveys(id!),
    enabled: Boolean(id),
  })

  const addMemberMutation = useMutation({
    mutationFn: (name: string) =>
      householdService.addMember(id!, {
        fullName: name,
        gender: (memberGender || undefined) as 'male' | 'female' | 'transgender' | 'other' | undefined,
        ageYears: memberAgeInput.trim() === '' ? undefined : Number(memberAgeInput),
        relationshipToHead: memberRelationship || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household-members', id] })
      void queryClient.invalidateQueries({ queryKey: ['household', id] })
      resetMemberForm()
      setShowAdd(false)
      addToast('success', t('asha.addMemberSaved'))
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : t('common.errorMsg')
      addToast('error', msg)
      setMemberSaving(false)
    },
  })

  function resetMemberForm() {
    setMemberName('')
    setMemberGender('')
    setMemberAgeInput('')
    setMemberRelationship('')
    setMemberSaving(false)
    setSearchTerm('')
    setMemberMode('new')
  }

  function handleAddMember(e: FormEvent) {
    e.preventDefault()
    if (memberMode !== 'new' || memberSaving) return
    if (memberName.trim().length < 2) {
      addToast('error', t('asha.errMemberNameRequired'))
      return
    }
    const age = memberAgeInput.trim()
    if (age && (!/^\d{1,2}$/.test(age) || Number(age) > 120)) {
      addToast('error', t('common.errorMsg'))
      return
    }
    setMemberSaving(true)
    addMemberMutation.mutate(memberName.trim())
  }

  const household = householdQuery.data
  const members = membersQuery.data?.items ?? []
  const pregnantMembers = members.filter((member) => member.isPregnant)

  // Search existing people by ABHA ID / name / phone — the flow the field
  // workers actually use: find the person first, then link them in.
  const memberIds = new Set(members.map((m) => m.id))
  const searchQuery = useQuery({
    queryKey: ['beneficiary-search', 'link-member', searchTerm],
    queryFn: () => beneficiaryService.listBeneficiaries({ search: searchTerm.trim(), pageSize: 8 }),
    enabled: memberMode === 'search' && searchTerm.trim().length >= 2,
  })
  const searchResults = (searchQuery.data?.items ?? []).filter((b) => !memberIds.has(b.id))

  const linkMutation = useMutation({
    mutationFn: (beneficiaryId: string) => householdService.linkMember(id!, beneficiaryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household-members', id] })
      void queryClient.invalidateQueries({ queryKey: ['household', id] })
      setSearchTerm('')
      setShowAdd(false)
      addToast('success', t('asha.addMemberSaved'))
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : t('common.errorMsg')
      addToast('error', msg)
    },
  })

  // EDD and clinical risk live on the pregnancy record, not the member row.
  const pregnancyQueries = useQueries({
    queries: pregnantMembers.map((member) => ({
      queryKey: ['pregnancy', 'member', member.id],
      queryFn: () =>
        pregnancyService.listPregnancies({ status: 'ongoing', beneficiaryId: member.id, pageSize: 3 }),
    })),
  })

  const pregnancyByMember = new Map<string, { edd?: string; risk?: string }>()
  pregnantMembers.forEach((member, index) => {
    const pregnancy = pregnancyQueries[index]?.data?.items?.[0]
    if (pregnancy) {
      pregnancyByMember.set(member.id, {
        edd: pregnancy.edd || undefined,
        risk: pregnancy.hrpLevel ?? undefined,
      })
    }
  })

  const visits = [...(surveysQuery.data ?? [])].sort((a, b) =>
    visitDate(b).localeCompare(visitDate(a)),
  )

  const memberAge = (member: HouseholdMember): string => {
    if (typeof member.ageYears === 'number') return t('asha.ageYearsShort', { count: member.ageYears })
    if (typeof member.ageMonths === 'number') return t('asha.ageMonthsShort', { count: member.ageMonths })
    return '—'
  }

  const memberSubtitle = (member: HouseholdMember): string => {
    const genderKey = member.gender ? GENDER_KEY[member.gender] : undefined
    const gender = genderKey ? t(genderKey) : member.gender || '—'
    const relation = member.relationshipToHead ? relationshipLabel(member.relationshipToHead, t) : ''
    return [relation, gender].filter(Boolean).join(' · ')
  }

  const visitSummary = (survey: HouseholdSurvey): string => {
    const fever = survey.answers.recent_fever
    if (fever === 'yes' || fever === 'no') {
      return `${t('asha.recentFever')}: ${fever === 'yes' ? t('common.yes') : t('common.no')}`
    }
    return t('asha.householdSurvey')
  }

  const notFound = isAxiosError(householdQuery.error) && householdQuery.error.response?.status === 404

  const backLink = (
    <Link
      to="/asha/households"
      className="inline-flex h-touch-target items-center gap-2 rounded-full border border-outline-variant px-5 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
    >
      <Icon name="chevronLeft" size={18} />
      {t('nav.ashaHouseholds')}
    </Link>
  )

  if (householdQuery.isLoading || membersQuery.isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader title={t('asha.householdVisit')} />
        <LoadingState label={t('common.loading')} />
      </div>
    )
  }

  if (householdQuery.isError && !notFound) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader title={t('asha.householdVisit')} />
        <ErrorState message={getErrorMessage(householdQuery.error)} onRetry={() => householdQuery.refetch()} />
      </div>
    )
  }

  if (notFound || !household) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <PageHeader title={t('asha.householdVisit')} />
        <EmptyState
          icon="home"
          title={t('asha.householdNotFound')}
          description={t('asha.noHouseholds')}
          action={backLink}
        />
      </div>
    )
  }

  const header = (
    <PageHeader
      title={household.headName || household.householdId}
      subtitle={`${household.householdId} · ${household.village || '—'}`}
    />
  )

  const memberRow = (member: HouseholdMember, index: number) => {
    const pregnancy = pregnancyByMember.get(member.id)
    const riskKey = pregnancy?.risk ? RISK_KEY[pregnancy.risk] : undefined
    return (
      <Link
        key={member.id}
        to={`/asha/patients/${member.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low ${
          index < members.length - 1 ? 'border-b border-outline-variant/40' : ''
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            member.isPregnant
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-surface-container-high text-primary'
          }`}
        >
          <Icon name={member.isPregnant ? 'heart' : 'users'} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-body-md text-body-md font-bold text-on-surface">
            {member.fullName}
          </span>
          <span className="block truncate font-caption text-caption text-on-surface-variant">
            {memberSubtitle(member)} · {memberAge(member)}
          </span>
          {pregnancy?.edd ? (
            <span className="block truncate font-caption text-caption text-on-surface-variant">
              {t('asha.edd')}: {formatDate(pregnancy.edd)}
            </span>
          ) : null}
        </span>
        {riskKey ? (
          <span className="shrink-0 rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption font-semibold text-on-surface">
            {t(riskKey)}
          </span>
        ) : member.isPregnant ? (
          <span className="shrink-0 rounded-full bg-tertiary-container px-3 py-1 font-caption text-caption font-semibold text-on-tertiary-container">
            {t('asha.highRisk')}
          </span>
        ) : null}
        <Icon name="chevronRight" size={18} className="shrink-0 text-outline" />
      </Link>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      {header}

      <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
        <span className="absolute bottom-0 left-0 top-0 w-2 bg-primary" />
        <div className="pl-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-caption text-caption text-on-surface-variant">{t('asha.householdIdLabel')}</p>
              <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
                {household.householdId}
              </h2>
            </div>
            <span className="rounded-full bg-secondary-container px-3 py-1 font-caption text-caption font-semibold text-on-secondary-container">
              {t('asha.active')}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 font-body-md text-body-md text-on-surface">
            <Icon name="users" size={18} className="text-outline" />
            <span>
              <strong>{t('asha.head')}:</strong> {household.headName || '—'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 font-body-md text-body-md text-on-surface">
            <Icon name="mapPin" size={18} className="text-outline" />
            <span>{household.address || household.village || '—'}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
              {t('asha.familySize', { count: household.memberCount })}
            </span>
            {household.childrenUnder5 > 0 ? (
              <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
                {t('asha.childrenUnder5', { count: household.childrenUnder5 })}
              </span>
            ) : null}
            {household.pregnantWomen > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-3 py-1 font-caption text-caption font-bold text-on-tertiary-container">
                <Icon name="heart" size={14} />
                {t('asha.pregnantCount', { count: household.pregnantWomen })}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
            {t('asha.familyMembers')}
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
              {members.length} {t('asha.members')}
            </span>
            <button
              type="button"
              aria-label={t('asha.addMember')}
              onClick={() => setShowAdd(true)}
              className="rounded-full p-1 text-primary transition-colors hover:bg-primary-container/20"
            >
              <Icon name="plus" size={20} />
            </button>
          </div>
        </div>
        {membersQuery.isError ? (
          <ErrorState message={getErrorMessage(membersQuery.error)} onRetry={() => membersQuery.refetch()} />
        ) : members.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
            {t('asha.noMembersRecorded')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
            {members.map((member, index) => memberRow(member, index))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
            {t('asha.householdSurvey')}
          </h3>
          <span className="rounded-full bg-surface-container-high px-3 py-1 font-caption text-caption text-on-surface">
            {t('asha.pastVisits', { count: visits.length })}
          </span>
        </div>
        {surveysQuery.isError ? (
          <ErrorState message={getErrorMessage(surveysQuery.error)} onRetry={() => surveysQuery.refetch()} />
        ) : visits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
            {t('asha.noPastVisits')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card">
            {visits.map((visit, index) => {
              const concern = visitHasConcern(visit)
              return (
                <div
                  key={visit.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    index < visits.length - 1 ? 'border-b border-outline-variant/40' : ''
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                    <Icon name="checkCircle" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body-md text-body-md font-bold text-on-surface">
                      {formatDate(visitDate(visit))}
                    </span>
                    <span className="block truncate font-caption text-caption text-on-surface-variant">
                      {visitSummary(visit)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 font-caption text-caption font-semibold ${
                      concern
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-secondary-container text-on-secondary-container'
                    }`}
                  >
                    {concern ? t('asha.visitResultConcern') : t('asha.visitResultOk')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 pb-4 sm:flex-row">
        <Link
          to={`/asha/households/${household.id}/visit`}
          className="flex h-touch-target flex-1 items-center justify-center gap-2 rounded-full bg-primary font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
        >
          <Icon name="activity" size={18} />
          {t('asha.startVisit')}
        </Link>
        <Link
          to="/asha/households"
          className="flex h-touch-target items-center justify-center gap-2 rounded-full border border-outline-variant px-5 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          {t('nav.ashaHouseholds')}
        </Link>
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
        >
          <form
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-5 shadow-card"
            onSubmit={handleAddMember}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="add-member-title"
                className="font-headline-md text-headline-md font-semibold text-on-surface"
              >
                {t('asha.addMemberTitle')}
              </h2>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => {
                  setShowAdd(false)
                  resetMemberForm()
                }}
                className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="mb-4 flex gap-2 rounded-full bg-surface-container-high p-1">
              {(['search', 'new'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMemberMode(mode)}
                  className={`h-9 flex-1 rounded-full font-label-md text-label-md font-semibold transition-colors ${
                    memberMode === mode
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {mode === 'search' ? t('asha.linkExisting') : t('asha.addMemberNew')}
                </button>
              ))}
            </div>

            {memberMode === 'search' ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-md text-label-md text-on-surface-variant"
                    htmlFor="member_search"
                  >
                    {t('asha.searchExistingHint')}
                  </label>
                  <input
                    id="member_search"
                    className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('asha.searchExistingPlaceholder')}
                    autoFocus
                  />
                </div>
                {searchTerm.trim().length >= 2 ? (
                  searchQuery.isLoading ? (
                    <p className="p-2 font-caption text-caption text-on-surface-variant">
                      {t('common.loading')}
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className="rounded-lg border border-outline-variant/50 bg-surface-container p-3 font-caption text-caption text-on-surface-variant">
                      {t('asha.noPatientFound')}
                    </p>
                  ) : (
                    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                      {searchResults.map((person) => (
                        <div
                          key={person.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-body-md text-body-md font-semibold text-on-surface">
                              {person.name}
                            </p>
                            <p className="truncate font-caption text-caption text-on-surface-variant">
                              {[person.abhaId, person.phone].filter(Boolean).join(' · ') ||
                                t('common.notRecorded')}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={linkMutation.isPending}
                            onClick={() => linkMutation.mutate(person.id)}
                            className="flex h-touch-target shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                          >
                            <Icon name="plus" size={16} />
                            {t('common.add')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="member_name"
                >
                  {t('asha.fullName')} *
                </label>
                <input
                  id="member_name"
                  className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-md text-label-md text-on-surface-variant"
                    htmlFor="member_gender"
                  >
                    {t('asha.gender')}
                  </label>
                  <select
                    id="member_gender"
                    className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={memberGender}
                    onChange={(e) => setMemberGender(e.target.value)}
                  >
                    <option value="">{t('common.notRecorded')}</option>
                    <option value="male">{t('asha.male')}</option>
                    <option value="female">{t('asha.female')}</option>
                    <option value="other">{t('asha.other')}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-md text-label-md text-on-surface-variant"
                    htmlFor="member_age"
                  >
                    {t('asha.memberAgeYears')}
                  </label>
                  <input
                    id="member_age"
                    className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    inputMode="numeric"
                    maxLength={3}
                    type="text"
                    value={memberAgeInput}
                    onChange={(e) => setMemberAgeInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="member_relationship"
                >
                  {t('asha.relationshipToHead')}
                </label>
                <select
                  id="member_relationship"
                  className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={memberRelationship}
                  onChange={(e) => setMemberRelationship(e.target.value)}
                >
                  <option value="">{t('asha.relationshipPlaceholder')}</option>
                  {relationshipOptions(t).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="flex h-touch-target items-center justify-center rounded-full px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                  onClick={() => {
                    setShowAdd(false)
                    resetMemberForm()
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={memberSaving}
                  className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  <Icon name="plus" size={18} />
                  {memberSaving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
