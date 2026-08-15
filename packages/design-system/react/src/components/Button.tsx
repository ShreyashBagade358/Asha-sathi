import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ASHAButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

export interface ASHAButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  variant?: ASHAButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
}

const variantClasses: Record<ASHAButtonVariant, string> = {
  primary: 'bg-primary text-onPrimary hover:bg-primary/90',
  secondary: 'bg-secondary text-onSecondary hover:bg-secondary/90',
  outline:
    'bg-transparent border border-outline text-primary hover:bg-primary/5',
  danger: 'bg-error text-onError hover:bg-error/90'
};

export function ASHAButton({
  label,
  variant = 'primary',
  icon,
  fullWidth = true,
  loading = false,
  disabled = false,
  height = 56,
  className,
  type = 'button',
  ...rest
}: ASHAButtonProps) {
  const isDisabled = disabled || loading;
  const minHeight = Math.max(height, 48);

  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-full px-6 font-medium select-none transition-colors',
    variantClasses[variant],
    fullWidth ? 'w-full' : '',
    isDisabled
      ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
      : 'active:scale-[0.99]',
    className ?? ''
  ].join(' ');

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={classes}
      style={{ minHeight }}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      <span>{label}</span>
    </button>
  );
}
