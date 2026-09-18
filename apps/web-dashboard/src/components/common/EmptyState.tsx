interface EmptyStateProps {
  title: string
  description?: string
  icon?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon = 'inbox', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
      <span className="material-symbols-outlined text-[36px] text-on-surface-variant">{icon}</span>
      <p className="text-headline-md text-on-surface">{title}</p>
      {description && <p className="max-w-md text-body-md text-on-surface-variant">{description}</p>}
      {action}
    </div>
  )
}