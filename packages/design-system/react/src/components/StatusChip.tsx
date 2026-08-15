export type StatusChipVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'neutral'
  | 'info'
  | 'users'
  | 'shield'
  | 'checkCircle'
  | 'edit'
  | 'trash'
  | 'download'
  | 'settings';

export interface StatusChipProps {
  status: StatusChipVariant;
  label: string;
  className?: string;
}

const variantClasses: Record<StatusChipVariant, string> = {
  success: 'bg-tertiaryContainer text-onTertiaryContainer',
  danger: 'bg-errorContainer text-onErrorContainer',
  warning: 'bg-secondaryContainer text-onSecondaryContainer',
  neutral: 'bg-surfaceContainerHighest text-onSurfaceVariant',
  info: 'bg-primaryContainer text-onPrimaryContainer',
  users: 'bg-primaryContainer text-onPrimaryContainer',
  shield: 'bg-primaryContainer text-onPrimaryContainer',
  checkCircle: 'bg-tertiaryContainer text-onTertiaryContainer',
  edit: 'bg-secondaryContainer text-onSecondaryContainer',
  trash: 'bg-errorContainer text-onErrorContainer',
  download: 'bg-surfaceContainerHighest text-onSurfaceVariant',
  settings: 'bg-surfaceContainerHighest text-onSurfaceVariant'
};

export function StatusChip({ status, label, className }: StatusChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] leading-4 font-medium',
        variantClasses[status],
        className ?? ''
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-current"
      />
      {label}
    </span>
  );
}
