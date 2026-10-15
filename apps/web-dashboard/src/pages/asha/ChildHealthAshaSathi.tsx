import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'
import { getErrorMessage } from '@/components/common/ErrorState'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { childService } from '@/services/child.service'
import { beneficiaryService } from '@/services/beneficiary.service'

function monthsSince(iso: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (30.44 * 86400000)))
}

export default function ChildHealthAshaSathi() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const childrenQuery = useQuery({
    queryKey: ['asha-children'],
    queryFn: () => childService.listChildren({ pageSize: 200 }),
  })

  const beneficiariesQuery = useQuery({
    queryKey: ['beneficiaries', 'all'],
    queryFn: () => beneficiaryService.listBeneficiaries({ pageSize: 1000 }),
  })
  const beneficiaryOptions = useMemo(() => beneficiariesQuery.data?.items ?? [], [beneficiariesQuery.data])

  const [form, setForm] = useState({
    beneficiaryId: '',
    motherId: '',
    fatherId: '',
    birthWeightGrams: '',
    birthLengthCm: '',
    gestationWeeks: '',
  })

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const createMutation = useMutation({
    mutationFn: () =>
      childService.createChild({
        beneficiaryId: form.beneficiaryId,
        motherId: form.motherId,
        fatherId: form.fatherId || undefined,
        birthWeightGrams: form.birthWeightGrams ? Number(form.birthWeightGrams) : undefined,
        birthLengthCm: form.birthLengthCm ? Number(form.birthLengthCm) : undefined,
        gestationWeeks: form.gestationWeeks ? Number(form.gestationWeeks) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asha-children'] })
      addToast('success', t('asha.childSaved'))
      setShowForm(false)
      setForm({ beneficiaryId: '', motherId: '', fatherId: '', birthWeightGrams: '', birthLengthCm: '', gestationWeeks: '' })
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.beneficiaryId || !form.motherId || createMutation.isPending) return
    createMutation.mutate()
  }

  const rows = useMemo(() => {
    return (childrenQuery.data?.items ?? []).map((c) => {
      const ben = beneficiaryOptions.find((b) => b.id === c.beneficiary_id)
      const motherName = c.mother_name ?? (c.mother_id ? beneficiaryOptions.find((b) => b.id === c.mother_id)?.name : null)
      return {
        id: c.id,
        name: ben?.name ?? '—',
        motherName: motherName ?? '',
        village: ben?.village ?? '',
        dob: ben?.dob ?? '',
        gender: ben?.gender ?? '',
        birthWeightKg: c.birth_weight_grams != null ? c.birth_weight_grams / 1000 : null,
      }
    })
  }, [childrenQuery.data, beneficiaryOptions])

  if (childrenQuery.isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <LoadingState label="Loading children…" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98]"
        >
          <Icon name="plus" size={18} />
          {showForm ? t('asha.closeForm') : t('asha.registerChild')}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-primary-fixed-dim bg-surface-container-lowest p-4 shadow-card"
        >
          <h2 className="mb-3 font-headline-md text-headline-md font-semibold text-on-surface">{t('asha.registerChild')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select value={form.beneficiaryId} onChange={(e) => setField('beneficiaryId', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required>
              <option value="" disabled>
                {t('asha.selectChild')}
              </option>
              {beneficiaryOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.village ? ` · ${b.village}` : ''}
                </option>
              ))}
            </select>
            <select value={form.motherId} onChange={(e) => setField('motherId', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" required>
              <option value="" disabled>
                {t('common.mother')} *
              </option>
              {beneficiaryOptions.filter((b) => b.gender === 'female').map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.village ? ` · ${b.village}` : ''}
                </option>
              ))}
            </select>
            <select value={form.fatherId} onChange={(e) => setField('fatherId', e.target.value)} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">
                {t('common.father')} ({t('common.optional')})
              </option>
              {beneficiaryOptions.filter((b) => b.gender === 'male').map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.village ? ` · ${b.village}` : ''}
                </option>
              ))}
            </select>
            <input value={form.birthWeightGrams} onChange={(e) => setField('birthWeightGrams', e.target.value)} placeholder="Birth weight (g)" className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
            <input value={form.birthLengthCm} onChange={(e) => setField('birthLengthCm', e.target.value)} placeholder={t('asha.formHeightCm')} className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" step="0.1" />
            <input value={form.gestationWeeks} onChange={(e) => setField('gestationWeeks', e.target.value)} placeholder="Gestation weeks" className="h-touch-target rounded-lg border border-outline bg-surface px-4 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" type="number" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-touch-target rounded-full border border-outline px-5 py-2.5 font-label-md text-label-md font-semibold text-on-surface-variant hover:bg-surface-container">
              {t('asha.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="h-touch-target rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary hover:bg-on-primary-fixed-variant disabled:opacity-60">
              {t('asha.saveChild')}
            </button>
          </div>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="No children registered" description="Registered children will appear here." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((child) => {
            const age = monthsSince(child.dob)
            return (
              <div
                key={child.id}
                className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card"
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container text-headline-md font-bold">
                      {child.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{child.name}</p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {age != null ? `${age} months` : '—'}
                        {child.gender ? ` · ${child.gender}` : ''}
                        {child.village ? ` · ${child.village}` : ''}
                      </p>
                      {child.motherName ? (
                        <p className="font-caption text-caption text-on-surface-variant">
                          {t('common.mother')}: {child.motherName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-outline-variant/40 bg-surface-container-low/50 px-4 py-3">
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">{t('asha.weight')}</p>
                    <p className="font-label-md text-label-md font-semibold text-on-surface">
                      {child.birthWeightKg != null ? `${child.birthWeightKg} kg` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">Child record</p>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {child.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-outline-variant/40 px-4 py-3">
                  <Link
                    to={`/asha/patients/${child.id}/immunization`}
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
      )}
    </div>
  )
}
