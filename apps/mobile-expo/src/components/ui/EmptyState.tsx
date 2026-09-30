import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
};

/**
 * Port of apps/web-dashboard/src/components/common/EmptyState.tsx:
 *   flex flex-col items-center justify-center gap-3 rounded-xl
 *   border border-dashed border-outline-variant bg-surface-container-lowest
 *   px-6 py-14 text-center
 *
 * The web renders its icon with the Material Symbols webfont; mobile uses the
 * Feather 'inbox' glyph, which the web passes in as the same string.
 */
export function EmptyState({ title, description, icon = 'inbox', action }: EmptyStateProps) {
  return (
    <View className="items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-6 py-14">
      <Icon name={icon} size={36} />
      <Text className="text-center font-headline-md text-headline-md text-on-surface">{title}</Text>
      {description ? <Text className="max-w-md text-center text-body-md text-on-surface-variant">{description}</Text> : null}
      {action}
    </View>
  );
}
