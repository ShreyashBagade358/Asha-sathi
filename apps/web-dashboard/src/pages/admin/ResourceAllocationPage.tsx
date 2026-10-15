import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ASHAButton, ASHACard, ASHAInput } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/common/Icons'
import { getErrorMessage } from '@/components/common/ErrorState'
import { dashboardService } from '@/services/dashboard.service'
import { resourceService, type ResourceType } from '@/services/resource.service'

export default function ResourceAllocationPage() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ phcId: '', resourceType: 'staff' as ResourceType, quantity: '' })

  const dashboardQuery = useQuery({
    queryKey: ['district-dashboard', user?.districtId ?? 'default'],
    queryFn: () => dashboardService.getDistrictDashboard(user?.districtId),
    enabled: !!user?.districtId,
  })

  const allocationsQuery = useQuery({
    queryKey: ['resource-allocations', user?.districtId ?? 'default'],
    queryFn: () => resourceService.listAllocations({ districtId: user?.districtId }),
    enabled: !!user?.districtId,
  })

  const utilization = dashboardQuery.data?.resourceUtilization ?? []
  const allocations = allocationsQuery.data ?? []
  const totalBatches = utilization.length

  const allocateMutation = useMutation({
    mutationFn: () =>
      resourceService.createAllocation({
        phcId: form.phcId,
        resourceType: form.resourceType,
        quantity: Number(form.quantity),
        districtId: user?.districtId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-allocations'] })
      addToast('success', t('district.allocateToast'))
      setForm({ phcId: '', resourceType: 'staff', quantity: '' })
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const canSubmit = !!form.phcId && !!form.quantity && Number(form.quantity) > 0 && !allocateMutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.resourceAllocation')}
        subtitle={t('district.resourcesSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/district/dashboard' }, { label: t('nav.resourceAllocation') }]}
      />

      <div className="grid grid-cols-1 gap-6 desktop:grid-cols-3">
        <ASHACard title={t('district.allocateResources')}>
          <div className="space-y-4">
            <div>
              <span className="mb-1 block text-label-md text-on-surface-variant">{t('district.phcName')}</span>
              <select
                value={form.phcId}
                onChange={(e) => setForm({ ...form, phcId: e.target.value })}
                className="h-touch w-full rounded-md border border-outline bg-surface-container-lowest px-3 text-body-md text-on-surface outline-none focus:border-primary"
              >
                <option value="">{t('district.selectPhc')}</option>
                {utilization.map((u) => (
                  <option key={u.phcId} value={u.phcId}>{u.phcName}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-label-md text-on-surface-variant">{t('district.resourceType')}</span>
              <div className="flex gap-2">
                {(['staff', 'vaccines', 'equipment'] as ResourceType[]).map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setForm({ ...form, resourceType: rt })}
                    className={`h-touch flex-1 rounded-md border px-3 text-label-lg font-medium transition-colors ${
                      form.resourceType === rt ? 'border-primary bg-primary text-on-primary' : 'border-outline text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <Icon name={rt === 'staff' ? 'users' : rt === 'vaccines' ? 'shield' : 'box'} size={16} className="mx-auto mb-1" />
                    {t(`district.${rt}`)}
                  </button>
                ))}
              </div>
            </div>
            <ASHAInput
              label={t('district.quantity')}
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="1 – 1000"
            />
            <ASHAButton
              fullWidth
              icon={<Icon name="upload" size={16} />}
              onClick={() => allocateMutation.mutate()}
              disabled={!canSubmit}
              label={allocateMutation.isPending ? t('common.loading') : t('district.allocateResources')}
            />
          </div>
        </ASHACard>

        <ASHACard title={t('district.utilization')} subtitle={`${totalBatches} PHCs`}>
          {dashboardQuery.isPending ? (
            <p className="text-body-md text-on-surface-variant">{t('common.loading')}</p>
          ) : utilization.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">{t('common.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-3 py-2.5 text-label-md uppercase tracking-wide text-on-surface-variant">{t('district.phcName')}</th>
                    <th className="px-3 py-2.5 text-right text-label-md uppercase tracking-wide text-on-surface-variant">{t('district.staffFillRate')}</th>
                    <th className="px-3 py-2.5 text-right text-label-md uppercase tracking-wide text-on-surface-variant">{t('district.vaccineStock')}</th>
                    <th className="px-3 py-2.5 text-right text-label-md uppercase tracking-wide text-on-surface-variant">{t('district.equipmentUtil')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {utilization.map((r) => (
                    <tr key={r.phcId} className="hover:bg-surface-container-low">
                      <td className="px-3 py-3 font-medium text-on-surface">{r.phcName}</td>
                      <td className="px-3 py-3 text-right"><Bar value={r.staffFillRate} /></td>
                      <td className="px-3 py-3 text-right"><Bar value={r.vaccineStockPct} /></td>
                      <td className="px-3 py-3 text-right"><Bar value={r.equipmentUtilization} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ASHACard>

        <ASHACard title={t('district.recentAllocations')} subtitle={`${allocations.length}`}>
          {allocationsQuery.isPending ? (
            <p className="text-body-md text-on-surface-variant">{t('common.loading')}</p>
          ) : allocations.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">{t('district.noAllocations')}</p>
          ) : (
            <ul className="space-y-2">
              {allocations.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-outline-variant px-3 py-2.5">
                  <div>
                    <p className="text-body-md font-medium text-on-surface">{a.phcName}</p>
                    <p className="text-label-md text-on-surface-variant">
                      {t(`district.${a.resourceType}`)} · {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-label-lg font-semibold text-primary">+{a.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </ASHACard>
      </div>
    </div>
  )
}

function Bar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-tertiary' : value >= 50 ? 'bg-primary' : 'bg-secondary'
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="w-8 text-label-md font-semibold text-on-surface">{value}%</span>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
