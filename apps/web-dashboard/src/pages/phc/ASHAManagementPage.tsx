import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ASHAButton, ASHACard, ASHAInput, StatusChip } from 'asha-design-system'
import { useDebounce } from '@/hooks/useDebounce'
import { useLocalization } from '@/hooks/useLocalization'
import { usePermissions } from '@/hooks/usePermissions'
import { useUIStore } from '@/stores/ui.store'
import { ashaService, type ASHAUser } from '@/services/asha.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Icon } from '@/components/common/Icons'

const VILLAGE_OPTIONS = ['Rampur', 'Sonpur', 'Kandwa', 'Tikari', 'Basari']

export default function ASHAManagementPage() {
  const { t } = useLocalization()
  const { can } = usePermissions()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 300)

  const [showAddModal, setShowAddModal] = useState(false)
  const [assignTarget, setAssignTarget] = useState<ASHAUser | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ashas', { search: debouncedSearch, village, status, page }],
    queryFn: () => ashaService.listASHAs({ search: debouncedSearch || undefined, village: village || undefined, status: status === 'all' ? undefined : (status as 'active' | 'inactive' | 'on_leave'), page, pageSize: 10 }),
  })

  const createMutation = useMutation({
    mutationFn: ashaService.createASHA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ashas'] })
      setShowAddModal(false)
      addToast('success', t('phc.addedToast'))
    },
    onError: () => addToast('error', t('common.errorMsg')),
  })

  const assignMutation = useMutation({
    mutationFn: ({ id, villages }: { id: string; villages: string[] }) => ashaService.assignVillages(id, villages),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ashas'] })
      setAssignTarget(null)
      addToast('success', t('phc.villagesUpdatedToast'))
    },
    onError: () => addToast('error', t('common.errorMsg')),
  })

  const columns: Column<ASHAUser>[] = useMemo(
    () => [
      { key: 'name', header: t('common.name'), sortable: true, render: (r) => <span className="font-medium text-on-surface">{r.name}</span> },
      { key: 'ashaId', header: t('phc.ashaId'), sortable: true },
      { key: 'village', header: t('common.village'), sortable: true },
      { key: 'phone', header: t('phc.contact') },
      { key: 'assignedHouseholds', header: t('phc.assignedHouseholds'), sortable: true, align: 'right' },
      { key: 'performanceScore', header: t('phc.performance'), sortable: true, align: 'right', render: (r) => <span className={`font-semibold ${r.performanceScore >= 75 ? 'text-tertiary' : r.performanceScore >= 60 ? 'text-secondary' : 'text-error'}`}>{r.performanceScore}</span> },
      { key: 'status', header: t('common.status'), render: (r) => <StatusChip status={r.status === 'active' ? 'success' : r.status === 'on_leave' ? 'warning' : 'neutral'} label={t(`common.${r.status === 'on_leave' ? 'onLeave' : r.status}`)} /> },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('phc.ashaManagementTitle')}
        subtitle={t('phc.ashaManagementSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/phc/dashboard' }, { label: t('nav.ashas') }]}
        actions={
          can('asha:edit') ? (
            <ASHAButton fullWidth={false} icon={<Icon name="plus" size={16} />} onClick={() => setShowAddModal(true)} label={t('phc.addAsha')} />
          ) : undefined
        }
      />

      <ASHACard title={t('phc.filters')}>
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-4">
          <div className="tablet:col-span-2">
            <ASHAInput
              label={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('phc.searchPlaceholder')}
              type="search"
            />
          </div>
          <ASHAInput label={t('common.village')} value={village} onChange={(e) => setVillage(e.target.value)} />
          <div>
            <span className="mb-1 block text-label-md text-on-surface-variant">{t('common.status')}</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-touch w-full rounded-md border border-outline bg-surface-container-lowest px-3 text-body-md text-on-surface outline-none focus:border-primary"
            >
              <option value="all">{t('phc.statusAll')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="on_leave">{t('common.onLeave')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
          </div>
        </div>
      </ASHACard>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        keyExtractor={(r) => r.id}
        pagination={data ? { page: data.page, pageSize: data.pageSize, total: data.total, onPageChange: setPage } : undefined}
      />

      {assignTarget ? (
        <AssignVillagesModal
          asha={assignTarget}
          onCancel={() => setAssignTarget(null)}
          onConfirm={(villages) => assignMutation.mutate({ id: assignTarget.id, villages })}
        />
      ) : null}
      {showAddModal ? <AddASHAModal onCancel={() => setShowAddModal(false)} onSave={(payload) => createMutation.mutate(payload)} /> : null}
    </div>
  )
}

interface AddASHAModalProps {
  onCancel: () => void
  onSave: (payload: Omit<ASHAUser, 'id' | 'ashaId' | 'performanceScore'>) => void
}

function AddASHAModal({ onCancel, onSave }: AddASHAModalProps) {
  const { t } = useLocalization()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [village, setVillage] = useState(VILLAGE_OPTIONS[0])
  const [households, setHouseholds] = useState('20')

  return (
    <Modal title={t('phc.addAshaTitle')} onCancel={onCancel}>
      <div className="space-y-4">
        <ASHAInput label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} required />
        <ASHAInput label={t('common.phone')} type="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
        <ASHAInput label={t('common.village')} value={village} onChange={(e) => setVillage(e.target.value)} />
        <ASHAInput label={t('phc.assignedHouseholds')} type="number" value={households} onChange={(e) => setHouseholds(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <ASHAButton variant="outline" fullWidth={false} onClick={onCancel} label={t('common.cancel')} />
          <ASHAButton
            fullWidth={false}
            disabled={name.trim().length < 2 || phone.length !== 10}
            icon={<Icon name="check" size={16} />}
            onClick={() => onSave({ name: name.trim(), phone, village, assignedHouseholds: Number(households) || 0, status: 'active' })}
            label={t('common.save')}
          />
        </div>
      </div>
    </Modal>
  )
}

function AssignVillagesModal({
  asha,
  onCancel,
  onConfirm,
}: {
  asha: ASHAUser
  onCancel: () => void
  onConfirm: (villages: string[]) => void
}) {
  const { t } = useLocalization()
  const [selected, setSelected] = useState<string[]>([asha.village])

  const toggle = (v: string) => {
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  return (
    <Modal title={t('phc.assignVillagesTitle')} onCancel={onCancel}>
      <p className="mb-3 text-body-md text-on-surface-variant">
        {asha.name} · {asha.ashaId}
      </p>
      <div className="space-y-2">
        {VILLAGE_OPTIONS.map((v) => (
          <label key={v} className="flex cursor-pointer items-center gap-3 rounded-md border border-outline-variant px-3 py-2.5 hover:bg-surface-container-low">
            <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} className="h-5 w-5 accent-primary" />
            <span className="text-body-md text-on-surface">{v}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <ASHAButton variant="outline" fullWidth={false} onClick={onCancel} label={t('common.cancel')} />
        <ASHAButton fullWidth={false} disabled={selected.length === 0} icon={<Icon name="check" size={16} />} onClick={() => onConfirm(selected)} label={t('common.confirm')} />
      </div>
    </Modal>
  )
}

function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-label={title}>
      <ASHACard title={title}>
        <div className="relative">
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="absolute -top-1 right-0 flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="x" size={18} />
          </button>
          {children}
        </div>
      </ASHACard>
    </div>
  )
}
