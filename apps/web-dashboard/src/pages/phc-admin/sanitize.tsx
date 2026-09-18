import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PhcSidebar } from '@/components/layout/PhcSidebar'
import { sanitizeService, type SanitizeAction } from '@/services/sanitize.service'
import { LoadingState } from '@/components/common/LoadingState'
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState'

interface FixAction {
  action: SanitizeAction
  label: string
  desc: string
  icon: string
  countKey: 'beneficiariesPhoneIssues' | 'beneficiariesNameIssues' | 'usersPhoneIssues' | 'usersNameIssues'
}

const FIX_ACTIONS: FixAction[] = [
  { action: 'fix_beneficiary_phones', label: 'Standardize beneficiary phones', desc: 'Normalize 10-digit mobile numbers (strip spaces, +91 prefix).', icon: 'phone_iphone', countKey: 'beneficiariesPhoneIssues' },
  { action: 'fix_beneficiary_names', label: 'Clean beneficiary names', desc: 'Collapse double spaces and trim leading/trailing whitespace.', icon: 'badge', countKey: 'beneficiariesNameIssues' },
  { action: 'fix_user_phones', label: 'Standardize user phones', desc: 'Normalize staff/ASHA phone numbers, avoiding collisions.', icon: 'smartphone', countKey: 'usersPhoneIssues' },
  { action: 'fix_user_names', label: 'Clean user names', desc: 'Collapse double spaces and trim whitespace on user accounts.', icon: 'person', countKey: 'usersNameIssues' },
]

export default function SanitizePhcAdmin() {
  const qc = useQueryClient()
  const [result, setResult] = useState<{ message: string; results: Partial<Record<SanitizeAction, number>> } | null>(null)

  const summary = useQuery({
    queryKey: ['sanitize', 'summary'],
    queryFn: () => sanitizeService.getSummary(),
  })

  const run = useMutation({
    mutationFn: (actions: SanitizeAction[]) => sanitizeService.fix(actions),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['sanitize', 'summary'] })
      qc.invalidateQueries({ queryKey: ['beneficiaries'] })
      qc.invalidateQueries({ queryKey: ['ashas'] })
    },
  })

  if (summary.isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <LoadingState label="Scanning records for hygiene issues…" />
        </main>
      </div>
    )
  }

  if (summary.isError) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface">
        <PhcSidebar />
        <main className="flex-1 ml-0 md:ml-64 p-6 pb-24 md:pb-0 overflow-y-auto">
          <ErrorState message={getErrorMessage(summary.error)} onRetry={() => summary.refetch()} />
        </main>
      </div>
    )
  }

  const s = summary.data!

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <PhcSidebar />
      <main className="flex-1 ml-0 md:ml-64 flex flex-col h-screen overflow-hidden pb-24 md:pb-0">
        <header className="h-16 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">cleaning_services</span>
              Data Sanitization
            </h2>
            <p className="text-caption text-on-surface-variant">Detect and repair data hygiene issues across records.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
              <span className="p-sm bg-primary-container text-on-primary-container rounded-lg w-fit"><span className="material-symbols-outlined">badge</span></span>
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Beneficiaries</p>
              <p className="text-headline-lg text-on-surface font-bold">{s.beneficiariesTotal.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
              <span className="p-sm bg-secondary-container text-on-secondary-container rounded-lg w-fit"><span className="material-symbols-outlined">group</span></span>
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Users / ASHA Accounts</p>
              <p className="text-headline-lg text-on-surface font-bold">{s.usersTotal.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-lowest border border-error/30 rounded-xl p-lg flex flex-col gap-sm">
              <span className="p-sm bg-error-container text-on-error-container rounded-lg w-fit"><span className="material-symbols-outlined">report</span></span>
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Records with Issues</p>
              <p className="text-headline-lg text-error font-bold">
                {s.beneficiariesPhoneIssues + s.beneficiariesNameIssues + s.usersPhoneIssues + s.usersNameIssues}
              </p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
              <span className="p-sm bg-tertiary-container text-on-tertiary-container rounded-lg w-fit"><span className="material-symbols-outlined">home_work</span></span>
              <p className="text-label-md text-on-surface-variant uppercase tracking-wide">No Household Link</p>
              <p className="text-headline-lg text-on-surface font-bold">{s.beneficiariesWithoutHousehold.toLocaleString()}</p>
              <p className="text-caption text-on-surface-variant">
                {s.beneficiariesTotal > 0 ? `${Math.round((s.beneficiariesWithoutHousehold / s.beneficiariesTotal) * 100)}% of beneficiaries` : 'No beneficiaries'}
              </p>
            </div>
          </div>

          {result && (
            <div className="bg-success-container/40 border border-success/30 rounded-xl p-md flex items-start gap-3">
              <span className="material-symbols-outlined text-success">check_circle</span>
              <div>
                <p className="text-body-md font-semibold text-on-surface">{result.message}</p>
                <p className="text-caption text-on-surface-variant">
                  {Object.entries(result.results ?? {})
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${k.replaceAll('_', ' ')}: ${n}`)
                    .join(' · ') || 'Nothing changed.'}
                </p>
              </div>
              <button onClick={() => setResult(null)} className="ml-auto text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            {FIX_ACTIONS.map((f) => {
              const count = s[f.countKey]
              const running = run.isPending && run.variables?.[0] === f.action
              return (
                <div key={f.action} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="p-sm bg-surface-container-high text-on-surface-variant rounded-lg shrink-0">
                      <span className="material-symbols-outlined">{f.icon}</span>
                    </span>
                    <div>
                      <h3 className="text-body-lg font-semibold text-on-surface">{f.label}</h3>
                      <p className="text-caption text-on-surface-variant">{f.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant/50">
                    <span className={`text-label-sm font-bold ${count > 0 ? 'text-error' : 'text-success'}`}>
                      {count > 0 ? `${count} to fix` : 'No issues found'}
                    </span>
                    <button
                      onClick={() => {
                        run.mutate([f.action])
                        setResult(null)
                      }}
                      disabled={count === 0 || run.isPending}
                      className="px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm font-semibold flex items-center gap-2 disabled:opacity-40 transition-colors hover:bg-primary/90"
                    >
                      {running ? (
                        <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                      )}
                      Fix Now
                    </button>
                  </div>
                </div>
              )
            })}

            <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex items-start gap-3">
              <span className="material-symbols-outlined text-primary mt-0.5">info</span>
              <p className="text-caption text-on-surface-variant">
                Sanitization is logged to the audit trail and only rewrites existing values — it never deletes records. Phone
                normalization skips numbers that would collide with an existing account. Records without a household link are
                reported for review but not auto-modified.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}