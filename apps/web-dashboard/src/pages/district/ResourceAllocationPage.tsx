import { useMemo, useState } from 'react'
import { ASHAButton, ASHACard, ASHAInput } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/common/Icons'

type ResourceType = 'staff' | 'vaccines' | 'equipment'

interface AllocationRow {
  id: string
  phcId: string
  phcName: string
  staffFillRate: number
  vaccineStockPct: number
  equipmentUtilization: number
}

const INITIAL_ALLOCATIONS: AllocationRow[] = [
  { id: 'a1', phcId: 'phc-1', phcName: 'PHC Rampur', staffFillRate: 58, vaccineStockPct: 66, equipmentUtilization: 49 },
  { id: 'a2', phcId: 'phc-2', phcName: 'PHC Sonpur', staffFillRate: 76, vaccineStockPct: 82, equipmentUtilization: 71 },
  { id: 'a3', phcId: 'phc-3', phcName: 'PHC Kandwa', staffFillRate: 43, vaccineStockPct: 57, equipmentUtilization: 38 },
  { id: 'a4', phcId: 'phc-4', phcName: 'PHC Tikari', staffFillRate: 69, vaccineStockPct: 74, equipmentUtilization: 66 },
  { id: 'a5', phcId: 'phc-5', phcName: 'PHC Basari', staffFillRate: 81, vaccineStockPct: 90, equipmentUtilization: 84 },
]

export default function ResourceAllocationPage() {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const [rows, setRows] = useState<AllocationRow[]>(INITIAL_ALLOCATIONS)
  const [form, setForm] = useState({ phcName: '', resourceType: 'staff' as ResourceType, quantity: '' })

  const totalBatches = useMemo(() => rows.length, [rows])

  const handleAllocate = () => {
    if (!form.phcName.trim() || !form.quantity) return
    setRows((prev) =>
      prev.map((r) => {
        if (r.phcName !== form.phcName.trim()) return r
        const delta = Number(form.quantity)
        if (form.resourceType === 'staff') return { ...r, staffFillRate: Math.min(100, r.staffFillRate + delta) }
        if (form.resourceType === 'vaccines') return { ...r, vaccineStockPct: Math.min(100, r.vaccineStockPct + delta) }
        return { ...r, equipmentUtilization: Math.min(100, r.equipmentUtilization + delta) }
      }),
    )
    addToast('success', t('district.allocateToast'))
    setForm({ phcName: '', resourceType: 'staff', quantity: '' })
  }

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
            <ASHAInput label={t('district.phcName')} value={form.phcName} onChange={(e) => setForm({ ...form, phcName: e.target.value })} placeholder="PHC Rampur" />
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
            <ASHAInput label={t('district.quantity')} type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="% points to top up" />
            <ASHAButton fullWidth icon={<Icon name="upload" size={16} />} onClick={handleAllocate} disabled={!form.phcName.trim() || !form.quantity} label={t('district.allocateResources')} />
          </div>
        </ASHACard>

        <ASHACard title={t('district.utilization')} subtitle={`${totalBatches} PHCs`}>
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
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low">
                    <td className="px-3 py-3 font-medium text-on-surface">{r.phcName}</td>
                    <td className="px-3 py-3 text-right"><Bar value={r.staffFillRate} /></td>
                    <td className="px-3 py-3 text-right"><Bar value={r.vaccineStockPct} /></td>
                    <td className="px-3 py-3 text-right"><Bar value={r.equipmentUtilization} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
