import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { shadow } from '@/theme';

export type ModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 'sheet' (default) pins to the bottom, 'centered' floats in the middle. */
  variant?: 'sheet' | 'centered';
  /** Hide the header's x affordance (e.g. a form that owns its own close). */
  hideClose?: boolean;
};

/**
 * Bottom-sheet shell matching the web modal recipe: backdrop bg-black/40,
 * panel rounded-t-2xl bg-surface-container-lowest p-5 shadow-modal with a
 * header row (title + close) above the caller's content.
 *
 * The backdrop tap and Android's hardware back (onRequestClose) both dismiss,
 * and the sheet's bottom padding folds in the home-indicator inset so content
 * clears it.
 */
export function Modal({ visible, onClose, title, children, variant = 'sheet', hideClose = false }: ModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLocalization();
  const isSheet = variant === 'sheet';
  const closeLabel = t('common.close');

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        className={cx('flex-1 bg-black/40', isSheet ? 'justify-end' : 'items-center justify-center')}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          className={cx(
            'bg-surface-container-lowest p-5 shadow-modal',
            isSheet ? 'w-full rounded-t-2xl' : 'w-[88%] rounded-2xl',
          )}
          style={[shadow.modal, isSheet ? { paddingBottom: insets.bottom + 20 } : null]}
        >
          {title || !hideClose ? (
            <View className="mb-3 flex-row items-center justify-between gap-3">
              {title ? (
                <Text className="flex-1 font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={2}>
                  {title}
                </Text>
              ) : (
                <View className="flex-1" />
              )}
              {!hideClose ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  onPress={onClose}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface-container"
                >
                  <Icon name="x" size={18} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
