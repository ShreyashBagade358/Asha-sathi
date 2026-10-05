import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authErrorMessage } from '@/auth/errors';
import { extractDevOtp } from '@/auth/otp';
import { login, requestOtp } from '@/auth/session';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button, Icon, PasswordField, TextField, useToast } from '@/components/ui';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/** Matches the backend pattern ^[6-9]\d{9}$. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Port of LoginAshaSathi.tsx (the Stitch login mock) for a phone:
 *
 *  - The decorative #e7eeff band covers the bottom third instead of the mock's
 *    `w-2/3` right column, which is a desktop-only shape (`hidden md:block`).
 *  - The role pills are visual cues on the web, so they are dropped rather than
 *    shipped as controls that do nothing.
 *  - OTP is the primary path (the mock's "Send OTP" CTA); the password form is
 *    the secondary swap-in, matching the web's credential login.
 */
export default function LoginScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTyped = phone.length > 0;
  const phoneValid = PHONE_PATTERN.test(phone);
  const phoneInvalid = hasTyped && !phoneValid;

  function onPhoneChange(next: string) {
    setPhone(next.replace(/\D/g, '').slice(0, 10));
    if (error) setError(null);
  }

  async function sendOtp() {
    if (!phoneValid) {
      setError(t('common.phoneInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await requestOtp(phone);
      const devOtp = extractDevOtp(message);
      router.push({
        pathname: '/verify-otp',
        params: devOtp ? { phone, devOtp } : { phone },
      });
    } catch (err) {
      const message = authErrorMessage(err, t);
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    if (!phoneValid) {
      setError(t('common.phoneInvalid'));
      return;
    }
    if (!password) {
      setError(t('common.passwordRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(phone, password);
      router.replace('/redirecting');
    } catch (err) {
      const message = authErrorMessage(err, t);
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const labelCls = 'font-label-md text-label-md font-semibold text-on-surface';

  return (
    <View className="flex-1 bg-surface">
      <View pointerEvents="none" className="absolute inset-x-0 bottom-0 h-1/3 bg-surface-container" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View
          style={{ paddingTop: insets.top }}
          className="flex-row items-center justify-end px-4 py-2"
        >
          <LanguageToggle onSurface />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center px-4 pb-8"
        >
          <View className="w-full max-w-md self-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-modal">
            <View className="items-center px-6 pb-4 pt-8">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-primary-container shadow-sm">
                <Icon name="heart" size={30} color={colors.onPrimaryContainer} />
              </View>
              <Text className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                {t('common.appName')}
              </Text>
              <Text className="mt-1 font-body-md text-body-md text-on-surface-variant">
                {t('auth.portalSubtitle')}
              </Text>
            </View>

            <View className="gap-5 px-6 pb-6">
              <View className="gap-1.5">
                <Text className={labelCls}>{t('common.phone')}</Text>
                <TextField
                  value={phone}
                  onChangeText={onPhoneChange}
                  placeholder={t('auth.enterPhone')}
                  prefixText="+91"
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                  autoComplete="tel"
                  accessibilityLabel={t('common.phone')}
                  errorText={phoneInvalid ? t('common.phoneInvalid') : undefined}
                  suffixIcon={phoneValid ? 'check' : undefined}
                  suffixIconColor={phoneValid ? colors.secondary : undefined}
                  testID="phone-input"
                />
              </View>

              {mode === 'password' ? (
                <View className="gap-5">
                  <View className="gap-1.5">
                    <Text className={labelCls}>{t('common.password')}</Text>
                    <PasswordField
                      value={password}
                      onChangeText={(next) => {
                        setPassword(next);
                        if (error) setError(null);
                      }}
                      placeholder={t('auth.enterPassword')}
                      prefixIcon="lock"
                      autoComplete="current-password"
                      accessibilityLabel={t('common.password')}
                      showLabel={t('auth.showPassword')}
                      hideLabel={t('auth.hidePassword')}
                      testID="password-input"
                    />
                  </View>
                  <Button
                    label={busy ? t('auth.signingIn') : t('common.login')}
                    shape="pill"
                    full
                    loading={busy}
                    disabled={!phoneValid || password.length === 0}
                    onPress={() => void submitPassword()}
                    testID="login"
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setMode('otp');
                      setError(null);
                    }}
                    className="items-center py-1"
                  >
                    <Text className="font-label-md text-label-md text-primary">{t('auth.loginWithOtp')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="gap-4">
                  <Button
                    label={busy ? t('common.loading') : t('auth.sendOtp')}
                    shape="pill"
                    full
                    loading={busy}
                    disabled={!phoneValid}
                    onPress={() => void sendOtp()}
                    testID="send-otp"
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setMode('password');
                      setError(null);
                    }}
                    className="items-center py-1"
                  >
                    <Text className="font-label-md text-label-md text-primary">{t('auth.loginWithPassword')}</Text>
                  </Pressable>
                </View>
              )}

              {error ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                  <Icon name="alertCircle" size={18} color={colors.error} />
                  <Text className="flex-1 font-caption text-caption font-medium text-on-error-container">{error}</Text>
                </View>
              ) : null}

              <View className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
                <Icon name="alertCircle" size={18} color={colors.tertiaryContainer} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('auth.needHelp')}</Text>
                  <Text className="mt-0.5 font-caption text-caption text-on-surface-variant">
                    {t('auth.needHelpBody')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text className="mt-6 pt-2 text-center font-caption text-caption text-on-surface-variant/70">
            {t('auth.secureEnv')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
