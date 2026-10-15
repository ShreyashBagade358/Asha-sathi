import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import { ncdService, type NCDScreening } from '@/services/ncd.service'
import { ageFromBeneficiary, formatRecordDate } from '@/pages/asha/patientView'
import type { Beneficiary } from '@/types'
import type { CheckUpRecord, RiskLevel } from '@/pages/asha/mockData'

const RISK_TONE: Record<RiskLevel, string> = {
  high: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-container text-on-tertiary-container',
  low: 'bg-secondary-container text-on-secondary-container',
}

const RISK_KEY: Record<RiskLevel, string> = {
  high: 'asha.riskHighLabel',
  medium: 'asha.riskMediumLabel',
  low: 'asha.riskLowLabel',
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Overall level shown on the card — mirrors the PHC history table. */
function deriveRisk(s: NCDScreening): RiskLevel {
  const levels = [s.diabetesRisk, s.hypertensionRisk, s.cardiovascularRisk, s.cancerRisk]
  if (levels.includes('high')) return 'high'
  if (levels.includes('medium') || levels.includes('moderate')) return 'medium'
  if ((s.bpSystolic ?? 0) >= 160 || (s.bpDiastolic ?? 0) >= 100) return 'high'
  if ((s.bpSystolic ?? 0) >= 130 || (s.bpDiastolic ?? 0) >= 85) return 'medium'
  return 'low'
}

function screeningToCheckup(s: NCDScreening, ben?: Beneficiary): CheckUpRecord {
  return {
    id: s.id,
    patientName: ben?.name ?? '—',
    age: ben ? ageFromBeneficiary(ben) : 0,
    gender: ben?.gender ? ben.gender.charAt(0).toUpperCase() + ben.gender.slice(1) : '—',
    village: ben?.village || '—',
    date: formatRecordDate(s.screeningDate),
    bpSystolic: s.bpSystolic ?? 0,
    bpDiastolic: s.bpDiastolic ?? 0,
    // NCD screenings don't carry weight/temperature — never invent a reading.
    weightKg: 0,
    haemoglobin: undefined,
    temperature: 0,
    pulseRate: 0,
    risk: deriveRisk(s),
    notes: undefined,
  }
}

export default function HealthCheckUpAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all')
  const [showForm, setShowForm] = useState(false)

  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const pregnanciesQuery = useQuery({
    queryKey: ['pregnancies', 'ongoing'],
    queryFn: () => pregnancyService.listPregnancies({ status: 'ongoing', pageSize: 1000 }),
  })
  const beneficiaryOptions = beneficiariesQuery.data?.items ?? []
  const ongoingPregnancies = pregnanciesQuery.data?.items ?? []

  const screeningsQuery = useQuery({
    queryKey: ['ncd-screenings', 'asha-checkups'],
    queryFn: () => ncdService.listScreenings({ pageSize: 200 }),
  })

  const checkups = useMemo(() => {
    const byId = new Map((beneficiariesQuery.data?.items ?? []).map((b) => [b.id, b]))
    return (screeningsQuery.data?.items ?? []).map((s) =>
      screeningToCheckup(s, byId.get(s.beneficiaryId)),
    )
  }, [screeningsQuery.data, beneficiariesQuery.data])

  const [form, setForm] = useState({
    beneficiaryId: '',
    patientName: '',
    age: '',
    gender: '',
    village: '',
    bpSystolic: '',
    bpDiastolic: '',
    weightKg: '',
    haemoglobin: '',
    temperature: '',
    pulseRate: '',
    notes: '',
    risk: 'low' as RiskLevel,
  })

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const num = (v: string): number | undefined => {
    const n = Number(v)
    return v !== '' && Number.isFinite(n) ? n : undefined
  }

  const submitMutation = useMutation({
    mutationFn: async (snapshot: typeof form) => {
      const pregnancy = ongoingPregnancies.find((p) => p.beneficiaryId === snapshot.beneficiaryId)
      if (pregnancy) {
        const visits = await pregnancyService.listANCVisits(pregnancy.id)
        await pregnancyService.addANCVisit(pregnancy.id, {
          visitNumber: visits.length + 1,
          visitDate: todayISO(),
          bpSystolic: num(snapshot.bpSystolic),
          bpDiastolic: num(snapshot.bpDiastolic),
          weightKg: num(snapshot.weightKg),
          hemoglobin: num(snapshot.haemoglobin),
        })
        return
      }
      await ncdService.createScreening({
        beneficiaryId: snapshot.beneficiaryId,
        screeningDate: todayISO(),
        ageAbove30: snapshot.age !== '' ? Number(snapshot.age) >= 30 : undefined,
        bpSystolic: num(snapshot.bpSystolic),
        bpDiastolic: num(snapshot.bpDiastolic),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ncd-screenings'] })
      addToast('success', t('asha.checkupSaved'))
      setShowForm(false)
      setForm({ beneficiaryId: '', patientName: '', age: '', gender: '', village: '', bpSystolic: '', bpDiastolic: '', weightKg: '', haemoglobin: '', temperature: '', pulseRate: '', notes: '', risk: 'low' })
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.beneficiaryId || submitMutation.isPending) return
    submitMutation.mutate({ ...form })
  }

  const visible = checkups.filter((c) => (riskFilter === 'all' ? true : c.risk === riskFilter))

  const tabs: { key: 'all' | RiskLevel; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: checkups.length },
    { key: 'high', label: t('asha.riskHighLabel'), count: checkups.filter((c) => c.risk === 'high').length },
    { key: 'medium', label: t('asha.riskMediumLabel'), count: checkups.filter((c) => c.risk === 'medium').length },
    { key: 'low', label: t('asha.riskLowLabel'), count: checkups.filter((c) => c.risk === 'low').length },
  ]

  const isAbnormal = (c: { bpSystolic: number; bpDiastolic: number; haemoglobin?: number }) =>
    c.bpSystolic >= 130 || c.bpDiastolic >= 85 || (c.haemoglobin !== undefined && c.haemoglobin < 10)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
        >
          <Icon name="plus" size={18} />
          {showForm ? t('asha.closeForm') : t('asha.newCheckup')}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary-fixed-dim bg-surface-container-lowest p-4 shadow-card"
        >
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.newCheckup')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select value={form.beneficiaryId} onChange={(e) => setField('beneficiaryId', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required>
              <option value="" disabled>
                {t('asha.selectPatient')}
              </option>
              {beneficiaryOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.village ? ` · ${b.village}` : ''}
                </option>
              ))}
            </select>
            <input value={form.patientName} onChange={(e) => setField('patientName', e.target.value)} placeholder={t('asha.formPatientName')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.age} onChange={(e) => setField('age', e.target.value)} placeholder={t('asha.formAge')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.gender} onChange={(e) => setField('gender', e.target.value)} placeholder={t('asha.formGender')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.village} onChange={(e) => setField('village', e.target.value)} placeholder={t('asha.formVillage')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.bpSystolic} onChange={(e) => setField('bpSystolic', e.target.value)} placeholder={t('asha.formBpSystolic')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.bpDiastolic} onChange={(e) => setField('bpDiastolic', e.target.value)} placeholder={t('asha.formBpDiastolic')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.weightKg} onChange={(e) => setField('weightKg', e.target.value)} placeholder={t('asha.formWeight')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" step="0.1" />
            <input value={form.haemoglobin} onChange={(e) => setField('haemoglobin', e.target.value)} placeholder={t('asha.formHaemoglobin')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" step="0.1" />
            <input value={form.temperature} onChange={(e) => setField('temperature', e.target.value)} placeholder={t('asha.formTemperature')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" step="0.1" />
            <input value={form.pulseRate} onChange={(e) => setField('pulseRate', e.target.value)} placeholder={t('asha.formPulse')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <select value={form.risk} onChange={(e) => setField('risk', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="low">{t('asha.riskLowLabel')}</option>
              <option value="medium">{t('asha.riskMediumLabel')}</option>
              <option value="high">{t('asha.riskHighLabel')}</option>
            </select>
            <input value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder={t('asha.formNotes')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-touch-target rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container">
              {t('asha.cancel')}
            </button>
            <button type="submit" disabled={submitMutation.isPending} className="h-touch-target rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-on-primary-fixed-variant disabled:opacity-60">
              {t('asha.saveCheckup')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setRiskFilter(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
              riskFilter === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
                riskFilter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {screeningsQuery.isLoading ? (
          <div className="lg:col-span-2">
            <LoadingState label={t('common.loading')} />
          </div>
        ) : screeningsQuery.isError ? (
          <div className="lg:col-span-2">
            <ErrorState
              message={getErrorMessage(screeningsQuery.error)}
              onRetry={() => screeningsQuery.refetch()}
            />
          </div>
        ) : checkups.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon="health_and_safety"
              title={t('asha.noCheckups')}
              description={t('asha.noCheckupsHint')}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-12 text-center font-body-md text-body-md text-on-surface-variant shadow-card">
              {t('common.noResults')}
            </div>
          </div>
        ) : (
          visible.map((checkup) => (
            <div
              key={checkup.id}
              className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                    <Icon name="activity" size={22} />
                  </span>
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{checkup.patientName}</p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {checkup.age ? `${checkup.age} yrs` : '—'} · {checkup.gender} · {checkup.village}
                    </p>
                  </div>
                </div>
                <span className={`flex shrink-0 items-center rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${RISK_TONE[checkup.risk]}`}>
                  {t(RISK_KEY[checkup.risk])}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">BP</p>
                  <p className={`font-label-md text-label-md font-semibold ${checkup.bpSystolic >= 130 ? 'text-error' : 'text-on-surface'}`}>
                    {checkup.bpSystolic ? `${checkup.bpSystolic}/${checkup.bpDiastolic}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.weight')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">
                    {checkup.weightKg ? `${checkup.weightKg} kg` : '—'}
                  </p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.haemoglobin')}</p>
                  <p className={`font-label-md text-label-md font-semibold ${checkup.haemoglobin !== undefined && checkup.haemoglobin < 10 ? 'text-error' : 'text-on-surface'}`}>
                    {checkup.haemoglobin !== undefined ? `${checkup.haemoglobin} g/dL` : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-caption text-caption text-on-surface-variant">
                  <Icon name="calendar" size={14} className="mr-1 inline" />
                  {checkup.date} · Temp {checkup.temperature ? `${checkup.temperature}°F` : '—'}
                </span>
                <div className="flex items-center gap-2">
                  {isAbnormal(checkup) ? (
                    <span className="rounded-full bg-error-container px-2.5 py-1 font-caption text-caption font-semibold text-on-error-container">
                      {t('asha.followUpNeeded')}
                    </span>
                  ) : null}
                  <Link
                    to="/asha/checkup-completed"
                    className="flex items-center gap-1 rounded-full border border-outline px-4 py-2 font-label-md text-label-md font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
                  >
                    {t('asha.viewCheckup')}
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </div>
            </div>
          )))}
      </div>
    </div>
  )
}
