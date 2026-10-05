import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ASHAButton, ASHACard, ASHAInput, StatusChip } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { usePermissions } from '@/hooks/usePermissions'
import { useUIStore } from '@/stores/ui.store'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Icon } from '@/components/common/Icons'
import { getErrorMessage } from '@/components/common/ErrorState'
import { CredentialsModal, type CredentialsValue } from '@/components/common/CredentialsModal'
import { userService, type ManagedUser } from '@/services/user.service'
import { configService } from '@/services/config.service'
import { SearchableSelect } from '@/components/common/SearchableSelect'
import type { Role } from '@/types'

const ROLES: Role[] = ['asha', 'admin', 'patient']
const PAGE_SIZE = 10
const selectCls =
  'h-touch w-full rounded-md border border-outline bg-surface-container-lowest px-3 text-body-md text-on-surface outline-none focus:border-primary'

interface FormValues {
  id?: string
  fullName: string
  phone: string
  email: string
  role: Role
  password: string
  stateId: string
  districtId: string
  blockId: string
  phcId: string
  villageId: string
  active: boolean
}

export default function UserManagementPage() {
  const { t } = useLocalization()
  const { can } = usePermissions()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [credentials, setCredentials] = useState<CredentialsValue | null>(null)

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, roleFilter])

  const usersQuery = useQuery({
    queryKey: ['managed-users', page, deferredSearch, roleFilter],
    queryFn: () =>
      userService.list({
        page,
        pageSize: PAGE_SIZE,
        q: deferredSearch || undefined,
        role: roleFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: FormValues): Promise<{ user: ManagedUser; password: string } | ManagedUser> => {
      if (payload.id) {
        return userService.update(payload.id, {
          fullName: payload.fullName,
          email: payload.email,
          role: payload.role,
          stateId: payload.stateId,
          districtId: payload.districtId,
          blockId: payload.blockId,
          phcId: payload.phcId,
          active: payload.active,
        })
      }
      return userService.create({
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        role: payload.role,
        password: payload.password,
        stateId: payload.stateId,
        districtId: payload.districtId,
        blockId: payload.blockId,
        phcId: payload.phcId,
        villageId: payload.role === 'asha' ? payload.villageId : undefined,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] })
      addToast('success', editing ? t('super.userUpdated') : t('super.userCreated'))
      setEditing(null)
      setShowCreate(false)
      if (!editing && 'password' in result) {
        setCredentials({ name: result.user.fullName, phone: result.user.phone, password: result.password })
      }
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: async (user: ManagedUser) => {
      if (user.active) {
        await userService.deactivate(user.id)
        return 'deactivated'
      }
      await userService.update(user.id, {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        stateId: user.stateId,
        districtId: user.districtId,
        blockId: user.blockId,
        phcId: user.phcId,
        active: true,
      })
      return 'activated'
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] })
      addToast('success', result === 'deactivated' ? t('super.userDeactivated') : t('super.userActivated'))
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const handleToggle = (user: ManagedUser) => {
    if (user.active && !window.confirm(t('super.deactivateConfirm'))) return
    toggleMutation.mutate(user)
  }

  const items = usersQuery.data?.items ?? []
  const total = usersQuery.data?.total ?? 0

  const columns: Column<ManagedUser>[] = useMemo(
    () => [
      { key: 'fullName', header: t('common.name'), sortable: true, render: (r) => <span className="font-medium text-on-surface">{r.fullName}</span> },
      { key: 'phone', header: t('super.phoneNumber') },
      { key: 'email', header: t('super.email'), render: (r) => r.email ?? <span className="text-outline">—</span> },
      { key: 'role', header: t('common.role'), render: (r) => <StatusChip status={roleChip(r.role)} label={r.role.replace('_', ' ')} /> },
      { key: 'stateName', header: t('super.assignState'), render: (r) => r.stateName ?? <span className="text-outline">—</span> },
      { key: 'districtName', header: t('super.assignDistrict'), render: (r) => r.districtName ?? <span className="text-outline">—</span> },
      { key: 'phcName', header: t('super.assignPhc'), render: (r) => r.phcName ?? <span className="text-outline">—</span> },
      { key: 'active', header: t('common.status'), render: (r) => <StatusChip status={r.active ? 'success' : 'neutral'} label={r.active ? t('common.active') : t('common.inactive')} /> },
      {
        key: 'actions',
        header: t('common.actions'),
        render: (r) => (
          <div className="flex items-center gap-2">
            <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="edit" size={16} />} onClick={() => setEditing(r)} label={t('common.edit')} />
            <ASHAButton
              variant="outline"
              fullWidth={false}
              onClick={() => handleToggle(r)}
              label={r.active ? t('super.deactivate') : t('super.activate')}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <ASHAInput
            label={t('common.search')}
            placeholder={t('super.searchUsers')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <span className="mb-1 block text-label-md text-on-surface-variant">{t('common.role')}</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls}>
            <option value="">{t('common.all')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={usersQuery.isPending}
        keyExtractor={(r) => r.id}
        pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
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
          saving={saveMutation.isPending}
        />
      ) : null}

      <CredentialsModal value={credentials} onClose={() => setCredentials(null)} />
    </div>
  )
}

function roleChip(role: Role): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (role) {
    case 'admin': return 'danger'
    case 'asha': return 'success'
    default: return 'neutral'
  }
}

