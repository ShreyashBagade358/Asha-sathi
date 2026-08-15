import { ASHACard } from 'asha-design-system'
import type { ReactNode } from 'react'
import { useLocalization } from '@/hooks/useLocalization'

export interface KPICardProps {
  label: string
  value: string | number
  change?: number
  trend?: 'up' | 'down'
  accent?: 'primary' | 'tertiary' | 'secondary' | 'error'
  hint?: string
  icon?: ReactNode
}

const ACCENT_TEXT: Record<NonNullable<KPICardProps['accent']>, string> = {
  primary: 'text-primary',
  tertiary: 'text-tertiary',
  secondary: 'text-secondary',
  error: 'text-error',
}

export function KPICard({ label, value, change, trend, accent = 'primary', hint, icon }: KPICardProps) {
  const { t } = useLocalization()
  const changeColor = trend === 'down' ? 'text-error' : 'text-tertiary'
  const changeArrow = trend === 'down' ? '↓' : '↑'

  return (
    <ASHACard title={label}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[28px] font-bold leading-tight text-on-surface">{value}</p>
          <div className="mt-1 flex items-center gap-2">
            {change !== undefined ? (
              <span className={`text-label-lg ${changeColor}`}>
                {changeArrow} {Math.abs(change)}%
              </span>
            ) : null}
            {hint ? <span className="text-label-md text-on-surface-variant">{hint}</span> : null}
          </div>
        </div>
        {icon ? <div className={ACCENT_TEXT[accent]}>{icon}</div> : null}
      </div>
      <span className="sr-only">{t('kpis.performance')}</span>
    </ASHACard>
  )
}
