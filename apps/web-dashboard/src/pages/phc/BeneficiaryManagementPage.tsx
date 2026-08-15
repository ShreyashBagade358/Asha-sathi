import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ASHAButton, ASHACard, ASHAInput, StatusChip } from 'asha-design-system'
import { format } from 'date-fns'
import { useDebounce } from '@/hooks/useDebounce'
import { useLocalization } from '@/hooks/useLocalization'
import { beneficiaryService, type BeneficiaryListParams, type BeneficiaryStatus } from '@/services/beneficiary.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icons'
import type { Beneficiary } from '@/types'

export default function BeneficiaryManagementPage() {
  const { t } = useLocalization()
  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [abhaOnly, setAbhaOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const params: BeneficiaryListParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      village: village || undefined,
      status: status === 'all' ? undefined : (status as BeneficiaryStatus),
      hasAbha: abhaOnly ? true : undefined,
      page,
      pageSize: 10,
    }),
    [debouncedSearch, village, status, abhaOnly, page],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['beneficiaries', params],
    queryFn: () => beneficiaryService.listBeneficiaries(params),
  })

  const columns: Column<Beneficiary>[] = useMemo(
    () => [
      { key: 'name', header: t('common.name'), sortable: true, render: (r) => <span className="font-medium text-on-surface">{r.name}</span> },
      { key: 'abhaId', header: t('phc.abhaId'), render: (r) => r.abhaId ?? <span className="text-outline">—</span> },
      { key: 'village', header: t('common.village'), sortable: true },
      { key: 'phone', header: t('phc.contact') },
      { key: 'dob', header: t('phc.dob'), render: (r) => format(new Date(r.dob), 'dd MMM yyyy') },
      { key: 'isPregnant', header: t('phc.isPregnant'), render: (r) => (r.isPregnant ? <StatusChip status="success" label="Yes" /> : <span className="text-outline">—</span>) },
      { key: 'hasChild', header: t('phc.hasChild'), render: (r) => (r.hasChild ? <StatusChip status="info" label="Yes" /> : <span className="text-outline">—</span>) },
      { key: 'id', header: t('common.actions'), render: (r) => (
        <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="eye" size={16} />} onClick={() => setSelectedId(r.id)} label={t('phc.viewTimeline')} />
      )},
    ],
    [t],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('phc.beneficiaryManagementTitle')}
        subtitle={t('phc.beneficiaryManagementSubtitle')}
        breadcrumbs={[{ label: t('nav.dashboard'), to: '/phc/dashboard' }, { label: t('nav.beneficiaries') }]}
        actions={
          <ASHAButton variant="outline" fullWidth={false} icon={<Icon name="download" size={16} />} onClick={() => beneficiaryService.exportCSV(data?.items ?? [])} label={t('phc.exportBeneficiaries')} />
        }
      />

      <ASHACard title={t('phc.filters')}>
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
          <div className="desktop:col-span-2">
            <ASHAInput label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('phc.beneficiarySearch')} type="search" />
          </div>
          <ASHAInput label={t('common.village')} value={village} onChange={(e) => setVillage(e.target.value)} />
          <div>
            <span className="mb-1 block text-label-md text-on-surface-variant">{t('common.status')}</span>
            <div className="flex gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-touch w-full rounded-md border border-outline bg-surface-container-lowest px-3 text-body-md text-on-surface outline-none focus:border-primary"
              >
                <option value="all">{t('common.all')}</option>
                <option value="pregnant">{t('phc.statusPregnant')}</option>
                <option value="postnatal">{t('phc.statusPostnatal')}</option>
                <option value="child">{t('phc.statusChild')}</option>
                <option value="eligible">{t('phc.statusEligible')}</option>
              </select>
              <button
                type="button"
                onClick={() => setAbhaOnly((v) => !v)}
                className={`h-touch shrink-0 rounded-md border px-3 text-label-lg ${abhaOnly ? 'border-primary bg-primary text-on-primary' : 'border-outline text-on-surface-variant hover:bg-surface-container-low'}`}
                title={t('phc.abhaOnly')}
              >
                ABHA
              </button>
            </div>
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

      {selectedId ? (
        <BeneficiaryDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  )
}

function BeneficiaryDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useLocalization()
  const { data, isLoading } = useQuery({
    queryKey: ['beneficiary', id],
    queryFn: () => beneficiaryService.getBeneficiary(id),
  })

  return (
    <div className="fixed inset-0 z-[400] bg-black/40" role="dialog" aria-modal="true" aria-label="Beneficiary timeline" onClick={onClose}>
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-surface-container-lowest shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <h3 className="text-headline-md text-on-surface">{t('phc.viewTimeline')}</h3>
          <button type="button" aria-label={t('common.close')} onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? <EmptyState title={t('common.loading')} /> : null}
          {!isLoading && data ? (
            <div className="space-y-6">
              <div>
                <p className="text-body-lg font-bold text-on-surface">{data.beneficiary.name}</p>
                <p className="text-body-md text-on-surface-variant">
                  {data.beneficiary.village} · {data.beneficiary.phone ?? '—'}
                </p>
                <p className="text-label-md text-on-surface-variant">
                  {t('phc.abhaId')}: {data.beneficiary.abhaId ?? '—'} · {t('phc.dob')}: {format(new Date(data.beneficiary.dob), 'dd MMM yyyy')}
                </p>
              </div>

              <TimelineSection title="Pregnancies" count={data.pregnancies.length}>
                {data.pregnancies.map((p) => (
                  <TimelineItem key={p.id} title={`G${p.gravida}P${p.para}`} meta={`EDD ${format(new Date(p.edd), 'dd MMM yyyy')} · ${p.status}`}>
                    {p.highRisk ? (
                      <span className="inline-block"><StatusChip status={p.hrpLevel === 'high' ? 'danger' : 'warning'} label={`HRP ${p.hrpLevel ?? ''}`} /></span>
                    ) : (
                      <span className="inline-block"><StatusChip status="success" label="Low risk" /></span>
                    )}
                  </TimelineItem>
                ))}
              </TimelineSection>

              <TimelineSection title="ANC Visits" count={data.ancVisits.length}>
                {data.ancVisits.map((v) => (
                  <TimelineItem key={v.id} title={`Visit ${v.visitNumber}`} meta={`${format(new Date(v.date), 'dd MMM')} · GW ${v.gestationWeek} · BP ${v.bpSystolic ?? '—'}/${v.bpDiastolic ?? '—'} · Hb ${v.haemoglobin ?? '—'}`}>
                    {v.hrpFlag ? <StatusChip status="danger" label="Flagged" /> : null}
                  </TimelineItem>
                ))}
              </TimelineSection>

              <TimelineSection title="Children" count={data.children.length}>
                {data.children.map((c) => (
                  <TimelineItem key={c.id} title={c.name} meta={`${c.deliveryType} · ${c.birthWeightKg ?? '—'} kg · GW ${c.gestationalAgeWeeks ?? '—'}`}>
                    <StatusChip status={c.bornAtFacility ? 'success' : 'warning'} label={c.bornAtFacility ? 'Facility birth' : 'Home birth'} />
                  </TimelineItem>
                ))}
              </TimelineSection>

              <TimelineSection title="Immunizations" count={data.immunizations.length}>
                {data.immunizations.map((im) => (
                  <TimelineItem key={im.id} title={im.vaccineName} meta={`Due ${format(new Date(im.dueDate), 'dd MMM')}`}>
                    <StatusChip status={im.status === 'given' ? 'success' : im.status === 'overdue' ? 'danger' : 'info'} label={im.status} />
                  </TimelineItem>
                ))}
              </TimelineSection>

              {data.pregnancies.length === 0 && data.ancVisits.length === 0 && data.children.length === 0 ? (
                <EmptyState title={t('phc.timelineEmpty')} />
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function TimelineSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <div>
      <p className="mb-2 text-label-lg text-on-surface-variant">{title} · {count}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function TimelineItem({ title, meta, children }: { title: string; meta: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-outline-variant px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-md font-semibold text-on-surface">{title}</p>
        {children}
      </div>
      <p className="text-label-md text-on-surface-variant">{meta}</p>
    </div>
  )
}
