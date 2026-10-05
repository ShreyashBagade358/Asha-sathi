import { useEffect, useRef, useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'

/** Mirrors `app/services/images.py` so bad files never reach the server. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Unsupported image type. Use JPG, PNG or WebP.'
  if (file.size > MAX_IMAGE_BYTES) return 'Photo is too large. Maximum size is 5 MB.'
  return null
}

export interface PhotoUploadFieldProps {
  /** Locally chosen file, held until the parent has an id to upload against. */
  file: File | null
  onFileChange: (file: File | null) => void
  /** Existing server-hosted photo, shown until a new file replaces it. */
  previewSrc?: string
  /** Return a user-facing message to surface (toast/inline). */
  onError?: (message: string) => void
  size?: 'md' | 'lg'
}

/**
 * Circular photo picker used by the create forms. The backend only accepts a
 * photo once the entity exists (`POST /users/{id}/avatar`,
 * `POST /beneficiaries/{id}/photo`), so this field hands the `File` up to the
 * caller instead of uploading on change.
 */
export function PhotoUploadField({ file, onFileChange, previewSrc, onError, size = 'lg' }: PhotoUploadFieldProps) {
  const { t } = useLocalization()
  const inputRef = useRef<HTMLInputElement>(null)
  const [localUrl, setLocalUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setLocalUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setLocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = localUrl ?? previewSrc
  const boxCls = size === 'lg' ? 'w-32 h-32' : 'w-20 h-20'
  const iconCls = size === 'lg' ? 'text-[32px]' : 'text-[22px]'

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    const problem = validateImageFile(chosen)
    if (problem) {
      onError?.(problem)
      return
    }
    onFileChange(chosen)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={t('photo.change')}
        className={`${boxCls} group relative overflow-hidden rounded-full border-2 border-dashed border-outline bg-surface-container transition-colors hover:border-primary`}
      >
        {src ? (
          <img src={src} alt={t('photo.change')} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant transition-colors group-hover:text-primary">
            <span className={`material-symbols-outlined ${iconCls}`}>add_a_photo</span>
            {size === 'lg' && <span className="text-caption">{t('photo.upload')}</span>}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-caption text-white opacity-0 transition-opacity group-hover:opacity-100">
          {src ? t('photo.change') : t('photo.upload')}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={pick}
      />

      <div className="flex items-center gap-2">
        <span className="text-caption text-on-surface-variant">{t('photo.hint')}</span>
        {file && (
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="text-caption font-semibold text-error hover:underline"
          >
            {t('photo.remove')}
          </button>
        )}
      </div>
    </div>
  )
}
