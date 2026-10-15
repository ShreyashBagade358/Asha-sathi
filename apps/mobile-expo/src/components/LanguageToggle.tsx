import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/**
 * The EN / हिंदी switch.
 *
 * On the web this lives in the AdminLayout user menu, which a phone has no room
 * for, so the app surfaces it in the top bar instead. It is the one control that
 * must stay reachable from every screen, hence its own component rather than
 * inline markup.
 *
 * The two hints are deliberately NOT t(...) calls: each is written in the
 * language the button would switch *to* (a Hindi UI says "Switch to English",
 * an English UI says "हिंदी में बदलें"), so reading them from the current
 * locale would announce the switch in the wrong language. The visible label
 * ("EN" / "हिं") is the same convention.
 */
export function LanguageToggle({ onSurface = false }: { onSurface?: boolean }) {
  const { locale, toggleLanguage } = useLocalization();
  const label = locale === 'hi' ? 'EN' : 'हिं';
  const hint = locale === 'hi' ? 'Switch to English' : 'हिंदी में बदलें';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={toggleLanguage}
      hitSlop={8}
      className={
        onSurface
          ? 'h-9 min-w-9 flex-row items-center justify-center rounded-full bg-surface-container-high px-2'
          : 'h-9 min-w-9 flex-row items-center justify-center rounded-full bg-on-primary/15 px-2'
      }
    >
      <Icon name="globe" size={18} color={onSurface ? colors.primary : colors.onPrimary} />
      <Text
        className="ml-1 font-label-sm text-label-sm"
        style={{ color: onSurface ? colors.primary : colors.onPrimary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
