import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { logout } from '@/auth/session';
import { tokenStore } from '@/auth/tokenStore';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useLocalization } from '@/i18n/useLocalization';
import { cx } from '@/cx';
import { MoreButton } from '@/nav/MoreSheet';
import { PATIENT_MORE_SECTIONS } from '@/nav/config';
import { updateMyLanguage } from '@/patient/api';
import { usePatientProfile } from '@/patient/profile';
import { colors } from '@/theme';

type SettingRow = { key: string; label: string; hint: string; icon: IconName };

const SETTINGS: SettingRow[] = [
  {
    key: 'pushNotifications',
    label: 'patient.pushNotifications',
    hint: 'patient.pushNotificationsHint',
    icon: 'bell',
  },
  {
    key: 'reminders',
    label: 'patient.reminderNotifs',
    hint: 'patient.reminderNotifsHint',
    icon: 'calendar',
  },
  { key: 'dataSaver', label: 'patient.dataSaver', hint: 'patient.dataSaverHint', icon: 'shield' },
];

/** Device-local home for the preference switches — the toast below is only honest if this write lands. */
const SETTINGS_STORAGE_KEY = 'asha_sathi_patient_settings';

/**
 * Profile & Settings, ported from the web's PatientProfileSettingsPage:
 * account card, account-info rows, the three preference switches — kept in
 * AsyncStorage so the "Setting updated" toast describes something that
 * actually survived the restart — the EN/हिं language choice — persisted to
 * the account through `PUT /auth/me` — and logout.
 */
export default function PatientSettingsScreen() {
  const { t, locale, setLocale } = useLocalization();
  const router = useRouter();
  const { toast } = useToast();
  const profile = usePatientProfile();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [settings, setSettings] = useState<Record<string, boolean>>({
    pushNotifications: true,
    reminders: true,
    dataSaver: false,
  });
  const [savingLanguage, setSavingLanguage] = useState(false);

  useEffect(() => {
    void tokenStore
      .getUser()
      .then((user) => {
        if (user?.full_name) setFullName(user.full_name);
        if (user?.phone) setPhone(user.phone);
      })
      .catch(() => {
        // The account rows below already fall back to the API profile, so a
        // keychain read failure leaves nothing missing but the override.
      });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        setSettings((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<string, boolean>) }));
      })
      .catch(() => {
        // No stored copy yet (or unreadable storage): the defaults render.
      });
  }, []);

  const display = profile.display;
  const name = fullName || display.name;

  const rows = [
    { label: t('patient.abhaId'), value: display.abhaId },
    { label: t('common.phone'), value: phone ? `+91 ${phone}` : display.phone },
    { label: t('patient.dob'), value: display.dob },
    { label: t('patient.bloodGroup'), value: display.bloodGroup },
    { label: t('patient.assignedPhc'), value: display.phc },
    { label: t('patient.assignedAsha'), value: display.ashaWorker },
  ];

  const toggleSetting = async (key: string) => {
    const previous = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      toast(t('patient.settingUpdatedToast'), 'success');
    } catch {
      setSettings(previous);
      toast(t('common.errorMsg'), 'error');
    }
  };

  const selectLanguage = async (lang: 'en' | 'hi') => {
    if (lang === locale || savingLanguage) return;
    setSavingLanguage(true);
    try {
      await updateMyLanguage(lang);
      setLocale(lang);
      toast(t('patient.settingUpdatedToast'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.errorMsg'), 'error');
    } finally {
      setSavingLanguage(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title={t('patient.profileTitle')}
          subtitle={t('patient.profileSubtitle')}
          actions={
            <>
              <LanguageToggle onSurface />
              <MoreButton sections={PATIENT_MORE_SECTIONS} />
            </>
          }
        />

        <View className="mb-6 items-center gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
            <Text className="font-headline-md text-headline-md font-bold text-on-primary">
              {(name.charAt(0) || '?').toUpperCase()}
            </Text>
          </View>
          <View className="items-center">
            <Text className="font-headline-md text-headline-md font-semibold text-on-surface">
              {name}
            </Text>
            <Text className="capitalize text-body-md text-body-md text-on-surface-variant">
              {t('auth.rolePatient')}
            </Text>
          </View>
          <View className="mt-2 flex-row flex-wrap items-center justify-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1">
              <Icon name="checkCircle" size={14} />
              <Text className="text-caption text-caption font-semibold text-on-secondary-container">
                {t('patient.profileActive')}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1">
              <Icon name="mapPin" size={14} />
              <Text className="text-caption text-caption font-semibold text-on-surface-variant">
                {display.village}
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-label-md text-label-md uppercase text-on-surface-variant">
            {t('patient.accountInfo')}
          </Text>
          <Card>
            {rows.map((row, index) => (
              <View
                key={row.label}
                className={cx(
                  'flex-row items-center justify-between gap-4 px-4 py-3',
                  index < rows.length - 1 && 'border-b border-outline-variant',
                )}
              >
                <Text className="text-caption text-caption text-on-surface-variant">
                  {row.label}
                </Text>
                <Text
                  className="flex-1 text-right text-body-md text-body-md font-medium text-on-surface"
                  numberOfLines={1}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </Card>
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-label-md text-label-md uppercase text-on-surface-variant">
            {t('patient.settingsTitle')}
          </Text>
          <Card>
            {SETTINGS.map((setting, index) => (
              <Pressable
                key={setting.key}
                accessibilityRole="button"
                onPress={() => void toggleSetting(setting.key)}
                className={cx(
                  'flex-row items-center gap-3 px-4 py-4',
                  index < SETTINGS.length - 1 && 'border-b border-outline-variant',
                )}
              >
                <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
                  <Icon name={setting.icon} size={20} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-label-md text-label-md font-semibold text-on-surface">
                    {t(setting.label)}
                  </Text>
                  <Text className="text-caption text-caption text-on-surface-variant">
                    {t(setting.hint)}
                  </Text>
                </View>
                <Toggle
                  value={settings[setting.key] ?? false}
                  onValueChange={() => void toggleSetting(setting.key)}
                  accessibilityLabel={t(setting.label)}
                />
              </Pressable>
            ))}
          </Card>
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-label-md text-label-md uppercase text-on-surface-variant">
            {t('patient.languageLabel')}
          </Text>
          <View className="flex-row gap-3">
            {(['en', 'hi'] as const).map((lang) => (
              <Pressable
                key={lang}
                accessibilityRole="button"
                accessibilityState={{ selected: locale === lang }}
                disabled={savingLanguage}
                onPress={() => void selectLanguage(lang)}
                className={cx(
                  'flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-4',
                  locale === lang
                    ? 'border-primary bg-primary-container'
                    : 'border-outline-variant/40 bg-surface-container-lowest',
                )}
              >
                <Icon
                  name="globe"
                  size={18}
                  color={locale === lang ? colors.primary : colors.onSurfaceVariant}
                />
                <Text
                  className={cx(
                    'text-label-md text-label-md font-semibold',
                    locale === lang ? 'text-on-primary-container' : 'text-on-surface-variant',
                  )}
                >
                  {lang === 'en' ? t('patient.english') : t('patient.hindi')}
                </Text>
              </Pressable>
            ))}
          </View>
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
      </ScrollView>
    </View>
  );
}
