import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { logout } from '@/auth/session';
import { tokenStore } from '@/auth/tokenStore';
import { useLocalization } from '@/i18n/useLocalization';
import type { UserSummary } from '@/types';

/**
 * My Profile, from the More menu.
 *
 * The web's sidebar user menu (AdminLayout) is the equivalent surface, so the
 * same facts are shown: name, role, phone and the account's language. The user
 * object is the one cached at login by tokenStore, so this renders offline and
 * does not need a round trip.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { t, locale } = useLocalization();
  const [user, setUser] = useState<UserSummary | null>(null);

  // Re-read on focus so the name reflects a session refreshed elsewhere.
  useFocusEffect(
    useCallback(() => {
      void tokenStore.getUser().then(setUser);
    }, []),
  );

  return (
    <Screen title={t('nav.myProfile')} subtitle={t('asha.profileSubtitle')} back withTabBar={false}>
      <View className="gap-5">
        <Card>
          <View className="items-center gap-3 p-6">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <Text className="text-headline-lg text-headline-lg font-bold text-on-primary">
                {initials(user?.full_name)}
              </Text>
            </View>
            <View className="items-center gap-0.5">
              <Text className="text-headline-md text-headline-md font-semibold text-on-surface">
                {user?.full_name ?? '—'}
              </Text>
              <Text className="text-body-md text-body-md text-on-surface-variant">
                {user?.phone ? `+91 ${user.phone}` : '—'}
              </Text>
            </View>
          </View>
        </Card>

        <View>
          <SectionHeader title={t('nav.accountInfo')} />
          <Card>
            <View className="p-4">
              <InfoRow icon="users" label={t('common.role')} value={user?.role ?? '—'} />
              <InfoRow icon="phone" label={t('common.phone')} value={user?.phone ? `+91 ${user.phone}` : '—'} />
              <InfoRow icon="globe" label={t('asha.primaryLanguage')} value={locale === 'hi' ? 'हिंदी' : 'English'} />
            </View>
          </Card>
        </View>

        <Button
          label={t('common.logout')}
          icon="logOut"
          variant="error"
          shape="pill"
          full
          onPress={() => {
            void logout().finally(() => router.replace('/login'));
          }}
        />
      </View>
    </Screen>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-outline-variant/30 py-3 last:border-b-0">
      <Icon name={icon} size={18} />
      <Text className="flex-1 text-body-md text-body-md text-on-surface-variant">{label}</Text>
      <Text className="text-body-md text-body-md font-semibold text-on-surface">{value}</Text>
    </View>
  );
}

function initials(name?: string): string {
  if (!name) return '—';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
