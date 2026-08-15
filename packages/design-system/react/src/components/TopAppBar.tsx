import type { ReactNode } from 'react';

export interface ASHATopAppBarProps {
  title: string;
  onBack?: () => void;
  onHelp?: () => void;
  leading?: ReactNode;
  actions?: ReactNode[];
  className?: string;
}

function BackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ASHATopAppBar({
  title,
  onBack,
  onHelp,
  leading,
  actions = [],
  className
}: ASHATopAppBarProps) {
  return (
    <header
      className={[
        'flex h-12 items-center border-b border-surfaceContainer bg-surface',
        className ?? ''
      ].join(' ')}
    >
      {(onBack || leading) && (
        <button
          type="button"
          aria-label={onBack ? 'Back' : 'Leading'}
          onClick={onBack}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-onSurface transition-colors hover:bg-onSurface/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {leading ?? <BackIcon />}
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold leading-7 text-onSurface">
        {title}
      </h1>
      {onHelp && (
        <button
          type="button"
          aria-label="Help"
          onClick={onHelp}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-onSurface transition-colors hover:bg-onSurface/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <HelpIcon />
        </button>
      )}
      {actions.map((action, index) => (
        <div key={index} className="flex shrink-0 items-center">
          {action}
        </div>
      ))}
    </header>
  );
}
