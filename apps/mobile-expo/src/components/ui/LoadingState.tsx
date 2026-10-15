import { ActivityIndicator, Text, View } from 'react-native';

import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

export type LoadingStateProps = {
  /** Announced while the spinner runs; defaults to t('common.loading'). */
  label?: string;
  /** Merged into the shell's own classes (same rule as Button/TextField). */
  className?: string;
};

/**
 * The missing third state next to EmptyState and ErrorState.
 *
 * Screens that need a busy block were rendering
 * `<EmptyState icon="inbox" title={t('common.loading')} />` - an empty-tray
 * glyph standing in for work in progress. This renders the same shell
 * (rounded-2xl border border-outline-variant/40 bg-surface-container-lowest
 * px-6 py-14 shadow-card) so a screen can swap loading -> empty -> error
 * in place without the card jumping, with a real spinner instead of the
 * misleading icon.
 */
export function LoadingState({ label, className }: LoadingStateProps) {
  const { t } = useLocalization();
  const text = label ?? t('common.loading');

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={text}
      className={cx(
        'items-center justify-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-6 py-14 shadow-card',
        className,
      )}
    >
      <ActivityIndicator size="small" color={colors.primary} />
      <Text className="text-center font-headline-md text-headline-md text-on-surface">{text}</Text>
    </View>
  );
}
