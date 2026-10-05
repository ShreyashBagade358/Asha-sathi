import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: IconName;
  /** Custom CTA node; takes precedence over `actionLabel`. */
  action?: ReactNode;
  /** Renders the primary pill CTA. Pair with `onActionPress`. */
  actionLabel?: string;
  onActionPress?: () => void;
};

/**
 * Port of the web's empty blocks (TasksAshaSathi / FollowUpAshaSathi):
 *   flex flex-col items-center justify-center gap-3 rounded-2xl
 *   border border-outline-variant/40 bg-surface-container-lowest
 *   px-6 py-14 text-center shadow-card
 *
 * The web draws its icon with the Material Symbols webfont; mobile uses the
 * Feather 'inbox' glyph, which the web passes in as the same string.
 */
export function EmptyState({ title, description, icon = 'inbox', action, actionLabel, onActionPress }: EmptyStateProps) {
  return (
    <View className="items-center justify-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-6 py-14 text-center shadow-card">
      <Icon name={icon} size={36} />
      <Text className="text-center font-headline-md text-headline-md text-on-surface">{title}</Text>
      {description ? <Text className="max-w-md text-center text-body-md text-on-surface-variant">{description}</Text> : null}
      {action ?? (actionLabel && onActionPress ? <Button label={actionLabel} shape="pill" onPress={onActionPress} /> : null)}
    </View>
  );
}
