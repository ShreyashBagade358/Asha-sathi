/**
 * Centralized risk level styling for Expo - single source of truth.
 * Mirrors the web's lib/risk.ts
 */
export type RiskLevel = 'low' | 'medium' | 'high';

export const RISK_STYLES = {
  low: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container', rail: 'bg-secondary', chip: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container', icon: 'checkCircle' as const } },
  medium: { bg: 'bg-[#FF8C00]/15', fg: 'text-[#B34E00]', rail: 'bg-[#FF8C00]', chip: { bg: 'bg-[#FF8C00]/15', fg: 'text-[#B34E00]', icon: 'checkCircle' as const } },
  high: { bg: 'bg-error-container', fg: 'text-on-error-container', rail: 'bg-error', chip: { bg: 'bg-error-container', fg: 'text-on-error-container', icon: 'alert' as const } },
} as const;

export const RISK_CHIP = {
  low: { labelKey: 'asha.riskLowLabel', cls: 'bg-secondary-container text-on-secondary-container', icon: 'checkCircle' as const },
  medium: { labelKey: 'asha.riskMediumLabel', cls: 'bg-[#FF8C00]/15 text-[#B34E00]', icon: 'alert' as const },
  high: { labelKey: 'asha.riskHighLabel', cls: 'bg-error-container text-on-error-container', icon: 'alert' as const },
};

export const RISK_RAIL = {
  low: 'bg-secondary',
  medium: 'bg-[#FF8C00]',
  high: 'bg-error',
};

export const RISK_TONE = {
  low: 'bg-secondary-container',
  medium: 'bg-[#FF8C00]',
  high: 'bg-error',
};

export const RISK_KEY = {
  low: 'asha.riskLowLabel',
  medium: 'asha.riskMediumLabel',
  high: 'asha.riskHighLabel',
};
