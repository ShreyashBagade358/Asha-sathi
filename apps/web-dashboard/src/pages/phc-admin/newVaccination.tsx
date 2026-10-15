import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vaccinationService } from '@/services/vaccination.service'
import { childService } from '@/services/child.service'
import { useUIStore } from '@/stores/ui.store'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
const labelCls = 'block text-label-md text-on-surface-variant mb-1.5'

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NewVaccinationPhcAdmin() {
  const qc = useQueryClient()
  const { addToast } = useUIStore()
  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')

  const due = useQuery({
    queryKey: ['vaccination', 'due'],
    queryFn: () => vaccinationService.getDueVaccinations(),
  })

  const selected = due.data?.find((d) => d.id === selectedId)

  const record = useMutation({
    mutationFn: () =>
      childService.createImmunization(selected!.childId, {
        vaccineCode: selected!.vaccineCode,
        doseNumber: selected!.doseNumber,
        status: 'given',
        givenDate: new Date().toISOString(),
        batchNumber: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vaccination'] })
      qc.invalidateQueries({ queryKey: ['children'] })
      setNote('')
      setSelectedId('')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  if (due.isLoading) {
    return (
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading due vaccinations…" />
        </div>
    )
  }

  if (due.isError) {
    return (
        <div className="flex items-center justify-center py-24">
          <ErrorState message={getErrorMessage(due.error)} onRetry={() => due.refetch()} />
        </div>
    )
  }

  return (
      <div className="flex flex-col gap-6">
        <div>
        </div>

        <div className="max-w-2xl bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="text-headline-md text-on-surface">Due Dose</h3>
          </div>
          <div className="p-6 space-y-4">
            {(due.data ?? []).length === 0 ? (
              <EmptyState title="No vaccinations due" description="All scheduled doses are up to date." icon="verified" />
            ) : (
              <>
                <div>
                  <label className={labelCls}>Child / Beneficiary</label>
                  <div className="relative">
                    <select
                      className={`${inputCls} appearance-none`}
                      value={selectedId}
                      onChange={(e) => setSelectedId(e.target.value)}
                    >
                      <option value="">Select a child…</option>
                      {due.data!.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.childName ?? d.beneficiaryName ?? 'Child'} — {d.vaccineName} {d.doseNumber > 1 ? `#${d.doseNumber}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant pointer-events-none">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </span>
                  </div>
                </div>

                {selected && (
                  <div className="rounded-lg border border-outline-variant bg-surface p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-body-md font-semibold text-on-surface">{selected.vaccineName} ({selected.vaccineCode})</p>
                      </div>
                      <div>
                        <p className="text-body-md font-semibold text-on-surface">Dose {selected.doseNumber}</p>
                      </div>
                      <div>
                        <p className="text-body-md font-semibold text-error">{formatDate(selected.dueDate)}</p>
                      </div>
                      <div>
                        <p className="text-body-md font-semibold text-on-surface truncate">{selected.beneficiaryName ?? 'Unknown'}</p>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-outline bg-surface px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline resize-none"
                      placeholder="Vaccine batch number (optional)…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <button
                      onClick={() => record.mutate()}
                      disabled={record.isPending}
                      className="w-full h-12 rounded-lg bg-success text-on-success font-label-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors hover:bg-success/90"
                    >
                      {record.isPending ? (
                        <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">task_alt</span>
                          Mark As Administered
                        </>
                      )}
                    </button>
                    {record.isSuccess && (
                      <p className="text-caption text-success flex items-center gap-1 font-semibold">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Dose recorded successfully.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
  )
}

