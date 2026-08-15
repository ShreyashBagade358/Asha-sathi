import type { ReactNode } from 'react';

export interface ASHASidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export interface ASHASidebarProps {
  items: ASHASidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  footer?: ReactNode;
  className?: string;
}

export function ASHASidebar({
  items,
  activeId,
  onSelect,
  footer,
  className
}: ASHASidebarProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className={[
        'flex h-full w-64 flex-col gap-1 border-r border-outlineVariant/40 bg-surface p-3',
        className ?? ''
      ].join(' ')}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              item.onClick?.();
              onSelect?.(item.id);
            }}
            className={[
              'flex min-h-12 items-center gap-3 rounded-lg px-4 text-left text-[16px] leading-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isActive
                ? 'bg-primaryContainer font-semibold text-onPrimaryContainer'
                : 'text-onSurfaceVariant hover:bg-surfaceContainerHigh'
            ].join(' ')}
          >
            {item.icon && (
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center"
                aria-hidden="true"
              >
                {item.icon}
              </span>
            )}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </nav>
  );
}
