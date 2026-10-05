import { useEffect, useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'

export interface CredentialsValue {
  name: string
  phone: string
  password: string
}

/**
 * One-time credential handover dialog.
 *
 * `POST /users` and `POST /ashas` return the plaintext password exactly once —
 * it is stored as a bcrypt hash, so this is the only screen where it can be
 * shown. Callers pass whatever the create call returned.
 */
export function CredentialsModal({ value, onClose }: { value: CredentialsValue | null; onClose: () => void }) {
  const { t } = useLocalization()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [value?.password])

  useEffect(() => {
    if (!value) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [value, onClose])

  if (!value) return null

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(value.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-label={t('credentials.title')}>
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl">
        <div className="flex items-center gap-3 border-b border-outline-variant px-5 py-4">
          <span className="material-symbols-outlined text-primary text-[20px]">password</span>
          <div>
            <h3 className="text-headline-md font-semibold text-on-surface">{t('credentials.title')}</h3>
            <p className="text-caption text-on-surface-variant">{t('credentials.oneTime')}</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3 rounded-lg border border-error/40 bg-error-container/40 p-3">
            <span className="material-symbols-outlined text-error text-[20px]">warning</span>
            <p className="text-caption text-on-surface">{t('credentials.warning')}</p>
          </div>

          <div className="space-y-3">
            <CredentialRow label={t('common.name')} value={value.name} />
            <CredentialRow label={t('credentials.signinId')} value={value.phone} />
            <div className="flex flex-col gap-1">
              <span className="text-label-md text-on-surface-variant">{t('common.password')}</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all break-all rounded-lg border border-outline bg-surface-container px-3 py-2.5 font-mono text-body-md text-on-surface">
                  {value.password}
                </code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline text-on-surface-variant transition-colors hover:bg-surface-container-high"
                  aria-label={t('credentials.copy')}
                  title={t('credentials.copy')}
                >
                  <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                </button>
              </div>
              {copied && <p className="text-caption text-success">{t('credentials.copied')}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-outline-variant px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            {t('credentials.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <div className="rounded-lg border border-outline bg-surface-container px-3 py-2.5 text-body-md text-on-surface select-all">
        {value}
      </div>
    </div>
  )
}
