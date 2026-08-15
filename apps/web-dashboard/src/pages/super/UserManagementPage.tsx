import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ASHAButton, ASHACard, ASHAInput, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { usePermissions } from '@/hooks/usePermissions'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Icon } from '@/components/common/Icons'
import type { Role } from '@/types'

interface ManagedUser {
  id: string
  fullName: string
  phone: string
  email?: string
  role: Role
  stateName: string
  districtName?: string
  phcName?: string
  active: boolean
  lastLoginAt?: string
}

const ROLES: Role[] = ['asha', 'anm', 'moic', 'bpm', 'dpm', 'state_admin', 'super_admin']

const INITIAL_USERS: ManagedUser[] = [
  { id: 'u1', fullName: 'R. Verma', phone: '9876500001', email: 'r.verma@state.gov.in', role: 'state_admin', stateName: 'Bihar', active: true, lastLoginAt: new Date().toISOString() },
  { id: 'u2', fullName: 'S. Mishra', phone: '9876500002', email: 's.mishra@district.gov.in', role: 'dpm', stateName: 'Bihar', districtName: 'Gaya', active: true },
  { id: 'u3', fullName: 'A. Sinha', phone: '9876500003', role: 'moic', stateName: 'Bihar', districtName: 'Gaya', phcName: 'PHC Rampur', active: true },
  { id: 'u4', fullName: 'D. Kumar', phone: '9876500004', role: 'bpm', stateName: 'Bihar', districtName: 'Nalanda', active: false },
  { id: 'u5', fullName: 'K. Shah', phone: '9876500005', role: 'super_admin', stateName: 'All States', active: true },
]

export default function UserManagementPage() {
  const { t } = useLocalization()
  const { can } = usePermissions()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async (payload: Omit<ManagedUser, 'id'> & { id?: string }) => {
      if (payload.id) return Promise.resolve({ ...payload, id: payload.id })
      return Promise.resolve({ ...payload, id: `u-${Date.now()}` })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] })
      addToast('success', editing ? t('super.userUpdated') : t('super.userCreated'))
      setEditing(null)
      setShowCreate(false)
    },
  })

  const columns: Column<ManagedUser>[] = useMemo(
    () => [
      { key: 'fullName', header: t('common.name'), sortable: true, render: (r) => <span className="font-medium text-on-surface">{r.fullName}</span> },
      { key: 'phone', header: t('super.phoneNumber') },
      { key: 'email', header: 'Email', render: (r) => r.email ?? <span className="text-outline">—</span> },
      { key: 'role', header: t('common.role'), render: (r) => <StatusChip status={roleChip(r.role)} label={r.role.replace('_', ' ')} /> },
      { key: 'stateName', header: t('super.assignState') },
      { key: 'districtName', header: t('super.assignDistrict'), render: (r) => r.districtName ?? <span className="text-outline">—</span> },
      { key: 'phcName', header: t('super.assignPhc'), render: (r) => r.phcName ?? <span className="text-outline">—</span> },
      { key: 'active', header: t('common.status'), render: (r) => <StatusChip status={r.active ? 'success' : 'neutral'} label={r.active ? t('common.active') : t('common.inactive')} /> },
      {
        key: 'actions',
        header: t('common.actions'),
        render: (r) => (
          <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="edit" size={16} />} onClick={() => setEditing(r)} label={t('common.edit')} />
        ),
      },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.userManagement')}
        subtitle={t('super.usersSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/super/users' }]}
        actions={
          can('users:manage') ? (
            <ASHAButton fullWidth={false} icon={<Icon name="plus" size={16} />} onClick={() => setShowCreate(true)} label={t('super.createUser')} />
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={INITIAL_USERS.slice((page - 1) * 10, page * 10)}
        loading={false}
        keyExtractor={(r) => r.id}
        pagination={{ page, pageSize: 10, total: INITIAL_USERS.length, onPageChange: setPage }}
      />

      {showCreate || editing ? (
        <UserFormModal
          key={editing?.id ?? 'new'}
          user={editing}
          onCancel={() => {
            setShowCreate(false)
            setEditing(null)
          }}
          onSave={(payload) => saveMutation.mutate(payload)}
        />
      ) : null}
    </div>
  )
}

function roleChip(role: Role): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (role) {
    case 'super_admin': return 'danger'
    case 'state_admin': return 'warning'
    case 'dpm': return 'info'
    case 'moic':
    case 'bpm': return 'success'
    default: return 'neutral'
  }
}

function UserFormModal({
  user,
  onCancel,
  onSave,
}: {
  user: ManagedUser | null
  onCancel: () => void
  onSave: (payload: Omit<ManagedUser, 'id'> & { id?: string }) => void
}) {
  const { t } = useLocalization()
  const [form, setForm] = useState<Omit<ManagedUser, 'id'> & { id?: string }>({
    id: user?.id,
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'asha',
    stateName: user?.stateName ?? 'Bihar',
    districtName: user?.districtName ?? '',
    phcName: user?.phcName ?? '',
    active: user?.active ?? true,
  })

  return (
    <Modal title={user ? t('super.editUser') : t('super.createUser')} onCancel={onCancel}>
      <div className="space-y-4">
        <ASHAInput label={t('super.fullName')} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        <ASHAInput label={t('super.phoneNumber')} type="tel" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
        <ASHAInput label="Email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label={t('common.role')}>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="h-touch w-full rounded-md border border-outline bg-surface-container-lowest px-3 text-body-md text-on-surface outline-none focus:border-primary">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
          <ASHAInput label={t('super.assignState')} value={form.stateName} onChange={(e) => setForm({ ...form, stateName: e.target.value })} />
          <ASHAInput label={t('super.assignDistrict')} value={form.districtName ?? ''} onChange={(e) => setForm({ ...form, districtName: e.target.value })} />
          <ASHAInput label={t('super.assignPhc')} value={form.phcName ?? ''} onChange={(e) => setForm({ ...form, phcName: e.target.value })} />
        </div>
        <Field label={t('common.status')}>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-5 w-5 accent-primary" />
            <span className="text-body-md text-on-surface">{form.active ? t('common.active') : t('common.inactive')}</span>
          </label>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <ASHAButton variant="outline" fullWidth={false} onClick={onCancel} label={t('common.cancel')} />
          <ASHAButton
            fullWidth={false}
            disabled={form.fullName.trim().length < 2 || form.phone.length !== 10}
            icon={<Icon name="check" size={16} />}
            onClick={() => onSave(form)}
            label={t('common.save')}
          />
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-label-md text-on-surface-variant">{label}</span>
      {children}
    </div>
  )
}

function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-label={title}>
      <ASHACard title={title}>
        <div className="relative">
          <button type="button" aria-label="Close" onClick={onCancel} className="absolute -top-1 right-0 flex h-9 w-9 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container">
            <Icon name="x" size={18} />
          </button>
          {children}
        </div>
      </ASHACard>
    </div>
  )
}
