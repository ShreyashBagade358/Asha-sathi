import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { apiRequest, authApi } from '@/auth/api';
import { logout } from '@/auth/session';
import { tokenStore } from '@/auth/tokenStore';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { useShellChrome } from '@/nav/useShellChrome';
import { colors } from '@/theme';
import type { UserSummary } from '@/types';

/**
 * My Profile, from the More menu.
 *
 * Port of the web's ProfileSettingsAshaSathi.tsx: identity card, account
 * information, the five preference toggles, a link into the Sync Center and
 * sign out. Data comes from three sources, each optional so the page renders
 * offline with no blank fields:
 *
 *  - the session cache (tokenStore) for name / role / phone - instant, offline
 *  - GET /auth/me for the geographic names the login payload does not carry
 *  - GET /ashas/me/profile (catchment villages) plus GET /config/... to turn
 *    the block / village ids into the labels the web resolves the same way
 *
 * Change password: auth.py exposes no password field (UserUpdate has none and
 * PUT /auth/me strips role/is_active), so the only credential path the API
 * offers is the OTP flow - the action therefore opens /account-recovery, which
 * drives POST /auth/otp/send.
 */

type ProfileUser = UserSummary & {
  state_name?: string | null;
  district_name?: string | null;
  phc_name?: string | null;
  phc_id?: string | null;
  district_id?: string | null;
  block_id?: string | null;
  village_id?: string | null;
};

type GeoNames = {
  state: string | null;
  district: string | null;
  phc: string | null;
  block: string | null;
  villages: string[];
  village: string | null;
};

const EMPTY_GEO: GeoNames = { state: null, district: null, phc: null, block: null, villages: [], village: null };

type SettingKey = 'offlineMode' | 'notifications' | 'autoSync' | 'dataSaver';
type Settings = Record<SettingKey, boolean> & Record<string, boolean>;

const SETTINGS_STORAGE_KEY = 'asha_profile_settings';
const PHOTO_STORAGE_KEY = 'asha_profile_photo';
const DEFAULT_SETTINGS: Settings = {
  offlineMode: true,
  notifications: true,
  autoSync: false,
  dataSaver: false,
};

const SETTINGS: Array<{ key: SettingKey | 'language'; labelKey: string; hintKey: string; icon: IconName }> = [
  { key: 'offlineMode', labelKey: 'asha.setOfflineFirst', hintKey: 'asha.setOfflineFirstHint', icon: 'download' },
  { key: 'notifications', labelKey: 'asha.setPushNotifications', hintKey: 'asha.setPushNotificationsHint', icon: 'bell' },
  { key: 'autoSync', labelKey: 'asha.setAutoSync', hintKey: 'asha.setAutoSyncHint', icon: 'refresh' },
  { key: 'language', labelKey: 'asha.setHindi', hintKey: 'asha.setHindiHint', icon: 'globe' },
  { key: 'dataSaver', labelKey: 'asha.setLowData', hintKey: 'asha.setLowDataHint', icon: 'shield' },
];

