import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiService, type AIPrediction } from '@/services/ai.service'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { getErrorMessage } from '@/components/common/ErrorState'

type Mode = 'ncd' | 'maternal'

const MODEL_OF: Record<Mode, string> = { ncd: 'ncd_risk', maternal: 'maternal_risk' }

const LEVEL_STYLE: Record<string, string> = {
  high: 'bg-error-container text-on-error-container',
  moderate: 'bg-tertiary-container text-on-tertiary-container',
  medium: 'bg-tertiary-container text-on-tertiary-container',
  low: 'bg-secondary-container text-on-secondary-container',
}

function levelOf(prediction: AIPrediction, mode: Mode): string {
  const body = prediction.prediction ?? {}
  const raw = mode === 'ncd' ? body.overall_risk : body.risk_level
  const level = typeof raw === 'string' ? raw : ''
  return level || 'low'
}

function formatDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export interface RiskPredictionCardProps {
  /** Beneficiary whose predictions are read and stored. */
  beneficiaryId?: string
  mode: Mode
  /** Builds the feature payload from the caller's own profile data. */
  onRun: () => Promise<AIPrediction>
}

/**
 * Shows the newest stored ML risk assessment for one beneficiary and lets the
 * caller run a fresh one. Data comes from `GET /ai/predictions`; running
 * posts to `/ai/{ncd,maternal}-risk/predict`, which persists the result, so
 * the list and the run always agree.
 */
export function RiskPredictionCard({ beneficiaryId, mode, onRun }: RiskPredictionCardProps) {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()

  const predictions = useQuery({
    queryKey: ['ai', 'predictions', beneficiaryId, MODEL_OF[mode]],
    queryFn: () => aiService.listPredictions(beneficiaryId!, 50),
    enabled: Boolean(beneficiaryId),
  })

  const latest = (predictions.data ?? []).find((p) => p.modelName === MODEL_OF[mode])

  const run = useMutation({
    mutationFn: onRun,
    onSuccess: (created) => {
      queryClient.setQueryData<AIPrediction[]>(
        ['ai', 'predictions', beneficiaryId, MODEL_OF[mode]],
        (old) => [created, ...(old ?? [])],
      )
      queryClient.invalidateQueries({ queryKey: ['ai', 'predictions', beneficiaryId] })
    },
    onError: (err) => addToast('error', `${t('ai.failed')}: ${getErrorMessage(err)}`),
  })

  const level = latest ? levelOf(latest, mode) : ''
  const factors = latest?.explanation?.risk_factors ?? []

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
          </span>
          <div>
            <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {mode === 'ncd' ? t('ai.titleNcd') : t('ai.titleMaternal')}
            </h3>
            <p className="font-caption text-caption text-on-surface-variant">{t('ai.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={run.isPending || !beneficiaryId}
          className="flex h-touch-target items-center gap-2 rounded-full bg-primary px-5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-[18px] ${run.isPending ? 'animate-spin' : ''}`}>
            {run.isPending ? 'progress_activity' : 'psychology'}
          </span>
          {latest ? t('ai.rerun') : t('ai.run')}
        </button>
      </header>

      {!beneficiaryId ? (
        <p className="px-5 py-6 text-center font-body-md text-body-md text-on-surface-variant">
          {t('ai.needsBeneficiary')}
        </p>
      ) : predictions.isLoading ? (
        <p className="px-5 py-6 text-center font-body-md text-body-md text-on-surface-variant">{t('common.loading')}</p>
      ) : predictions.isError ? (
        <p className="px-5 py-6 text-center font-body-md text-body-md text-error">
          {getErrorMessage(predictions.error)}
        </p>
      ) : !latest ? (
        <div className="px-5 py-6 text-center">
          <p className="font-body-md text-body-md font-medium text-on-surface">{t('ai.none')}</p>
          <p className="mt-1 font-caption text-caption text-on-surface-variant">{t('ai.noneHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 font-label-md text-label-md font-semibold ${LEVEL_STYLE[level] ?? LEVEL_STYLE.low}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </span>
            {latest.confidence != null ? (
              <span className="font-caption text-caption text-on-surface-variant">
                {t('ai.confidence')}: {Math.round(latest.confidence * 100)}%
              </span>
            ) : null}
            <span className="font-caption text-caption text-outline">
              {formatDate(latest.createdAt)}
              {latest.modelVersion ? ` · v${latest.modelVersion}` : ''}
            </span>
          </div>

          {factors.length > 0 ? (
            <div>
              <p className="mb-2 font-caption text-caption uppercase tracking-wider text-on-surface-variant">
                {t('ai.factors')}
              </p>
              <ul className="flex flex-wrap gap-2">
                {factors.map((factor) => (
                  <li
                    key={factor}
                    className="rounded-full border border-outline-variant bg-surface-container px-3 py-1 font-caption text-caption text-on-surface"
                  >
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="font-caption text-caption text-on-surface-variant">{t('ai.disclaimer')}</p>
        </div>
      )}
    </section>
  )
}
