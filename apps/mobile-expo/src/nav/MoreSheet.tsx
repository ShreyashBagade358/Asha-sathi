import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Divider } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { MORE_SECTIONS } from '@/nav/config';
import { colors } from '@/theme';

/**
 * Overflow destinations, mirroring the sidebar sections the web hides behind
 * `lg:hidden` on a phone: Work (survey, pregnancy, child health, checkups,
 * referrals, follow-ups) and Data (notifications, profile).
 */
function MoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { t } = useLocalization();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(32, 49, 75, 0.5)' }}
      />
      <View className="max-h-[75%] rounded-t-2xl bg-surface-container-lowest">
        <View className="flex-row items-center justify-between px-4 py-4">
          <Text className="font-headline-md text-headline-md text-on-surface">{t('nav.more')}</Text>
          <IconButton name="x" size={20} onPress={onClose} accessibilityLabel={t('common.close')} />
        </View>
        <Divider />
        {MORE_SECTIONS.map((section) => (
          <View key={section.titleKey} className="px-2 py-3">
            <Text className="px-2 pb-1 font-label-sm text-label-sm text-on-surface-variant">{t(section.titleKey)}</Text>
            {section.items.map((item) => (
              <Pressable
                key={item.path}
                accessibilityRole="link"
                onPress={() => {
                  onClose();
                  router.push(item.path as never);
                }}
                className="flex-row items-center gap-3 rounded-lg px-2 py-3"
              >
                <Icon name={item.icon} size={18} />
                <Text className="flex-1 font-label-md text-label-md text-on-surface">{t(item.labelKey)}</Text>
                <Icon name="chevronRight" size={16} color={colors.onSurfaceVariant} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </Modal>
  );
}

/**
 * Drop this into a PageHeader's `actions` slot instead of wiring sheet state in
 * every screen. The web puts the same overflow behind the sidebar's `lg:hidden`
 * breakpoint, so a phone needs an explicit trigger for it.
 */
export function MoreButton() {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton name="menu" size={22} onPress={() => setOpen(true)} accessibilityLabel={t('nav.more')} />
      <MoreSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