/** Best-effort label resolution; every step is skipped when offline. */
async function resolveGeo(me: ProfileUser, catchment: string[]): Promise<GeoNames> {
  const next: GeoNames = {
    state: me.state_name ?? null,
    district: me.district_name ?? null,
    phc: me.phc_name ?? null,
    block: null,
    villages: [],
    village: null,
  };

  if (me.district_id) {
    try {
      const blocks = await apiRequest<Array<{ id: string; name: string }>>(
        `/config/districts/${me.district_id}/blocks`,
      );
      next.block = blocks.find((block) => block.id === me.block_id)?.name ?? null;
    } catch {
      // Offline: the row falls back to "—", never to a crash.
    }
  }

  if (me.phc_id) {
    try {
      const villages = await apiRequest<Array<{ id: string; name: string }>>(
        `/config/phc/${me.phc_id}/villages`,
      );
      next.villages = villages.filter((village) => catchment.includes(village.id)).map((village) => village.name);
      next.village = villages.find((village) => village.id === me.village_id)?.name ?? null;
    } catch {
      // Same: names are a nicety, the ids stay authoritative.
    }
  }

  return next;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t, locale, setLocale } = useLocalization();
  const chrome = useShellChrome();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [geo, setGeo] = useState<GeoNames>(EMPTY_GEO);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void AsyncStorage.getItem(PHOTO_STORAGE_KEY).then((uri) => {
        if (!cancelled) setPhotoUri(uri);
      }).catch(() => {});
      return () => { cancelled = true; };
    }, []),
  );

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.base64) {
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      setPhotoUri(dataUri);
      await AsyncStorage.setItem(PHOTO_STORAGE_KEY, dataUri).catch(() => {});
    } else {
      setPhotoUri(asset.uri);
      await AsyncStorage.setItem(PHOTO_STORAGE_KEY, asset.uri).catch(() => {});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const cached = await tokenStore.getUser();
        if (cancelled || !cached) return;
        setUser(cached as ProfileUser);

        let me = cached as ProfileUser;
        try {
          // The login payload is only { id, phone, full_name, role, language };
          // /auth/me is what carries state / district / phc names.
          me = await authApi.me();
          if (cancelled) return;
          setUser(me);
        } catch {
          // Offline: the cached session is still the truth we can show.
        }

        let catchment: string[] = [];
        try {
          const profile = await apiRequest<{ catchment_villages?: string[] | null }>('/ashas/me/profile');
          catchment = profile.catchment_villages ?? [];
        } catch {
          catchment = [];
        }

        const resolved = await resolveGeo(me, catchment);
        if (!cancelled) setGeo(resolved);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
        .then((raw) => {
          if (cancelled || !raw) return;
          setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) });
        })
        .catch(() => {
          // Preferences keep their defaults when storage is unavailable.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const persistSettings = (next: Settings) => {
    setSettings(next);
    void AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const toggleSetting = (key: SettingKey | 'language') => {
    if (key === 'language') {
      const next = locale === 'hi' ? 'en' : 'hi';
      setLocale(next);
      // Best-effort, mirroring the web's PUT /auth/me: the local preference is
      // what the app renders with, so an offline failure is ignored rather than
      // blocking the toggle or losing the choice.
      void authApi.updateMe({ language: next }).catch(() => {});
      return;
    }
    persistSettings({ ...settings, [key]: !settings[key] });
  };

  const fullName = user?.full_name ?? '—';
  const roleKey =
    user?.role === 'asha'
      ? 'auth.roleAsha'
      : user?.role === 'admin'
        ? 'auth.roleAdmin'
        : user?.role === 'patient'
          ? 'auth.rolePatient'
          : null;

  const rows = [
    { label: t('common.phone'), value: user?.phone ? `+91 ${user.phone}` : '—' },
    { label: t('asha.primaryLanguage'), value: locale === 'hi' ? t('asha.hindi') : t('patient.english') },
    { label: t('common.state'), value: geo.state ?? '—' },
    { label: t('common.district'), value: geo.district ?? '—' },
    { label: t('common.block'), value: geo.block ?? '—' },
    { label: t('common.phc'), value: geo.phc ?? '—' },
    { label: t('nav.villages'), value: geo.villages.length > 0 ? geo.villages.join(', ') : '—' },
  ];

  return (
    <Screen
      title={t('asha.profileTitle')}
      back
      withTabBar={false}
      badgeCount={chrome.badgeCount}
      onBadgePress={chrome.onBadgePress}
      showStatus={chrome.showStatus}
      contentClassName="gap-5"
    >
      <OfflineBanner onPress={() => router.push('/connection-error')} />

      <View className="items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('asha.changePhoto')}
          onPress={() => void pickPhoto()}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              className="h-20 w-20 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
              <Text className="font-headline-md text-headline-md font-bold text-on-primary">{initials(fullName)}</Text>
            </View>
          )}
          <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest shadow-card">
            <Icon name="edit" size={14} color={colors.primary} />
          </View>
        </Pressable>
        <View className="items-center gap-1.5">
          <Text className="font-headline-md text-headline-md font-semibold text-on-surface">{fullName}</Text>
          <Chip tone="info" icon={<Icon name="checkCircle" size={12} color={colors.tertiary} />}>
            {roleKey ? t(roleKey) : user?.role ?? '—'}
          </Chip>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="mapPin" size={14} color={colors.onSurfaceVariant} />
          <Text className="font-body-md text-body-md text-on-surface-variant">{geo.village ?? '—'}</Text>
        </View>
      </View>

      <View>
        <SectionHeader title={t('nav.accountInfo')} />
        <Card>
          <View className="px-4">
            {rows.map((row, index) => (
              <View
                key={row.label}
                className={cx(
                  'flex-row items-center justify-between gap-4 py-3',
                  index < rows.length - 1 ? 'border-b border-outline-variant' : null,
                )}
              >
                <Text className="font-caption text-caption text-on-surface-variant">{row.label}</Text>
                <Text numberOfLines={2} className="flex-1 text-right font-body-md text-body-md font-medium text-on-surface">
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title={t('asha.settingsTitle')} />
        <Card>
          <View className="px-4">
            {SETTINGS.map((setting, index) => {
              const on = setting.key === 'language' ? locale === 'hi' : Boolean(settings[setting.key]);
              return (
                <View
                  key={setting.key}
                  className={cx(
                    'flex-row items-center gap-3 py-4',
                    index < SETTINGS.length - 1 ? 'border-b border-outline-variant' : null,
                  )}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(setting.labelKey)}
                    onPress={() => toggleSetting(setting.key)}
                    className="min-w-0 flex-1 flex-row items-center gap-3"
                  >
                    <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
                      <Icon name={setting.icon} size={20} color={colors.onSurfaceVariant} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-label-md text-label-md font-semibold text-on-surface">{t(setting.labelKey)}</Text>
                      <Text className="font-caption text-caption text-on-surface-variant">{t(setting.hintKey)}</Text>
                    </View>
                  </Pressable>
                  <Toggle value={on} onValueChange={() => toggleSetting(setting.key)} accessibilityLabel={t(setting.labelKey)} />
                </View>
              );
            })}
          </View>
        </Card>
      </View>

      <View className="gap-3">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('asha.openSyncCenter')}
          onPress={() => router.push('/sync')}
          className="flex-row items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4"
        >
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-container">
            <Icon name="download" size={22} color={colors.onPrimaryContainer} />
          </View>
          <View className="flex-1">
            <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('asha.openSyncCenter')}</Text>
            <Text className="font-caption text-caption text-on-surface-variant">{t('asha.profileSyncHint')}</Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.onSurfaceVariant} />
        </Pressable>

        <View className="gap-1">
          <Button
            label={t('asha.changePassword')}
            icon="key"
            shape="pill"
            full
            variant="ghost"
            onPress={() => router.push('/account-recovery')}
          />
          <Text className="text-center font-caption text-caption text-on-surface-variant">
            {t('asha.changePasswordHint')}
          </Text>
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

function initials(name?: string): string {
  if (!name || name === '—') return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
