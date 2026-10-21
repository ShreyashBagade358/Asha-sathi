import { useQuery } from '@tanstack/react-query'

import { beneficiaryService, type TimelineEvent } from '@/services/beneficiary.service'
import { Icon, type IconName } from '@/components/common/Icons'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'

type EventMeta = {
  label: string
  icon: IconName
  dot: string
  detail?: (record: Record<string, unknown>) => string
}

function s(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function n(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function join(parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' · ')
}

/**
 * Everything the ASHA records ends up here: household visits, NCD screenings,
 * conditions, referrals, ANC/PNC, immunisations, completed ASHA tasks.
 * Records come from the timeline endpoint, newest first.
 */
const META: Record<string, EventMeta> = {
  ASHATask: {
    label: 'ASHA visit',
    icon: 'users',
    dot: 'bg-primary',
    detail: (r) => join([s(r.task_type), s(r.village_name)]),
  },
  HouseholdVisitCheck: {
    label: 'Household visit',
    icon: 'mapPin',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.check_type), s(r.result) && `result: ${s(r.result)}`, s(r.notes)]),
  },
  NCDScreening: {
    label: 'Non-Communicable Disease (NCD) screening',
    icon: 'activity',
    dot: 'bg-tertiary',
    detail: (r) =>
      join([
        s(r.diabetes_risk) && `diabetes risk: ${s(r.diabetes_risk)}`,
        s(r.hypertension_risk) && `blood pressure risk: ${s(r.hypertension_risk)}`,
        n(r.cbac_score) && `CBAC score: ${n(r.cbac_score)}`,
      ]),
  },
  DiseaseCase: {
    label: 'Condition',
    icon: 'alert',
    dot: 'bg-error',
    detail: (r) => join([s(r.disease_type), s(r.status), s(r.diagnosis_method)]),
  },
  Referral: {
    label: 'Referral',
    icon: 'fileText',
    dot: 'bg-tertiary',
    detail: (r) => join([s(r.reason), s(r.referral_type), s(r.urgency) && `urgency: ${s(r.urgency)}`, s(r.status)]),
  },
  ECFollowup: {
    label: 'Family planning follow-up',
    icon: 'heart',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.method_used), r.method_changed ? 'method changed' : '']),
  },
  Pregnancy: {
    label: 'Pregnancy registered',
    icon: 'heart',
    dot: 'bg-primary',
    detail: (r) => join([s(r.status), s(r.hrp_level) && `risk: ${s(r.hrp_level)}`]),
  },
  ANCVISIT: {
    label: 'Antenatal Care (ANC) visit',
    icon: 'heart',
    dot: 'bg-primary',
    detail: (r) =>
      join([
        s(r.visit_number) && `visit ${s(r.visit_number)}`,
        n(r.bp_systolic) && n(r.bp_diastolic) ? `blood pressure ${n(r.bp_systolic)}/${n(r.bp_diastolic)}` : '',
        s(r.status),
      ]),
  },
  PNCVisit: {
    label: 'Postnatal Care (PNC) visit',
    icon: 'heart',
    dot: 'bg-primary',
    detail: (r) => join([s(r.visit_number) && `visit ${s(r.visit_number)}`, s(r.status)]),
  },
  DeliveryOutcome: {
    label: 'Delivery',
    icon: 'checkCircle',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.delivery_type), s(r.place_of_delivery), s(r.outcome)]),
  },
  Child: {
    label: 'Child registered',
    icon: 'users',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.full_name), s(r.gender)]),
  },
  Immunization: {
    label: 'Immunisation',
    icon: 'checkCircle',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.vaccine_name), s(r.dose) && `dose ${s(r.dose)}`, s(r.status)]),
  },
  HBNCVisit: {
    label: 'Home-Based Newborn Care visit',
    icon: 'mapPin',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.visit_number) && `visit ${s(r.visit_number)}`, s(r.status)]),
  },
  HBYCVisit: {
    label: 'Home-Based Young Child visit',
    icon: 'mapPin',
    dot: 'bg-secondary',
    detail: (r) => join([s(r.visit_number) && `visit ${s(r.visit_number)}`, s(r.status)]),
  },
  GrowthRecord: {
    label: 'Growth measurement',
    icon: 'activity',
    dot: 'bg-tertiary',
    detail: (r) => join([n(r.weight_kg) && `${n(r.weight_kg)} kg`, n(r.height_cm) && `${n(r.height_cm)} cm`]),
  },
  DeathReport: {
    label: 'Death report',
    icon: 'alert',
    dot: 'bg-error',
    detail: (r) => join([s(r.cause), s(r.place)]),
  },
}

function formatDate(iso: string): string {
  // Date-only strings parse as UTC midnight; anchor at local noon so the
  // calendar day never shifts backwards.
  const parsed = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The patient's full visit + check-up history, newest first.
 *
 * Shared by the patient portal, the ASHA worker's patient page, and the PHC
 * admin's beneficiary details — all fed by the same timeline endpoint.
 * Wrap it in whatever card chrome the host page uses.
 */
export function PatientHistoryTimeline({
  beneficiaryId,
  title,
}: {
  beneficiaryId: string
  title?: string
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['patient-timeline', beneficiaryId],
    queryFn: () => beneficiaryService.getTimeline(beneficiaryId),
    enabled: Boolean(beneficiaryId),
    staleTime: 30_000,
  })

  if (isLoading) return <LoadingState label="Loading history…" />
  if (isError) return <ErrorState message={getErrorMessage(error)} />

  const events = [...(data ?? [])].reverse()

  return (
    <div>
      {title ? (
        <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
          <Icon name="fileText" size={20} className="text-primary" />
          {title}
        </h3>
      ) : null}

      {events.length === 0 ? (
        <EmptyState title="No history yet" description="Visits and check-ups will appear here once recorded." />
      ) : (
        <ol className="flex flex-col gap-3">
          {events.map((event: TimelineEvent, i: number) => {
            const meta = META[event.type]
            const label = meta?.label ?? event.type
            const detail = meta?.detail?.(event.record) ?? ''
            const photoUrl = event.type === 'HouseholdVisitCheck' ? (() => {
    const raw = (event.record as Record<string, unknown>).photo_url as string | undefined;
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      return raw;
    }
  })() : undefined
            return (
              <li
                key={`${event.type}-${event.date}-${i}`}
                className="flex flex-col gap-2 rounded-lg border border-outline-variant/50 bg-surface-container p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta?.dot ?? 'bg-outline'}`}
                    aria-hidden
                  />
                  <Icon
                    name={meta?.icon ?? 'fileText'}
                    size={18}
                    className="mt-0.5 shrink-0 text-on-surface-variant"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{label}</p>
                      <p className="font-caption text-caption text-on-surface-variant">{formatDate(event.date)}</p>
                    </div>
                    {detail ? (
                      <p className="mt-0.5 break-words font-caption text-caption text-on-surface-variant">{detail}</p>
                    ) : null}
                  </div>
                </div>
                {photoUrl ? (
                  <div className="ml-8 flex gap-2">
                    <img
                      src={photoUrl}
                      alt={`${label} photo`}
                      className="w-24 h-24 object-cover rounded-lg border border-outline-variant"
                      loading="lazy"
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
