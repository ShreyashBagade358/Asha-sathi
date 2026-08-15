import { useLocalization } from '@/hooks/useLocalization'

interface LoadingSpinnerProps {
  label?: string
  fullPage?: boolean
}

export function LoadingSpinner({ label, fullPage = false }: LoadingSpinnerProps) {
  const { t } = useLocalization()
  return (
    <div
      className={`flex items-center justify-center gap-3 ${fullPage ? 'min-h-screen' : 'py-10'}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      <span className="text-body-md text-on-surface-variant">{label ?? t('common.loading')}</span>
    </div>
  )
}
