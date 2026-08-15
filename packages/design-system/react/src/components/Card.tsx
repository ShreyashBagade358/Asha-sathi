import type { HTMLAttributes, ReactNode } from 'react';

export interface ASHACardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onClick?: () => void;
}

export function ASHACard({
  title,
  subtitle,
  children,
  onClick,
  className,
  ...rest
}: ASHACardProps) {
  const hasHeader = Boolean(title || subtitle);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={[
        'rounded-2xl border border-outlineVariant/40 bg-white p-4 shadow-sm',
        onClick
          ? 'cursor-pointer transition-shadow hover:shadow-md'
          : '',
        className ?? ''
      ].join(' ')}
      {...rest}
    >
      {hasHeader && (
        <div className="mb-4">
          {title && (
            <h3 className="text-[22px] font-semibold leading-7 text-onSurface">
              {title}
            </h3>
          )}
          {title && subtitle && <div className="mt-2" />}
          {subtitle && (
            <p className="text-[16px] leading-6 text-onSurfaceVariant">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
