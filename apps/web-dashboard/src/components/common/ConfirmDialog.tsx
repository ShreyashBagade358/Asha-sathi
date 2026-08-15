import { ASHAButton, ASHACard } from 'asha-design-system'
import { useLocalization } from '@/hooks/useLocalization'
import { Icon } from '@/components/common/Icons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLocalization()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <ASHACard title={title} onClick={undefined}>
        <div className="space-y-4">
          {message ? <p className="text-body-md text-on-surface-variant">{message}</p> : null}
          <div className="flex justify-end gap-2">
            <ASHAButton variant="outline" fullWidth={false} disabled={loading} onClick={onCancel} label={cancelLabel ?? t('common.cancel')} />
            <ASHAButton
              variant={variant}
              fullWidth={false}
              loading={loading}
              onClick={(e) => {
                e.stopPropagation()
                onConfirm()
              }}
              icon={<Icon name="check" size={16} />}
              label={confirmLabel ?? t('common.confirm')}
            />
          </div>
        </div>
      </ASHACard>
    </div>
  )
}
