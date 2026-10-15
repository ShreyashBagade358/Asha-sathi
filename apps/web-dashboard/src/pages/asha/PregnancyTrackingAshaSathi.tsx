import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { getErrorMessage, ErrorState } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { pregnancyService } from '@/services/pregnancy.service'
import { beneficiaryService } from '@/services/beneficiary.service'
import type { Beneficiary, Pregnancy } from '@/types'
import type { PregnancyRecord, PregnancyStatus, RiskLevel } from '@/pages/asha/mockData'

const STATUS_META: Record<PregnancyStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-secondary-container text-on-secondary-container' },
  delivered: { label: 'Delivered', className: 'bg-tertiary-container text-on-tertiary-container' },
  aborted: { label: 'Aborted', className: 'bg-surface-variant text-on-surface-variant' },
  ltf: { label: 'Lost to Follow-up', className: 'bg-surface-variant text-on-surface-variant' },
}

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

function TrimesterDot({ trimester }: { trimester: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 w-6 rounded-full ${n <= trimester ? 'bg-primary' : 'bg-surface-variant'}`}
        />
      ))}
    </div>
  )
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function weeksSinceLmp(lmp?: string): number {
  if (!lmp) return 0
  const start = new Date(lmp)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)))
}

function toPregnancyRecord(p: Pregnancy, ben?: Beneficiary): PregnancyRecord {
  const week = weeksSinceLmp(p.lmp)
  return {
    id: p.id,
    beneficiaryId: p.beneficiaryId,
    patientName: ben?.name ?? '—',
    abhaId: ben?.abhaId ?? '—',
    village: ben?.village ?? '—',
    ward: '—',
    lmp: formatDate(p.lmp),
    edd: formatDate(p.edd),
    trimester: week > 0 ? Math.min(3, Math.floor(week / 13) + 1) : 1,
    week,
    risk: p.hrpLevel ?? (p.highRisk ? 'high' : 'low'),
    riskReason: p.complications.length ? p.complications.join(', ') : undefined,
    ancVisits: 0,
    status: p.status === 'ongoing' ? 'active' : p.status,
  }
}

export default function PregnancyTrackingAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'active' | 'delivered' | 'all'>('active')
  const [showForm, setShowForm] = useState(false)

  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  });
  // Pregnancy registration is for women only — filter the picker to female
  // beneficiaries so a male can never be selected as the pregnant patient.
  const beneficiaryOptions = (beneficiariesQuery.data?.items ?? []).filter(
    (b) => b.gender === 'female',
  );

  const pregnanciesQuery = useQuery({
    queryKey: ['pregnancies', 'all'],
    queryFn: () => pregnancyService.listPregnancies({ status: 'all', pageSize: 1000 }),
  })

  const beneficiariesById = new Map(beneficiaryOptions.map((b) => [b.id, b]))
  const pregnancies: PregnancyRecord[] = (pregnanciesQuery.data?.items ?? []).map((p) =>
    toPregnancyRecord(p, beneficiariesById.get(p.beneficiaryId)),
  )

  const [form, setForm] = useState({
    beneficiaryId: '',
    patientName: '',
    abhaId: '',
    village: '',
    ward: '',
    lmp: '',
    edd: '',
    trimester: '1',
    week: '',
    risk: 'low' as RiskLevel,
  })

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const createMutation = useMutation({
    mutationFn: () =>
      pregnancyService.createPregnancy({
        beneficiaryId: form.beneficiaryId,
        lmp: form.lmp || undefined,
        edd: form.edd || undefined,
        riskLevel: form.risk,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pregnancies'] })
      addToast('success', t('asha.pregnancySaved'))
      setShowForm(false)
      setForm({ beneficiaryId: '', patientName: '', abhaId: '', village: '', ward: '', lmp: '', edd: '', trimester: '1', week: '', risk: 'low' })
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.beneficiaryId || createMutation.isPending) return
    createMutation.mutate()
  }

  const active = pregnancies.filter((p) => p.status === 'active')
  const visible = pregnancies.filter((p) =>
    filter === 'all' ? true : filter === 'active' ? p.status === 'active' : p.status === 'delivered',
  )

  const tabs: { key: 'active' | 'delivered' | 'all'; label: string; count: number }[] = [
    { key: 'active', label: t('asha.pregActive'), count: active.length },
    { key: 'delivered', label: t('asha.pregDelivered'), count: pregnancies.filter((p) => p.status === 'delivered').length },
    { key: 'all', label: t('asha.filterAll'), count: pregnancies.length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
        >
          <Icon name="plus" size={18} />
          {showForm ? t('asha.closeForm') : t('asha.registerPregnancy')}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary-fixed-dim bg-surface-container-lowest p-4 shadow-card"
        >
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.registerPregnancy')}</h2>
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
            <input value={form.abhaId} onChange={(e) => setField('abhaId', e.target.value)} placeholder={t('asha.formAbhaId')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.village} onChange={(e) => setField('village', e.target.value)} placeholder={t('asha.formVillage')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.ward} onChange={(e) => setField('ward', e.target.value)} placeholder={t('asha.formWard')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.lmp} onChange={(e) => setField('lmp', e.target.value)} placeholder={t('asha.formLmp')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="date" />
            <input value={form.edd} onChange={(e) => setField('edd', e.target.value)} placeholder={t('asha.formEdd')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="date" />
            <select value={form.trimester} onChange={(e) => setField('trimester', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="1">{t('asha.formTrimester1')}</option>
              <option value="2">{t('asha.formTrimester2')}</option>
              <option value="3">{t('asha.formTrimester3')}</option>
            </select>
            <input value={form.week} onChange={(e) => setField('week', e.target.value)} placeholder={t('asha.formWeek')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <select value={form.risk} onChange={(e) => setField('risk', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="low">{t('asha.riskLowLabel')}</option>
              <option value="medium">{t('asha.riskMediumLabel')}</option>
              <option value="high">{t('asha.riskHighLabel')}</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-touch-target rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container">
              {t('asha.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="h-touch-target rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-on-primary-fixed-variant disabled:opacity-60">
              {t('asha.savePregnancy')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <p className="font-caption text-caption font-medium text-on-surface-variant">{t('asha.pregActive')}</p>
          <p className="mt-1 font-display-lg text-display-lg font-bold text-primary">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <p className="font-caption text-caption font-medium text-on-surface-variant">{t('asha.pregHighRisk')}</p>
          <p className="mt-1 font-display-lg text-display-lg font-bold text-error">
            {pregnancies.filter((p) => p.risk === 'high').length}
          </p>
        </div>
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-card">
          <p className="font-caption text-caption font-medium text-on-surface-variant">{t('asha.pregDelivered')}</p>
          <p className="mt-1 font-display-lg text-display-lg font-bold text-tertiary">
            {pregnancies.filter((p) => p.status === 'delivered').length}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-label-sm font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {pregnanciesQuery.isLoading ? (
          <LoadingState />
        ) : pregnanciesQuery.isError ? (
          <ErrorState
            message={getErrorMessage(pregnanciesQuery.error)}
            onRetry={() => pregnanciesQuery.refetch()}
          />
        ) : (
          visible.map((p) => <PregnancyCard key={p.id} pregnancy={p} />)
        )}
      </div>
    </div>
  )
}

function PregnancyCard({ pregnancy }: { pregnancy: PregnancyRecord }) {
  const { t } = useLocalization()
  const visitsQuery = useQuery({
    queryKey: ['pregnancies', 'anc', pregnancy.id],
    queryFn: () => pregnancyService.listANCVisits(pregnancy.id),
  })
  const ancVisits = visitsQuery.data?.length ?? pregnancy.ancVisits

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
      <div className="relative p-4 pl-5">
        <span
          className={`absolute bottom-0 left-0 top-0 w-1.5 ${
            pregnancy.risk === 'high' ? 'bg-error' : pregnancy.risk === 'medium' ? 'bg-[#F59E0B]' : 'bg-secondary'
          }`}
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${RISK_TONE[pregnancy.risk]}`}>
                {t(RISK_KEY[pregnancy.risk])}
              </span>
              <span className={`rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${STATUS_META[pregnancy.status].className}`}>
                {STATUS_META[pregnancy.status].label}
              </span>
            </div>
            <p className="mt-2 font-headline-md text-headline-md font-semibold text-on-surface">{pregnancy.patientName}</p>
            <p className="flex items-center gap-1 font-body-md text-body-md text-on-surface-variant">
              <Icon name="mapPin" size={15} />
              {pregnancy.village} · {pregnancy.ward}
            </p>
            <p className="font-caption text-caption text-on-surface-variant">{pregnancy.abhaId}</p>
          </div>
          <Link
            to={`/asha/patients/${pregnancy.beneficiaryId ?? pregnancy.id}`}
            aria-label={t('asha.viewPatientProfile')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-all hover:bg-primary hover:text-on-primary active:scale-95"
          >
            <Icon name="chevronRight" size={22} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="font-caption text-caption text-on-surface-variant">{t('asha.trimester')} · Week {pregnancy.week}</p>
            <div className="mt-1">
              <TrimesterDot trimester={pregnancy.trimester} />
            </div>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant">{t('asha.edd')}</p>
            <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.edd}</p>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant">LMP</p>
            <p className="font-label-md text-label-md font-semibold text-on-surface">{pregnancy.lmp}</p>
          </div>
          <div>
            <p className="font-caption text-caption text-on-surface-variant">{t('asha.ancVisits')}</p>
            <p className="font-label-md text-label-md font-semibold text-on-surface">{ancVisits} / 4</p>
          </div>
        </div>
      </div>
    </div>
  )
}
