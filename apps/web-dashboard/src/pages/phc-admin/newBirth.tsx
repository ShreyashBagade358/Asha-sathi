import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { beneficiaryService } from '@/services/beneficiary.service'
import { childService } from '@/services/child.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
const labelCls = 'block text-label-md text-on-surface-variant mb-1.5'

export default function NewBirthPhcAdmin() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [benId, setBenId] = useState('')
  const [form, setForm] = useState({
    birthWeightGrams: '',
    birthLengthCm: '',
    headCircumferenceCm: '',
    gestationWeeks: '',
    deliveryType: 'normal',
    placeOfBirth: '',
  })

  const bens = useQuery({
    queryKey: ['beneficiaries', 'search', search],
    queryFn: () => beneficiaryService.listBeneficiaries({ search, pageSize: 20 }),
    placeholderData: (prev) => prev,
  })

  const selected = bens.data?.items.find((b) => b.id === benId)

  const submit = useMutation({
    mutationFn: () =>
      childService.createChild({
        beneficiaryId: benId,
        birthWeightGrams: form.birthWeightGrams ? Number(form.birthWeightGrams) : undefined,
        birthLengthCm: form.birthLengthCm ? Number(form.birthLengthCm) : undefined,
        headCircumferenceCm: form.headCircumferenceCm ? Number(form.headCircumferenceCm) : undefined,
        gestationWeeks: form.gestationWeeks ? Number(form.gestationWeeks) : undefined,
        deliveryType: form.deliveryType as 'normal' | 'c-section' | 'assisted',
        placeOfBirth: form.placeOfBirth || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['children'] })
      setBenId('')
      setSearch('')
      setForm({ birthWeightGrams: '', birthLengthCm: '', headCircumferenceCm: '', gestationWeeks: '', deliveryType: 'normal', placeOfBirth: '' })
    },
  })

  if (bens.isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <LoadingState label="Loading beneficiaries…" />
        </main>
      </div>
    )
  }

  if (bens.isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <ErrorState message={getErrorMessage(bens.error)} onRetry={() => bens.refetch()} />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">newborn</span>
              New Birth Registration
            </h2>
            <p className="text-caption text-on-surface-variant">Register a new child linked to a mother's record.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-headline-md text-on-surface">1 · Mother / Beneficiary</h3>
              <p className="text-caption text-on-surface-variant">Search and select the mother to link this birth to.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Search beneficiary</label>
                <input
                  className={`${inputCls} pl-4`}
                  placeholder="Name, ID, or village…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {selected && (
                  <div className="rounded-lg border-2 border-primary bg-primary-container/40 p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold text-on-surface truncate">{selected.name}</p>
                      <p className="text-caption text-on-surface-variant">{selected.village} · {selected.gender} · {selected.dob?.slice(0, 10) ?? '—'}</p>
                    </div>
                    <button onClick={() => setBenId('')} className="text-error text-label-sm font-semibold shrink-0">Change</button>
                  </div>
                )}
                {!selected &&
                  (bens.data?.total ?? 0) === 0 && (
                    <EmptyState title="No beneficiaries found" description="Try a different search term." icon="person_search" />
                  )}
                {!selected &&
                  bens.data?.items.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBenId(b.id)}
                      className="w-full text-left rounded-lg border border-outline-variant bg-surface p-3 hover:border-primary hover:bg-surface-container-high transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-body-md font-semibold text-on-surface truncate">{b.name}</p>
                        <p className="text-caption text-on-surface-variant">{b.village} · {b.gender}{b.hasChild ? ' · has child' : ''}</p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant shrink-0">add</span>
                    </button>
                  ))}
              </div>

              {selected && (
                <>
                  <div className="border-t border-outline-variant pt-4">
                    <h3 className="text-headline-md text-on-surface mb-4">2 · Birth Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Birth Weight (g)</label>
                        <input className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 2850" value={form.birthWeightGrams} onChange={(e) => setForm({ ...form, birthWeightGrams: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>Birth Length (cm)</label>
                        <input className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 49" value={form.birthLengthCm} onChange={(e) => setForm({ ...form, birthLengthCm: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>Head Circumference (cm)</label>
                        <input className={inputCls} type="number" inputMode="decimal" min={0} step="0.1" placeholder="e.g. 33" value={form.headCircumferenceCm} onChange={(e) => setForm({ ...form, headCircumferenceCm: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>Gestation (weeks)</label>
                        <input className={inputCls} type="number" inputMode="numeric" min={0} max={45} placeholder="e.g. 38" value={form.gestationWeeks} onChange={(e) => setForm({ ...form, gestationWeeks: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>Delivery Type</label>
                        <div className="relative">
                          <select
                            className={`${inputCls} appearance-none`}
                            value={form.deliveryType}
                            onChange={(e) => setForm({ ...form, deliveryType: e.target.value })}
                          >
                            <option value="normal">Normal Vaginal</option>
                            <option value="c-section">C-Section</option>
                            <option value="assisted">Assisted</option>
                          </select>
                          <span className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant pointer-events-none">
                            <span className="material-symbols-outlined text-[20px]">expand_more</span>
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Place of Birth</label>
                        <input className={inputCls} placeholder="Home / PHC / District Hospital" value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} />
                      </div>
                    </div>
                    <button
                      onClick={() => submit.mutate()}
                      disabled={submit.isPending}
                      className="w-full mt-5 h-12 rounded-lg bg-primary text-on-primary font-label-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors hover:bg-primary/90"
                    >
                      {submit.isPending ? (
                        <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                          Register Birth
                        </>
                      )}
                    </button>
                    {submit.isSuccess && (
                      <p className="text-caption text-success flex items-center gap-1 font-semibold mt-3">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Birth registered and child record created.
                      </p>
                    )}
                    {submit.isError && (
                      <p className="text-caption text-error flex items-center gap-1 font-semibold mt-3">
                        <span className="material-symbols-outlined text-[16px]">error</span>
                        {getErrorMessage(submit.error)}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}