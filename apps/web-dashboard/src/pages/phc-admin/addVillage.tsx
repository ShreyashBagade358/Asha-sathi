import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { useAuth } from '@/hooks/useAuth'
import { configService } from '@/services/config.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
const labelCls = 'block text-label-md text-on-surface-variant mb-1.5'

export default function AddVillagePhcAdmin() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const phcId = user?.phcId

  const [form, setForm] = useState({ name: '', code: '', households: '', population: '' })

  const villages = useQuery({
    queryKey: ['villages', phcId],
    queryFn: () => configService.getVillages(phcId!),
    enabled: Boolean(phcId),
  })

  const create = useMutation({
    mutationFn: () =>
      configService.createVillage(phcId!, {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        totalHouseholds: form.households ? Number(form.households) : undefined,
        totalPopulation: form.population ? Number(form.population) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['villages'] })
      setForm({ name: '', code: '', households: '', population: '' })
    },
  })

  if (!phcId) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <div className="max-w-md mx-auto mt-16">
            <EmptyState title="No PHC assigned" description="Your account is not linked to a PHC yet. Contact an administrator." icon="location_off" />
          </div>
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
              <span className="material-symbols-outlined text-primary text-[20px]">add_location_alt</span>
              Village Management
            </h2>
            <p className="text-caption text-on-surface-variant">{user?.phcName ?? 'PHC'} · PHC village directory</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          <div className="max-w-xl bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-headline-md text-on-surface">Add New Village</h3>
              <p className="text-caption text-on-surface-variant">Registers the village under this PHC's sub-center.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Village name *</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Sarnath"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Village code</label>
                <input
                  className={inputCls}
                  placeholder="Auto-generated if blank"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Total households</label>
                  <input
                    className={inputCls}
                    type="number" min={0} inputMode="numeric"
                    placeholder="e.g. 120"
                    value={form.households}
                    onChange={(e) => setForm({ ...form, households: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Total population</label>
                  <input
                    className={inputCls}
                    type="number" min={0} inputMode="numeric"
                    placeholder="e.g. 540"
                    value={form.population}
                    onChange={(e) => setForm({ ...form, population: e.target.value })}
                  />
                </div>
              </div>
              <button
                onClick={() => create.mutate()}
                disabled={!form.name.trim() || create.isPending}
                className="w-full h-12 rounded-lg bg-primary text-on-primary font-label-md font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors hover:bg-primary/90"
              >
                {create.isPending ? (
                  <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">add_location_alt</span>
                    Add Village
                  </>
                )}
              </button>
              {create.isSuccess && (
                <p className="text-caption text-success flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Village added successfully.
                </p>
              )}
              {create.isError && (
                <p className="text-caption text-error flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {getErrorMessage(create.error)}
                </p>
              )}
            </div>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-headline-md text-on-surface">Villages ({villages.data?.length ?? 0})</h3>
            </div>
            {villages.isLoading ? (
              <div className="p-6"><LoadingState label="Loading villages…" /></div>
            ) : villages.isError ? (
              <div className="p-6"><ErrorState message={getErrorMessage(villages.error)} onRetry={() => villages.refetch()} /></div>
            ) : (villages.data ?? []).length === 0 ? (
              <div className="p-6"><EmptyState title="No villages yet" description="Add your first village above." icon="location_on" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/50 bg-surface-container/50">
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Name</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant">Code</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-right">Households</th>
                      <th className="px-5 py-2.5 text-label-md font-semibold text-on-surface-variant text-right">Population</th>
                    </tr>
                  </thead>
                  <tbody>
                    {villages.data!.map((v, i) => (
                      <tr
                        key={v.id}
                        className={`transition-colors hover:bg-surface-container/40 ${i < (villages.data?.length ?? 0) - 1 ? 'border-b border-outline-variant/40' : ''}`}
                      >
                        <td className="px-5 py-3 text-label-sm font-semibold text-on-surface">{v.name}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface-variant">{v.code ?? '—'}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface text-right">{v.totalHouseholds ?? '—'}</td>
                        <td className="px-5 py-3 text-label-sm text-on-surface text-right">{v.totalPopulation ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}