import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ASHACard } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui.store'
import { getErrorMessage } from '@/components/common/ErrorState'
import { dashboardService } from '@/services/dashboard.service'
import { resourceService, type ResourceType } from '@/services/resource.service'
import { configService } from '@/services/config.service'
import { SearchableSelect } from '@/components/common/SearchableSelect'

const inputCls =
  'h-12 w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

const RESOURCE_TYPES: { key: ResourceType; icon: string; label: string }[] = [
  { key: 'staff', icon: 'groups', label: 'Staff' },
  { key: 'vaccines', icon: 'vaccines', label: 'Vaccines' },
  { key: 'equipment', icon: 'medical_services', label: 'Equipment' },
  { key: 'medicines', icon: 'medication', label: 'Medicines' },
  { key: 'vehicles', icon: 'local_shipping', label: 'Vehicles' },
]

export default function ResourceAllocationPage() {
  const { user } = useAuth()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()

  const [statePick, setStatePick] = useState('')
  const [district, setDistrict] = useState('')
  const [block, setBlock] = useState('')
  const [phcSelect, setPhcSelect] = useState('')
  const [resourceType, setResourceType] = useState<ResourceType>('staff')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  const effectiveStateId = user?.stateId || statePick

  const statesQuery = useQuery({
    queryKey: ['config', 'states'],
    queryFn: () => configService.getStates(),
    enabled: !user?.stateId,
  })
  const districtsQuery = useQuery({
    queryKey: ['config', 'districts', effectiveStateId],
    queryFn: () => configService.getDistricts(effectiveStateId!),
    enabled: Boolean(effectiveStateId),
  })
  const blocksQuery = useQuery({
    queryKey: ['config', 'blocks', district],
    queryFn: () => configService.getBlocks(district),
    enabled: Boolean(district),
  })
  const phcListQuery = useQuery({
    queryKey: ['config', 'phcs', block],
    queryFn: () => configService.getPHCs(block),
    enabled: Boolean(block),
  })

  const allocationsQuery = useQuery({
    queryKey: ['resource-allocations'],
    queryFn: () => resourceService.listAllocations({}),
  })

  const utilizationQuery = useQuery({
    queryKey: ['district-dashboard', user?.districtId || district || 'all'],
    queryFn: () => dashboardService.getDistrictDashboard(user?.districtId || district),
    enabled: Boolean(user?.districtId || district),
  })

  const utilization = utilizationQuery.data?.resourceUtilization ?? []
  const allocations = allocationsQuery.data ?? []

  const phcName = phcListQuery.data?.find((p) => p.id === phcSelect)?.name ?? ''

  const allocateMutation = useMutation({
    mutationFn: () =>
      resourceService.createAllocation({
        phcId: phcSelect,
        resourceType,
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
        districtId: district || user?.districtId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-allocations'] })
      addToast('success', `${quantity} ${resourceType} allocated to ${phcName}`)
      setQuantity('')
      setNotes('')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const canSubmit = !!phcSelect && !!quantity && Number(quantity) > 0 && !allocateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-5">
        <div className="desktop:col-span-2">
          <ASHACard title="Allocate Resources">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!user?.stateId && (
                <SearchableSelect
                  id="ra_state"
                  label="State *"
                  options={(statesQuery.data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code }))}
                  showCode
                  value={statePick}
                  onChange={(id) => { setStatePick(id); setDistrict(''); setBlock(''); setPhcSelect('') }}
                  placeholder="Select state"
                  loading={statesQuery.isLoading}
                  loadingLabel="Loading states…"
                />
              )}
              <SearchableSelect
                id="ra_district"
                label="District *"
                options={(districtsQuery.data ?? []).map((d) => ({ id: d.id, name: d.name, code: d.code }))}
                showCode
                value={district}
                onChange={(id) => { setDistrict(id); setBlock(''); setPhcSelect('') }}
                placeholder={effectiveStateId ? 'Select district' : 'Select a state first'}
                loading={districtsQuery.isLoading}
                loadingLabel="Loading districts…"
                disabled={!effectiveStateId}
                disabledHint="Select a state first"
              />
              <SearchableSelect
                id="ra_block"
                label="Block *"
                options={(blocksQuery.data ?? []).map((b) => ({ id: b.id, name: b.name, code: b.code }))}
                showCode
                value={block}
                onChange={(id) => { setBlock(id); setPhcSelect('') }}
                placeholder={district ? 'Select block' : 'Select a district first'}
                loading={blocksQuery.isLoading}
                loadingLabel="Loading blocks…"
                disabled={!district}
                disabledHint="Select a district first"
              />
              <SearchableSelect
                id="ra_phc"
                label="PHC *"
                options={(phcListQuery.data ?? []).map((p) => ({ id: p.id, name: p.name, code: p.code }))}
                showCode
                value={phcSelect}
                onChange={setPhcSelect}
                placeholder={block ? 'Select PHC' : 'Select a block first'}
                loading={phcListQuery.isLoading}
                loadingLabel="Loading PHCs…"
                disabled={!block}
                disabledHint="Select a block first"
              />
            </div>

            <div>
              <span className="mb-2 block text-label-md text-on-surface-variant">Resource Type *</span>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {RESOURCE_TYPES.map((rt) => (
                  <button
                    key={rt.key}
                    type="button"
                    onClick={() => setResourceType(rt.key)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all ${
                      resourceType === rt.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{rt.icon}</span>
                    <span className="text-label-sm font-semibold">{rt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant" htmlFor="ra_qty">Quantity *</label>
                <input className={inputCls} id="ra_qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1 – 1000" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-md text-on-surface-variant" htmlFor="ra_notes">Notes (Optional)</label>
                <input className={inputCls} id="ra_notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Cold-chain delivery" />
              </div>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => allocateMutation.mutate()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant active:scale-[0.98] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              {allocateMutation.isPending ? 'Allocating…' : `Allocate to ${phcName || 'PHC'}`}
            </button>
          </div>
        </ASHACard>
        </div>

        <div className="desktop:col-span-3 flex flex-col gap-6">
          {utilization.length > 0 && (
            <ASHACard title="Resource Utilization">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant">PHC</th>
                      <th className="px-4 py-3 text-right text-label-md uppercase tracking-wide text-on-surface-variant">Staff Fill</th>
                      <th className="px-4 py-3 text-right text-label-md uppercase tracking-wide text-on-surface-variant">Vaccine Stock</th>
                      <th className="px-4 py-3 text-right text-label-md uppercase tracking-wide text-on-surface-variant">Equipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {utilization.map((r) => (
                      <tr key={r.phcId} className="hover:bg-surface-container-low">
                        <td className="px-4 py-3 font-medium text-on-surface">{r.phcName}</td>
                        <td className="px-4 py-3 text-right"><Bar value={r.staffFillRate} /></td>
                        <td className="px-4 py-3 text-right"><Bar value={r.vaccineStockPct} /></td>
                        <td className="px-4 py-3 text-right"><Bar value={r.equipmentUtilization} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ASHACard>
          )}

          <ASHACard title="Recent Allocations">
            {allocationsQuery.isPending ? (
              <p className="text-body-md text-on-surface-variant">Loading…</p>
            ) : allocations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="material-symbols-outlined text-[40px] text-outline">inventory_2</span>
                <p className="text-body-md text-on-surface-variant">No allocations yet.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {allocations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg border border-outline-variant px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="material-symbols-outlined text-[20px]">
                          {a.resourceType === 'staff' ? 'groups' : a.resourceType === 'vaccines' ? 'vaccines' : 'medical_services'}
                        </span>
                      </span>
                      <div>
                        <p className="text-body-md font-medium text-on-surface">{a.phcName}</p>
                        <p className="text-label-sm text-on-surface-variant capitalize">
                          {a.resourceType} · {new Date(a.createdAt).toLocaleDateString()}
                        </p>
                        {a.notes && (
                          <p className="text-label-sm text-on-surface-variant italic">{a.notes}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-label-lg font-bold text-primary">+{a.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </ASHACard>
        </div>
      </div>
    </div>
  )
}

function Bar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-tertiary' : value >= 50 ? 'bg-primary' : 'bg-error'
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="w-10 text-label-md font-semibold text-on-surface">{value}%</span>
      <div className="h-2.5 w-20 overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
