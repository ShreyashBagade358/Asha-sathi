/**
 * Centralized risk level styling for Expo - single source of truth.
 * Mirrors the web's lib/risk.ts
 *
 * Indigo + Teal palette: medium risk uses amber (#F59E0B), high risk uses
 * emergency red (#EF4444), low risk uses teal green (#10B981).
 */
export type RiskLevel = 'low' | 'medium' | 'high';

export const RISK_STYLES = {
  low: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container', rail: 'bg-secondary', chip: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container', icon: 'checkCircle' as const } },
  medium: { bg: 'bg-amber-light', fg: 'text-amber', rail: 'bg-amber', chip: { bg: 'bg-amber-light', fg: 'text-amber', icon: 'checkCircle' as const } },
  high: { bg: 'bg-error-container', fg: 'text-on-error-container', rail: 'bg-error', chip: { bg: 'bg-error-container', fg: 'text-on-error-container', icon: 'alert' as const } },
} as const;

export const RISK_CHIP = {
  low: { labelKey: 'asha.riskLowLabel', cls: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' as const },
  medium: { labelKey: 'asha.riskMediumLabel', cls: 'bg-amber-light text-amber', icon: 'alert' as const },
  high: { labelKey: 'asha.riskHighLabel', cls: 'bg-error-container text-on-error-container', icon: 'alert' as const },
};

export const RISK_RAIL = {
  low: 'bg-secondary',
  medium: 'bg-amber',
  high: 'bg-error',
};

export const RISK_TONE = {
  low: 'bg-secondary-container',
  medium: 'bg-amber',
  high: 'bg-error',
};

export const RISK_KEY = {
  low: 'asha.riskLowLabel',
  medium: 'asha.riskMediumLabel',
  high: 'asha.riskHighLabel',
};
