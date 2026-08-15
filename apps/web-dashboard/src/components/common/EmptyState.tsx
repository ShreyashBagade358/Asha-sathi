import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="text-outline">{icon}</div> : <div className="h-10 w-10 rounded-full bg-surface-container" />}
      <p className="text-body-md font-semibold text-on-surface">{title}</p>
      {description ? <p className="max-w-sm text-body-md text-on-surface-variant">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
