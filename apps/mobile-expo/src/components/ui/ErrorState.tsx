import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { colors } from '@/theme';

export type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  /** Retry pill label; web hardcodes "Retry". */
  retryLabel?: string;
};

/**
 * Port of apps/web-dashboard/src/components/common/ErrorState.tsx:
 *   flex flex-col items-center justify-center gap-3 rounded-xl
 *   border border-outline-variant bg-surface-container-lowest px-6 py-14
 *   text-center
 *   icon: error_outline 36px text-error
 *   retry: rounded-full bg-primary px-5 py-2 text-label-md font-semibold
 *          text-on-primary + 18px refresh glyph
 */
export function ErrorState({ message, onRetry, retryLabel = 'Retry' }: ErrorStateProps) {
  return (
    <View className="items-center justify-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
      <Icon name="alertCircle" size={36} color={colors.error} />
      <Text className="max-w-md text-center text-body-md text-on-surface-variant">{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          className="mt-1 flex-row items-center gap-2 rounded-full bg-primary px-5 py-2 active:scale-95"
        >
          <Icon name="refresh" size={18} color={colors.onPrimary} />
          <Text className="font-label-md text-label-md font-semibold text-on-primary">{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
