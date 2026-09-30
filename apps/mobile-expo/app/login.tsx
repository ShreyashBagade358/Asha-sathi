import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { authApi } from '@/auth/api';
import { login } from '@/auth/session';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PasswordField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/** Matches the backend pattern ^[6-9]\d{9}$. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Phone + password sign-in, replacing the previous two-step phone/OTP flow.
 *
 * Deliberate differences from the web:
 *  - The wide hero panel is `hidden lg:flex`, so it is dropped rather than
 *    squeezed onto a phone. The brand lockup below carries the same copy.
 *  - The three-way role tablist is dropped. This build is ASHA-only, so the
 *    patient and PHC-admin tabs would be controls that do nothing.
 */
export default function LoginScreen() {
  const { t } = useLocalization();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTyped = phone.length > 0;
  const phoneValid = PHONE_PATTERN.test(phone);
  // The web only reveals the field-level complaint once typing starts, so an
  // untouched empty box is not scolded.
  const phoneInvalid = hasTyped && !phoneValid;
  const canSubmit = phoneValid && password.length > 0 && !busy;

  async function submit() {
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
      router.replace('/(app)');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen withTabBar={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="gap-6 py-4">
          <View className="items-center gap-2">
            <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Icon name="heart" size={30} color={colors.onPrimary} />
            </View>
            <Text className="text-headline-lg text-headline-lg font-bold text-on-surface">{t('common.appName')}</Text>
            <Text className="text-body-md text-body-md text-on-surface-variant">{t('auth.tagline')}</Text>
          </View>

          <Card>
            <View className="gap-5 p-6">
              <View className="gap-1">
                <Text className="text-headline-md text-headline-md font-semibold text-on-surface">
                  {t('auth.welcomeBack')}
                </Text>
                <Text className="text-body-md text-body-md text-on-surface-variant">{t('auth.welcomeBackHint')}</Text>
              </View>

              <TextField
                label={t('common.phone')}
                value={phone}
                onChangeText={(next) => {
                  setPhone(next.replace(/\D/g, '').slice(0, 10));
                  if (error) setError(null);
                }}
                placeholder={t('auth.enterPhone')}
                prefixText="+91"
                prefixIcon="phone"
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
                autoComplete="tel"
                errorText={phoneInvalid ? t('common.phoneInvalid') : undefined}
                suffixIcon={phoneValid ? 'checkCircle' : undefined}
                suffixIconColor={phoneValid ? colors.secondary : undefined}
                testID="phone-input"
              />

              <PasswordField
                label={t('common.password')}
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  if (error) setError(null);
                }}
                placeholder={t('auth.enterPassword')}
                prefixIcon="lock"
                autoComplete="current-password"
                showLabel={t('auth.showPassword')}
                hideLabel={t('auth.hidePassword')}
                testID="password-input"
              />

              <Button
                label={busy ? t('auth.signingIn') : t('auth.signIn')}
                icon="check"
                shape="pill"
                full
                loading={busy}
                disabled={!canSubmit}
                onPress={() => void submit()}
                testID="sign-in"
              />

              {error ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                  <Icon name="alertCircle" size={18} color={colors.error} />
                  <Text className="flex-1 text-caption text-caption font-medium text-on-error-container">{error}</Text>
                </View>
              ) : null}
            </View>
          </Card>

          <View className="flex-row items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
            <Icon name="alertCircle" size={18} color={colors.tertiary} />
            <View className="flex-1 gap-0.5">
              <Text className="text-label-md text-label-md font-semibold text-on-surface">{t('auth.needHelp')}</Text>
              <Text className="text-caption text-caption text-on-surface-variant">{t('auth.needHelpBody')}</Text>
            </View>
          </View>

          <Text className="text-center text-caption text-caption text-on-surface-variant/70">{t('auth.secureEnv')}</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
