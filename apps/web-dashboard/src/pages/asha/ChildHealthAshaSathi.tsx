import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLocalization } from '@/hooks/useLocalization'
import { useAppStore } from '@/stores/app.store'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { PageHeader } from '@/components/layout/PageHeader'
import type { ChildHealthStatus, ChildRecord } from '@/pages/asha/mockData'

const STATUS_META: Record<ChildHealthStatus, { label: string; className: string }> = {
  healthy: { label: 'Healthy', className: 'bg-secondary-container text-on-secondary-container' },
  underweight: { label: 'Underweight', className: 'bg-tertiary-container text-on-tertiary-container' },
  malnourished: { label: 'Malnourished', className: 'bg-error-container text-on-error-container' },
}

export default function ChildHealthAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const children = useAppStore((s) => s.children)
  const addChild = useAppStore((s) => s.addChild)
  const [filter, setFilter] = useState<'all' | ChildHealthStatus>('all')
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    name: '',
    parentName: '',
    gender: '',
    dob: '',
    ageMonths: '',
    weightKg: '',
    heightCm: '',
    immunizationDone: '',
    village: '',
    status: 'healthy' as ChildHealthStatus,
  })

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const record: ChildRecord = {
      id: `c-${Date.now()}`,
      name: form.name.trim(),
      parentName: form.parentName.trim() || '—',
      gender: form.gender.trim() || '—',
      dob: form.dob.trim() || '—',
      ageMonths: Number(form.ageMonths) || 0,
      weightKg: Number(form.weightKg) || 0,
      heightCm: Number(form.heightCm) || 0,
      immunizationDone: Number(form.immunizationDone) || 0,
      immunizationTotal: 6,
      status: form.status,
      village: form.village.trim() || '—',
    }
    addChild(record)
    addToast('success', t('asha.childSaved'))
    setShowForm(false)
    setForm({ name: '', parentName: '', gender: '', dob: '', ageMonths: '', weightKg: '', heightCm: '', immunizationDone: '', village: '', status: 'healthy' })
  }

  const visible = children.filter((c) => (filter === 'all' ? true : c.status === filter))

  const tabs: { key: 'all' | ChildHealthStatus; label: string; count: number }[] = [
    { key: 'all', label: t('asha.filterAll'), count: children.length },
    { key: 'healthy', label: t('asha.childHealthy'), count: children.filter((c) => c.status === 'healthy').length },
    { key: 'underweight', label: t('asha.childUnderweight'), count: children.filter((c) => c.status === 'underweight').length },
    { key: 'malnourished', label: t('asha.childMalnourished'), count: children.filter((c) => c.status === 'malnourished').length },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={t('asha.childHealthTitle')}
        subtitle={t('asha.childHealthSubtitle')}
        breadcrumbs={[{ label: t('asha.childHealthTitle') }]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
          >
            <Icon name="plus" size={18} />
            {showForm ? t('asha.closeForm') : t('asha.registerChild')}
          </button>
        }
      />

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary-fixed-dim bg-surface-container-lowest p-4 shadow-card"
        >
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.registerChild')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={t('asha.formChildName')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required />
            <input value={form.parentName} onChange={(e) => setField('parentName', e.target.value)} placeholder={t('asha.formParentName')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.gender} onChange={(e) => setField('gender', e.target.value)} placeholder={t('asha.formGender')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.dob} onChange={(e) => setField('dob', e.target.value)} placeholder={t('asha.formDob')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <input value={form.ageMonths} onChange={(e) => setField('ageMonths', e.target.value)} placeholder={t('asha.formAgeMonths')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.weightKg} onChange={(e) => setField('weightKg', e.target.value)} placeholder={t('asha.formWeight')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" step="0.1" />
            <input value={form.heightCm} onChange={(e) => setField('heightCm', e.target.value)} placeholder={t('asha.formHeightCm')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" step="0.1" />
            <input value={form.immunizationDone} onChange={(e) => setField('immunizationDone', e.target.value)} placeholder={t('asha.formDosesGiven')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.village} onChange={(e) => setField('village', e.target.value)} placeholder={t('asha.formVillage')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <select value={form.status} onChange={(e) => setField('status', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="healthy">{t('asha.childHealthy')}</option>
              <option value="underweight">{t('asha.childUnderweight')}</option>
              <option value="malnourished">{t('asha.childMalnourished')}</option>
            </select>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-touch-target rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container">
              {t('asha.cancel')}
            </button>
            <button type="submit" className="h-touch-target rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-on-primary-fixed-variant">
              {t('asha.saveChild')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold transition-colors ${
              filter === tab.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-[11px] font-bold leading-4 ${
                filter === tab.key ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible.map((child) => {
          const meta = STATUS_META[child.status]
          const pct = Math.round((child.immunizationDone / child.immunizationTotal) * 100)
          return (
            <div
              key={child.id}
              className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-headline-md font-bold ${
                      child.status === 'healthy'
                        ? 'bg-secondary-container text-on-secondary-container'
                        : child.status === 'underweight'
                          ? 'bg-tertiary-container text-on-tertiary-container'
                          : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {child.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-on-surface">{child.name}</p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {child.ageMonths} months · {child.gender} · {child.village}
                    </p>
                    <p className="font-caption text-caption text-on-surface-variant">Guardian: {child.parentName}</p>
                  </div>
                </div>
                <span className={`flex shrink-0 items-center rounded-full px-2.5 py-1 font-caption text-caption font-semibold ${meta.className}`}>
                  {meta.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.weight')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{child.weightKg} kg</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.height')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">{child.heightCm} cm</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant">{t('asha.immunization')}</p>
                  <p className="font-label-md text-label-md font-semibold text-on-surface">
                    {child.immunizationDone}/{child.immunizationTotal}
                  </p>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-caption text-caption text-on-surface-variant">{t('asha.vaccinationProgress')}</span>
                  <span className="font-caption text-caption font-semibold text-on-surface-variant">{pct}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-variant">
                  <div
                    className={`h-full rounded-full ${child.status === 'healthy' ? 'bg-secondary' : 'bg-[#FF8C00]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-outline-variant/40 px-4 py-3">
                <Link
                  to="/asha/patients/4/immunization"
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
                >
                  {t('asha.viewSchedule')}
                  <Icon name="chevronRight" size={16} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
