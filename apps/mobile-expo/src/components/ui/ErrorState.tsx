import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

export type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  /** Retry pill label; defaults to t('common.retry'). */
  retryLabel?: string;
};

/**
 * Port of apps/web-dashboard/src/components/common/ErrorState.tsx:
 *   flex flex-col items-center justify-center gap-3
 *   border border-outline-variant bg-surface-container-lowest px-6 py-14
 *   text-center
 *   icon: error_outline 36px text-error
 *   retry: rounded-full bg-primary px-5 py-2 text-label-md font-semibold
 *          text-on-primary + 18px refresh glyph
 *
 * Two deliberate deviations from the web original: the shell is rounded-2xl +
 * shadow-card (the web uses rounded-xl with no shadow) so the block sits in
 * the exact footprint EmptyState renders when the same screen swaps between
 * "loading", "empty" and "error", and the retry pill carries min-h-11 so its
 * hit area clears the 44pt target the web's py-2 button does not.
 */
export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
  const { t } = useLocalization();
  const label = retryLabel ?? t('common.retry');

  return (
    <View className="items-center justify-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest px-6 py-14 text-center shadow-card">
      <Icon name="alertCircle" size={36} color={colors.error} />
      <Text className="max-w-md text-center text-body-md text-on-surface-variant">{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onRetry}
          className="mt-1 min-h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 active:scale-95"
        >
          <Icon name="refresh" size={18} color={colors.onPrimary} />
          <Text className="font-label-md text-label-md font-semibold text-on-primary">{label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
