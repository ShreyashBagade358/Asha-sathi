import type { ReactNode } from 'react';
import { ASHAButton } from './Button';

export type ErrorScreenType =
  | 'network'
  | 'sessionExpired'
  | 'dataNotFound'
  | 'notFound404'
  | 'maintenance'
  | 'syncFailed'
  | 'serverError500';

export interface ErrorScreenConfig {
  icon: ReactNode;
  headline: string;
  message: string;
  primaryLabel: string;
  secondaryLabel: string;
}

function ErrorIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const wifiOffIcon = (
  <ErrorIcon>
    <path d="M1 1l22 22" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <path d="M12 20h.01" />
  </ErrorIcon>
);

const sessionExpiredIcon = (
  <ErrorIcon>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </ErrorIcon>
);

const noDataIcon = (
  <ErrorIcon>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <path d="M2 2l20 20" />
  </ErrorIcon>
);

const pageNotFoundIcon = (
  <ErrorIcon>
    <path d="M9 17H7A5 5 0 0 1 7 7" />
    <path d="M15 7h2a5 5 0 0 1 4 8" />
    <path d="M1 1l22 22" />
    <path d="M8 12h4" />
  </ErrorIcon>
);

const maintenanceIcon = (
  <ErrorIcon>
    <path d="M15 6v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a1 1 0 0 1 1-1h2" />
    <path d="M17.07 13.93 20 17a2 2 0 0 0 3-3l-3.93-2.93" />
    <path d="M11.07 12.93 15 17" />
    <path d="M9 1v4" />
    <path d="M2 17h12" />
    <path d="M20 2v4" />
  </ErrorIcon>
);

const syncFailedIcon = (
  <ErrorIcon>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 7 17 7" />
    <path d="M12 10v4" />
    <path d="M12 18h.01" />
  </ErrorIcon>
);

const serverErrorIcon = (
  <ErrorIcon>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </ErrorIcon>
);

export const errorScreenConfigs: Record<ErrorScreenType, ErrorScreenConfig> = {
  network: {
    icon: wifiOffIcon,
    headline: 'No Internet Connection',
    message: 'You appear to be offline. Check your connection and try again.',
    primaryLabel: 'Try Again',
    secondaryLabel: 'Work Offline'
  },
  sessionExpired: {
    icon: sessionExpiredIcon,
    headline: 'Session Expired',
    message: 'Your session has ended. Please log in again to continue.',
    primaryLabel: 'Log In Again',
    secondaryLabel: 'Go to Login'
  },
  dataNotFound: {
    icon: noDataIcon,
    headline: 'No Data Found',
    message: 'We could not find any records here. Try clearing your filters.',
    primaryLabel: 'Clear Filters',
    secondaryLabel: 'Go Back'
  },
  notFound404: {
    icon: pageNotFoundIcon,
    headline: 'Page Not Found',
    message:
      'The page you are looking for does not exist or has been moved.',
    primaryLabel: 'Go to Home',
    secondaryLabel: 'Go Back'
  },
  maintenance: {
    icon: maintenanceIcon,
    headline: 'Under Maintenance',
    message: 'We are making some improvements. Please check back shortly.',
    primaryLabel: 'Refresh',
    secondaryLabel: 'Back to Home'
  },
  syncFailed: {
    icon: syncFailedIcon,
    headline: 'Sync Failed',
    message:
      'We could not sync your data. Please check your connection and try again.',
    primaryLabel: 'Retry Sync',
    secondaryLabel: 'Work Offline'
  },
  serverError500: {
    icon: serverErrorIcon,
    headline: 'Server Error',
    message:
      'Something went wrong on our end. Please try again in a few minutes.',
    primaryLabel: 'Try Again',
    secondaryLabel: 'Back to Home'
  }
};

export interface ASHAErrorScreenProps {
  type: ErrorScreenType;
  onPrimary?: () => void;
  onSecondary?: () => void;
  className?: string;
}

export function ASHAErrorScreen({
  type,
  onPrimary,
  onSecondary,
  className
}: ASHAErrorScreenProps) {
  const config = errorScreenConfigs[type];

  return (
    <div
      className={[
        'flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-10',
        className ?? ''
      ].join(' ')}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surfaceContainerHighest text-onSurfaceVariant">
          {config.icon}
        </div>
        <div className="text-center">
          <h2 className="text-[30px] font-bold leading-[38px] tracking-tight text-onSurface">
            {config.headline}
          </h2>
          <p className="mt-2 text-[16px] leading-6 text-onSurfaceVariant">
            {config.message}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <ASHAButton label={config.primaryLabel} onClick={onPrimary} />
          <ASHAButton
            label={config.secondaryLabel}
            variant="outline"
            onClick={onSecondary}
          />
        </div>
      </div>
    </div>
  );
}

export function buildErrorScreen(
  type: ErrorScreenType,
  handlers?: {
    onPrimary?: () => void;
    onSecondary?: () => void;
  }
) {
  return (
    <ASHAErrorScreen
      type={type}
      onPrimary={handlers?.onPrimary}
      onSecondary={handlers?.onSecondary}
    />
  );
}
