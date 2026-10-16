import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { cx } from '@/cx';
import { shadow } from '@/theme';

export type RiskLevel = 'low' | 'medium' | 'high' | 'none';

export type RiskStripProps = {
  risk: RiskLevel;
  children: ReactNode;
  /** Content padding variant: 'md' = p-4 pl-5, 'lg' = p-5 pl-8 (web's two recipes). */
  variant?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const RISK_CLS: Record<RiskLevel, string> = {
  high: 'bg-error',
  medium: 'bg-amber',
  low: 'bg-secondary',
  none: 'bg-primary',
};

/**
 * The risk-railed card used by PatientDetailsAshaSathi and
 * AshaWorkerHomeAshaSathi:
 *   relative overflow-hidden rounded-2xl border border-outline-variant/40
 *   bg-surface-container-lowest shadow-card
 * with an absolute w-2 rail down the left edge (bg-error / bg-amber /
 * bg-secondary, web uses a bare card for 'none' so it falls back to primary).
 */
export function RiskStrip({ risk, children, variant = 'md', style }: RiskStripProps) {
  return (
    <View
      className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest"
      style={[shadow.card, style]}
    >
      <View className={cx('absolute bottom-0 left-0 top-0 w-2', RISK_CLS[risk])} />
      <View className={variant === 'lg' ? 'p-5 pl-8' : 'p-4 pl-5'}>{children}</View>
    </View>
  );
}
