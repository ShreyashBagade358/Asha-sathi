import { useRef, useState } from 'react'
import { useLocalization } from '@/hooks/useLocalization'
import { useUIStore } from '@/stores/ui.store'
import { Icon } from '@/components/common/Icons'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Unsupported image type. Use JPG, PNG or WebP.'
  if (file.size > MAX_IMAGE_BYTES) return 'Photo is too large. Maximum size is 5 MB.'
  return null
}

export interface PhotoCaptureProps {
  /** Current photos array */
  photos: string[]
  /** Callback when photos change */
  onPhotosChange: (photos: string[]) => void
  /** Maximum number of photos allowed */
  maxPhotos?: number
  /** Label for the capture area */
  label?: string
  /** Optional hint text */
  hint?: string
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export function PhotoCapture({
  photos,
  onPhotosChange,
  maxPhotos = 5,
  label,
  hint,
  size = 'md',
}: PhotoCaptureProps) {
  const { t } = useLocalization()
  const { addToast } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [localUrls, setLocalUrls] = useState<string[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const boxCls = {
    xs: 'w-12 h-12',
    sm: 'w-20 h-20',
    md: 'w-28 h-28',
    lg: 'w-32 h-32',
  }[size]

  const iconCls = {
    xs: 'text-[16px]',
    sm: 'text-[20px]',
    md: 'text-[28px]',
    lg: 'text-[32px]',
  }[size]

  const handleFiles = async (files: FileList) => {
    if (photos.length + files.length > maxPhotos) {
      addToast('error', t('photo.maxLimit', { max: maxPhotos }))
      return
    }

    const validFiles: File[] = []
    for (const file of Array.from(files)) {
      const problem = validateImageFile(file)
      if (problem) {
        addToast('error', problem)
      } else {
        validFiles.push(file)
      }
    }

    if (validFiles.length === 0) return

    // Store local blob URLs immediately - parent component handles actual upload
    const newUrls = validFiles.map((file) => URL.createObjectURL(file))
    onPhotosChange([...photos, ...newUrls])
    addToast('success', t('photo.added'))
  }

  const openCamera = () => {
    cameraInputRef.current?.click()
    setShowMenu(false)
  }

  const openGallery = () => {
    fileInputRef.current?.click()
    setShowMenu(false)
  }

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    onPhotosChange(newPhotos)
    setLocalUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const allPhotos = [...photos, ...localUrls]

  // Close menu when clicking outside
  const handleClickOutside = (e: React.MouseEvent<HTMLDivElement>) => {
    if (menuButtonRef.current && !menuButtonRef.current.contains(e.target as Node)) {
      setShowMenu(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {allPhotos.map((src, index) => (
          <div key={index} className={`relative ${boxCls}`}>
            <img
              src={src}
              alt={`${t('photo.photo')} ${index + 1}`}
              className="h-full w-full object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
              aria-label={t('photo.remove')}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}

        {allPhotos.length < maxPhotos && (
          <div className="relative flex flex-col gap-1">
            {allPhotos.length === 0 && (
              <>
                {label && <span className="font-label-md text-label-md font-semibold text-on-surface">{label}</span>}
                {hint && <span className="font-caption text-caption text-on-surface-variant">{hint}</span>}
              </>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`${boxCls} flex items-center justify-center rounded-xl bg-transparent transition-colors hover:bg-surface-container-high`}
              aria-label={t('photo.add')}
              aria-expanded={showMenu}
              aria-haspopup="menu"
            >
              <Icon name="camera" size={iconCls === 'text-[20px]' ? 20 : iconCls === 'text-[28px]' ? 28 : 32} className="text-on-surface-variant" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={handleClickOutside}
                  aria-hidden="true"
                />
                <div className="absolute bottom-full left-0 mb-2 z-50 rounded-lg border border-outline bg-surface-container shadow-lg py-1 px-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={openCamera}
                      className="flex items-center gap-2 px-3 py-2 font-body-md text-body-md text-on-surface hover:bg-surface-container-high rounded-lg whitespace-nowrap"
                    >
                      <Icon name="camera" size={20} className="text-primary" />
                      {t('photo.takePhoto')}
                    </button>
                    <button
                      type="button"
                      onClick={openGallery}
                      className="flex items-center gap-2 px-3 py-2 font-body-md text-body-md text-on-surface hover:bg-surface-container-high rounded-lg whitespace-nowrap"
                    >
                      <Icon name="image" size={20} className="text-primary" />
                      {t('photo.uploadGallery')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files
            if (files) handleFiles(files)
            e.target.value = ''
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files
            if (files) handleFiles(files)
            e.target.value = ''
          }}
        />
      </div>

      {allPhotos.length > 0 && (
        <span className="font-caption text-caption text-on-surface-variant">
          {allPhotos.length}/{maxPhotos} {t('photo.photosAdded')}
        </span>
      )}
    </div>
  )
}