function UserFormModal({
  user,
  onCancel,
  onSave,
  saving,
}: {
  user: ManagedUser | null
  onCancel: () => void
  onSave: (payload: FormValues) => void
  saving: boolean
}) {
  const { t } = useLocalization()
  const [form, setForm] = useState<FormValues>({
    id: user?.id,
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'asha',
    password: '',
    stateId: user?.stateId ?? '',
    districtId: user?.districtId ?? '',
    blockId: user?.blockId ?? '',
    phcId: user?.phcId ?? '',
    villageId: '',
    active: user?.active ?? true,
  })

  const statesQuery = useQuery({ queryKey: ['config', 'states'], queryFn: () => configService.getStates() })
  const districtsQuery = useQuery({
    queryKey: ['config', 'districts', form.stateId],
    queryFn: () => configService.getDistricts(form.stateId),
    enabled: !!form.stateId,
  })
  const blocksQuery = useQuery({
    queryKey: ['config', 'blocks', form.districtId],
    queryFn: () => configService.getBlocks(form.districtId),
    enabled: !!form.districtId,
  })
  const phcsQuery = useQuery({
    queryKey: ['config', 'phcs', form.blockId],
    queryFn: () => configService.getPHCs(form.blockId),
    enabled: !!form.blockId,
  })
  const villagesQuery = useQuery({
    queryKey: ['config', 'villages', form.phcId],
    queryFn: () => configService.getVillages(form.phcId),
    enabled: !user && form.role === 'asha' && !!form.phcId,
  })

  const nameValid = form.fullName.trim().length >= 2
  const phoneValid = form.phone.length === 10
  const passwordValid = !!user || form.password.length >= 8
  const canSave = nameValid && phoneValid && passwordValid && !saving

  return (
    <Modal title={user ? t('super.editUser') : t('super.createUser')} onCancel={onCancel}>
      <div className="space-y-4">
        <ASHAInput label={t('super.fullName')} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        <ASHAInput
          label={t('super.phoneNumber')}
          type="tel"
          maxLength={10}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          disabled={!!user}
          required
        />
        <ASHAInput label={t('super.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {!user ? (
          <ASHAInput
            label={t('common.password')}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="min 8 characters"
            required
          />
        ) : null}
        <Field label={t('common.role')}>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={selectCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
          <SearchableSelect
            label={t('super.assignState')}
            options={statesQuery.data ?? []}
            value={form.stateId}
            onChange={(id) => setForm({ ...form, stateId: id, districtId: '', blockId: '', phcId: '', villageId: '' })}
            placeholder="—"
            loading={statesQuery.isLoading}
            loadingLabel={t('common.loading')}
            emptyLabel="—"
          />
          <SearchableSelect
            label={t('super.assignDistrict')}
            options={districtsQuery.data ?? []}
            value={form.districtId}
            onChange={(id) => setForm({ ...form, districtId: id, blockId: '', phcId: '', villageId: '' })}
            placeholder="—"
            loading={districtsQuery.isLoading}
            loadingLabel={t('common.loading')}
            disabled={!form.stateId}
            disabledHint="Select a state first"
            emptyLabel="No districts"
          />
          <SearchableSelect
            label={t('super.assignBlock')}
            options={blocksQuery.data ?? []}
            value={form.blockId}
            onChange={(id) => setForm({ ...form, blockId: id, phcId: '', villageId: '' })}
            placeholder="—"
            loading={blocksQuery.isLoading}
            loadingLabel={t('common.loading')}
            disabled={!form.districtId}
            disabledHint="Select a district first"
            emptyLabel="No blocks"
          />
          <SearchableSelect
            label={t('super.assignPhc')}
            options={phcsQuery.data ?? []}
            value={form.phcId}
            onChange={(id) => setForm({ ...form, phcId: id, villageId: '' })}
            placeholder="—"
            loading={phcsQuery.isLoading}
            loadingLabel={t('common.loading')}
            disabled={!form.blockId}
            disabledHint="Select a block first"
            emptyLabel="No PHCs in this block"
          />
          {!user && form.role === 'asha' && (
            <div className="tablet:col-span-2">
              <SearchableSelect
                label={t('super.assignVillage')}
                options={villagesQuery.data ?? []}
                showCode
                value={form.villageId}
                onChange={(id) => setForm({ ...form, villageId: id })}
                placeholder="—"
                loading={villagesQuery.isLoading}
                loadingLabel={t('common.loading')}
                disabled={!form.phcId}
                disabledHint="Select a PHC first"
                emptyLabel="No villages configured for this PHC"
              />
            </div>
          )}
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
            disabled={!canSave}
            icon={<Icon name="check" size={16} />}
            onClick={() => onSave(form)}
            label={saving ? t('common.loading') : t('common.save')}
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
