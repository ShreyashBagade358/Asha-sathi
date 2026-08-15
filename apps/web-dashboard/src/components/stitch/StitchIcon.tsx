interface StitchIconProps {
  name: string
  filled?: boolean
  size?: number
  className?: string
  weight?: 'normal' | 'fill'
  'aria-hidden'?: boolean
}

export function StitchIcon({ name, filled, size, className, weight, 'aria-hidden': ariaHidden = true }: StitchIconProps) {
  const fontVariationSettings = weight === 'fill' || filled ? "'FILL' 1" : undefined
  return (
    <span
      aria-hidden={ariaHidden}
      className={`material-symbols-outlined ${className ?? ''}`}
      style={{ ...(size !== undefined ? { fontSize: size } : {}), ...(fontVariationSettings ? { fontVariationSettings } : {}) }}
    >
      {name}
    </span>
  )
}
