/**
 * Centralized risk level styling - single source of truth.
 * Mirrors the Mobile app's RISK_CLS in ui/Chip.tsx.
 */
import type { IconName } from '@/components/common/Icons';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskStyle {
  bg: string;
  text: string;
  rail: string;
  chip: { bg: string; fg: string; icon: IconName };
}

export const RISK_STYLES: Record<RiskLevel, RiskStyle> = {
  low: {
    bg: 'bg-secondary-container',
    text: 'text-on-secondary-container',
    rail: 'bg-secondary',
    chip: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container', icon: 'checkCircle' },
  },
  medium: {
    bg: 'bg-[#F59E0B]/15',
    text: 'text-[#B34E00]',
    rail: 'bg-[#F59E0B]',
    chip: { bg: 'bg-[#F59E0B]/15', fg: 'text-[#B34E00]', icon: 'alert' },
  },
  high: {
    bg: 'bg-error-container',
    text: 'text-on-error-container',
    rail: 'bg-error',
    chip: { bg: 'bg-error-container', fg: 'text-on-error-container', icon: 'alert' },
  },
};

export const RISK_TONE: Record<RiskLevel, string> = {
  low: RISK_STYLES.low.bg,
  medium: RISK_STYLES.medium.bg,
  high: RISK_STYLES.high.bg,
};

export const RISK_KEY: Record<RiskLevel, string> = {
  low: 'asha.riskLowLabel',
  medium: 'asha.riskMediumLabel',
  high: 'asha.riskHighLabel',
};

export const RISK_CHIP: Record<RiskLevel, { labelKey: string; cls: string; icon: IconName }> = {
  low: { labelKey: 'asha.riskLowLabel', cls: RISK_STYLES.low.chip.bg + ' ' + RISK_STYLES.low.chip.fg, icon: RISK_STYLES.low.chip.icon },
  medium: { labelKey: 'asha.riskMediumLabel', cls: RISK_STYLES.medium.chip.bg + ' ' + RISK_STYLES.medium.chip.fg, icon: RISK_STYLES.medium.chip.icon },
  high: { labelKey: 'asha.riskHighLabel', cls: RISK_STYLES.high.chip.bg + ' ' + RISK_STYLES.high.chip.fg, icon: RISK_STYLES.high.chip.icon },
};

export const RISK_RAIL: Record<RiskLevel, string> = {
  low: RISK_STYLES.low.rail,
  medium: RISK_STYLES.medium.rail,
  high: RISK_STYLES.high.rail,
};
