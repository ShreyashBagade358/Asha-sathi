import { useMemo, useState } from 'react'
import { ASHACard, ASHAInput, StatusChip, type StatusChipVariant } from 'asha-design-system'
import { format } from 'date-fns'
import { useLocalization } from '@/hooks/useLocalization'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { Icon } from '@/components/common/Icons'
import type { AuditLogEntry } from '@/types'

const ACTORS = ['R. Verma', 'S. Mishra', 'A. Sinha', 'D. Kumar', 'K. Shah']
const RESOURCES = ['user', 'phc', 'beneficiary', 'asha', 'config', 'report', 'policy']

function makeLogs(): AuditLogEntry[] {
  return Array.from({ length: 24 }).map((_, i) => {
    const action = (['login', 'logout', 'create', 'update', 'delete', 'export', 'config_change', 'policy_change', 'user_management'] as const)[i % 9]
    return {
      id: `log-${i + 1}`,
      timestamp: new Date(Date.now() - i * 7 * 36e5).toISOString(),
      actorId: `u-${(i % 5) + 1}`,
      actorName: ACTORS[i % ACTORS.length],
      actorRole: (['state_admin', 'super_admin', 'dpm', 'moic', 'bpm'] as const)[i % 5],
      action,
      resource: RESOURCES[i % RESOURCES.length],
      resourceId: i % 3 === 0 ? `res-${100 + i}` : undefined,
      details: `${action} on ${RESOURCES[i % RESOURCES.length]}`,
      ip: `10.20.${i % 4}.${10 + i}`,
      status: i % 7 === 0 ? 'denied' : i % 11 === 0 ? 'error' : 'success',
    }
  })
}

const ACTION_STATUS: Record<AuditLogEntry['status'], StatusChipVariant> = {
  success: 'success',
  denied: 'warning',
  error: 'danger',
}

const ACTION_ICONS: Record<AuditLogEntry['action'], 'checkCircle' | 'shield' | 'edit' | 'trash' | 'download' | 'settings' | 'users'> = {
  login: 'shield',
  logout: 'shield',
  create: 'checkCircle',
  update: 'edit',
  delete: 'trash',
  export: 'download',
  config_change: 'settings',
  policy_change: 'settings',
  user_management: 'users',
}

export default function AuditLogsPage() {
  const { t } = useLocalization()
  const [search, setSearch] = useState('')
  const [actor, setActor] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const logs = useMemo(() => makeLogs(), [])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actor && l.actorName !== actor) return false
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!l.details.toLowerCase().includes(q) && !l.resource.toLowerCase().includes(q) && !l.actorName.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [logs, actor, statusFilter, search])

  const columns: Column<AuditLogEntry>[] = useMemo(
    () => [
      {
        key: 'timestamp',
        header: t('common.date'),
        sortable: true,
        render: (r) => (
          <span className="whitespace-nowrap font-medium text-on-surface">
            {format(new Date(r.timestamp), 'dd MMM yyyy')}
            <span className="block text-label-md font-normal text-on-surface-variant">{format(new Date(r.timestamp), 'HH:mm:ss')}</span>
          </span>
        ),
      },
      { key: 'actorName', header: t('state.actor'), sortable: true, render: (r) => (
        <span className="font-medium text-on-surface">{r.actorName}<span className="block text-label-md text-on-surface-variant">{r.actorRole.replace('_', ' ')}</span></span>
      )},
      { key: 'action', header: t('state.action'), render: (r) => (
        <span className="inline-flex items-center gap-1.5 capitalize text-on-surface"><Icon name={ACTION_ICONS[r.action]} size={15} className="text-primary" />{r.action.replace('_', ' ')}</span>
      )},
      { key: 'resource', header: t('state.resource'), render: (r) => (
        <span className="font-mono text-label-md">{r.resource}{r.resourceId ? `/${r.resourceId}` : ''}</span>
      )},
      { key: 'details', header: t('state.details') },
      { key: 'ip', header: t('state.ipAddress') },
      { key: 'status', header: t('common.status'), render: (r) => <StatusChip status={ACTION_STATUS[r.status]} label={r.status} /> },
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.auditLogs')}
        subtitle={t('state.auditLogsSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/state/dashboard' }, { label: t('nav.auditLogs') }]}
      />

      <ASHACard title={t('common.filterBy')}>
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
          <ASHAInput label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} type="search" />
          <ASHAInput label={t('state.actor')} value={actor} onChange={(e) => setActor(e.target.value)} placeholder="R. Verma" />
          <div>
            <span className="mb-1 block text-label-md text-on-surface-variant">{t('common.status')}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-touch w-full rounded-md border border-outline bg-surface-container-lowest px-3 text-body-md text-on-surface outline-none focus:border-primary"
            >
              <option value="all">{t('common.all')}</option>
              <option value="success">success</option>
              <option value="denied">denied</option>
              <option value="error">error</option>
            </select>
          </div>
        </div>
      </ASHACard>

      <DataTable
        columns={columns}
        data={filtered.slice((page - 1) * 10, page * 10)}
        loading={false}
        keyExtractor={(r) => r.id}
        pagination={{ page, pageSize: 10, total: filtered.length, onPageChange: setPage }}
      />
    </div>
  )
}
