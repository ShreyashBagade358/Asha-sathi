import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { referralService } from '@/services/referral.service'
import { useUIStore } from '@/stores/ui.store'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function statusLabel(status: string): string {
  if (status === 'accepted') return 'Accepted'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return 'Pending'
}

function urgencyBadge(urgency: string) {
  if (urgency === 'emergency') {
    return <span className="bg-error-container text-on-error-container font-caption text-caption px-sm py-xs rounded-full uppercase tracking-wider font-bold">Emergency</span>
  }
  if (urgency === 'urgent') {
    return <span className="bg-tertiary-container text-on-tertiary-container font-caption text-caption px-sm py-xs rounded-full uppercase tracking-wider font-bold">Urgent</span>
  }
  return <span className="bg-secondary-container text-on-secondary-container font-caption text-caption px-sm py-xs rounded-full uppercase tracking-wider font-bold">Routine</span>
}

export default function ReferralDetailsPhcAdmin() {
  const { id } = useParams<{ id: string }>()
  const { addToast } = useUIStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: referral, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['referrals', id],
    queryFn: () => referralService.getReferral(id ?? ''),
    enabled: !!id,
  })

  const acceptMutation = useMutation({
    mutationFn: () => referralService.acceptReferral(id ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', id] })
      qc.invalidateQueries({ queryKey: ['referrals'] })
      addToast('success', 'Referral accepted.')
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => referralService.completeReferral(id ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals', id] })
      qc.invalidateQueries({ queryKey: ['referrals'] })
      addToast('success', 'Referral marked as completed.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => referralService.deleteReferral(id ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referrals'] })
      addToast('success', 'Referral deleted.')
      navigate('/phc/referrals')
    },
    onError: (err) => addToast('error', getErrorMessage(err)),
  })

  const confirmDelete = () => {
    if (window.confirm('Delete this referral? This cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  const canAccept = referral?.status === 'pending'
  const canComplete = referral?.status === 'accepted'

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-6 bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
          <LoadingState label="Loading referral…" />
        </main>
      </div>
    )
  }

  if (isError || !referral) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-6 bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 p-lg md:p-xl bg-background min-h-screen pb-24 md:pb-0 overflow-y-auto flex flex-col">
        <div className="hidden md:flex justify-between items-center mb-xl border-b border-outline-variant pb-md">
          <div className="flex items-center">
            <Link className="mr-md text-on-surface-variant hover:text-primary transition-colors flex items-center" to="/phc/referrals">
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="font-label-md ml-xs">Back to Referrals</span>
            </Link>
          </div>
          <div className="flex space-x-md">
            {canAccept && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="font-label-md text-label-md px-lg py-sm rounded bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center h-[48px] disabled:opacity-50"
              >
                <span className="material-symbols-outlined mr-sm text-[20px]">check_circle</span>
                {acceptMutation.isPending ? 'Accepting...' : 'Accept Referral'}
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="font-label-md text-label-md px-lg py-sm rounded bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity flex items-center h-[48px] disabled:opacity-50"
              >
                <span className="material-symbols-outlined mr-sm text-[20px]">done_all</span>
                {completeMutation.isPending ? 'Completing...' : 'Complete Referral'}
              </button>
            )}
            <button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="font-label-md text-label-md px-lg py-sm rounded border border-error text-error hover:bg-error-container/40 transition-colors flex items-center h-[48px] disabled:opacity-50"
            >
              <span className="material-symbols-outlined mr-sm text-[20px]">delete</span>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2 space-y-lg">
            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg relative overflow-hidden flex flex-col md:flex-row gap-lg">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-secondary"></div>
              <div className="flex-1 pl-sm">
                <div className="flex justify-between items-start mb-md">
                  <div>
                    <div className="flex items-center gap-sm mb-xs">
                      <h2 className="font-display-lg text-display-lg text-on-surface">
                        {referral.beneficiaryId ? `Beneficiary ${referral.beneficiaryId.slice(0, 8)}` : 'Unknown Beneficiary'}
                      </h2>
                      {urgencyBadge(referral.urgency)}
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Referred {referral.referredAt ? formatDate(referral.referredAt) : '—'} · By {referral.referredBy || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-caption text-caption text-on-surface-variant">Referral ID</p>
                    <p className="font-headline-md text-headline-md text-primary font-mono">{referral.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-sm mt-md p-md bg-surface-container-low rounded-lg border border-outline-variant">
                  <span className="material-symbols-outlined text-tertiary-container">pending</span>
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">Current Status</p>
                    <p className="font-label-md text-label-md text-on-surface font-bold">{statusLabel(referral.status)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-md flex items-center border-b border-outline-variant pb-sm">
                <span className="material-symbols-outlined mr-sm text-primary">medical_information</span>
                Clinical Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mt-md">
                <div>
                  <p className="font-caption text-caption text-on-surface-variant mb-xs">Reason for Referral</p>
                  <p className="font-body-md text-body-md text-on-surface">{referral.reason || '—'}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant mb-xs">Destination Facility</p>
                  <p className="font-body-md text-body-md text-on-surface font-bold">{referral.toFacility || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mt-lg">
                <div>
                  <p className="font-caption text-caption text-on-surface-variant mb-xs">Referring Facility</p>
                  <p className="font-body-md text-body-md text-on-surface">{referral.fromFacility || '—'}</p>
                </div>
                <div>
                  <p className="font-caption text-caption text-on-surface-variant mb-xs">Urgency</p>
                  <p className="font-body-md text-body-md text-on-surface font-bold capitalize">{referral.urgency}</p>
                </div>
              </div>
              {referral.completedAt && (
                <div className="mt-lg">
                  <p className="font-caption text-caption text-on-surface-variant mb-xs">Completed At</p>
                  <p className="font-body-md text-body-md text-on-surface">{formatDate(referral.completedAt)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-lg">
            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm p-lg">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-lg flex items-center">
                <span className="material-symbols-outlined mr-sm text-primary">timeline</span>
                Referral Timeline
              </h3>
              <div className="relative border-l-2 border-outline-variant ml-md space-y-lg pb-sm">
                <div className="relative pl-lg">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-secondary border-2 border-surface"></div>
                  <p className="font-caption text-caption text-on-surface-variant">{formatDate(referral.referredAt)}</p>
                  <p className="font-label-md text-label-md text-on-surface font-bold">Referral Created</p>
                  <p className="font-caption text-caption text-on-surface-variant mt-xs">By {referral.referredBy || '—'}</p>
                </div>
                {referral.status === 'accepted' || referral.status === 'completed' ? (
                  <div className="relative pl-lg">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-secondary border-2 border-surface"></div>
                    <p className="font-caption text-caption text-on-surface-variant">Status</p>
                    <p className="font-label-md text-label-md text-on-surface font-bold">{statusLabel(referral.status)}</p>
                    <p className="font-caption text-caption text-on-surface-variant mt-xs">Destination: {referral.toFacility || '—'}</p>
                  </div>
                ) : (
                  <div className="relative pl-lg">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-surface border-2 border-primary"></div>
                    <p className="font-caption text-caption text-primary font-bold">Pending</p>
                    <p className="font-label-md text-label-md text-on-surface">{referral.status === 'pending' ? 'Awaiting Acceptance' : statusLabel(referral.status)}</p>
                  </div>
                )}
                {referral.completedAt && (
                  <div className="relative pl-lg">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-secondary border-2 border-surface"></div>
                    <p className="font-caption text-caption text-on-surface-variant">{formatDate(referral.completedAt)}</p>
                    <p className="font-label-md text-label-md text-on-surface font-bold">Completed</p>
                  </div>
                )}
              </div>
            </div>

            <div className="md:hidden flex flex-col space-y-sm mt-lg">
              {canAccept && (
                <button
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  className="w-full font-label-md text-label-md px-lg py-sm rounded bg-green-600 text-white h-[48px] flex justify-center items-center disabled:opacity-50"
                >
                  <span className="material-symbols-outlined mr-sm">check_circle</span>
                  {acceptMutation.isPending ? 'Accepting...' : 'Accept Referral'}
                </button>
              )}
              {canComplete && (
                <button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                  className="w-full font-label-md text-label-md px-lg py-sm rounded bg-primary-container text-on-primary-container h-[48px] flex justify-center items-center disabled:opacity-50"
                >
                  <span className="material-symbols-outlined mr-sm">done_all</span>
                  {completeMutation.isPending ? 'Completing...' : 'Complete Referral'}
                </button>
              )}
              <Link to="/phc/referrals" className="w-full font-label-md text-label-md px-lg py-sm rounded border border-outline text-on-surface-variant h-[48px] flex justify-center items-center">
                <span className="material-symbols-outlined mr-sm">arrow_back</span>
                Back to Referrals
              </Link>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="w-full font-label-md text-label-md px-lg py-sm rounded border border-error text-error h-[48px] flex justify-center items-center disabled:opacity-50"
              >
                <span className="material-symbols-outlined mr-sm">delete</span>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Referral'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}