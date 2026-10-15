import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authErrorMessage } from '@/auth/errors';
import { extractDevOtp, maskPhone } from '@/auth/otp';
import { requestOtp } from '@/auth/session';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button, Icon, TextField, useToast } from '@/components/ui';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/** Matches the backend pattern ^[6-9]\d{9}$. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Port of AccountRecoveryAshaSathi.tsx (Stitch mock).
 *
 * auth.py has no dedicated recovery endpoint, so the request is driven through
 * POST /auth/otp/send: the SMS it returns carries the code that resets access,
 * and the success state continues into /verify-otp, which is the only reset
 * path the API actually offers.
 */
export default function AccountRecoveryScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ phone: string; devOtp: string | null } | null>(null);
  // Closes the double-submit race: `busy` only lands on the next render, so a
  // second activation arriving in the same tick is stopped here instead.
  const inFlight = useRef(false);

  const hasTyped = phone.length > 0;
  const phoneValid = PHONE_PATTERN.test(phone);
  const phoneInvalid = hasTyped && !phoneValid;

  async function submit() {
    if (inFlight.current) return;
    if (!phoneValid) {
      setError(t('common.phoneInvalid'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const message = await requestOtp(phone);
      setSent({ phone, devOtp: extractDevOtp(message) });
      toast(t('auth.codeSent'), 'success');
    } catch (err) {
      const message = authErrorMessage(err, t);
      setError(message);
      toast(message, 'error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View
        style={{ paddingTop: insets.top }}
        className="min-h-[56px] flex-row items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 py-2 shadow-sm"
      >
        <View className="flex-row items-center gap-2">
          <Icon name="heart" size={22} color={colors.primary} />
          <Text className="font-headline-md text-headline-md font-bold text-primary">{t('common.appName')}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/login')}
            hitSlop={8}
            className="flex-row items-center gap-1 rounded-lg p-2"
          >
            <Icon name="arrowLeft" size={18} color={colors.primary} />
            <Text className="font-label-md text-label-md text-primary">{t('auth.backToLogin')}</Text>
          </Pressable>
          <LanguageToggle onSurface />
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="flex-grow justify-center px-4 py-6"
      >
        <View className="w-full max-w-md self-center rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card">
          <View className="items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <Icon name="lock" size={30} color={colors.onPrimaryContainer} />
            </View>
            <Text className="mb-2 font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">
              {t('auth.recoveryTitle')}
            </Text>
            <Text className="text-center font-body-md text-body-md text-on-surface-variant">
              {t('auth.recoveryBody')}
            </Text>
          </View>

          {sent ? (
            <View className="mt-6 gap-4">
              <View className="items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-secondary-container">
                  <Icon name="checkCircle" size={24} color={colors.onSecondaryContainer} />
                </View>
                <Text className="font-headline-md text-headline-md text-on-surface">{t('auth.recoverySentTitle')}</Text>
                <Text className="text-center font-body-md text-body-md text-on-surface-variant">
                  {t('auth.recoverySentBody')}
                </Text>
                <Text className="font-label-md text-label-md font-semibold text-on-surface">{maskPhone(sent.phone)}</Text>
                {sent.devOtp ? (
                  <Text className="text-center font-caption text-caption text-primary">
                    {t('auth.devOtpHint', { code: sent.devOtp })}
                  </Text>
                ) : null}
              </View>
              <Button
                label={t('auth.continueToOtp')}
                shape="pill"
                full
                onPress={() =>
                  router.push({
                    pathname: '/verify-otp',
                    params: sent.devOtp ? { phone: sent.phone, devOtp: sent.devOtp } : { phone: sent.phone },
                  })
                }
                testID="continue-otp"
              />
              <Button
                label={t('auth.backToLogin')}
                variant="ghost"
                shape="pill"
                full
                onPress={() => router.replace('/login')}
              />
            </View>
          ) : (
            <View className="mt-6 gap-5">
              <View className="gap-1.5">
                <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('common.phone')}</Text>
                <TextField
                  value={phone}
                  onChangeText={(next) => {
                    setPhone(next.replace(/\D/g, '').slice(0, 10));
                    if (error) setError(null);
                  }}
                  placeholder={t('auth.recoveryPlaceholder')}
                  prefixIcon="phone"
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                  autoComplete="tel"
                  accessibilityLabel={t('common.phone')}
                  errorText={phoneInvalid ? t('common.phoneInvalid') : undefined}
                  testID="recovery-phone"
                />
              </View>

              <View className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-3">
                <Icon name="alertCircle" size={18} color={colors.primary} />
                <Text className="flex-1 font-caption text-caption text-on-surface-variant">{t('auth.recoveryInfo')}</Text>
              </View>

              {error ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                  <Icon name="alertCircle" size={18} color={colors.error} />
                  <Text className="flex-1 font-caption text-caption font-medium text-on-error-container">{error}</Text>
                </View>
              ) : null}

              <Button
                label={busy ? t('common.loading') : t('auth.requestReset')}
                shape="rounded"
                full
                loading={busy}
                disabled={!phoneValid}
                onPress={() => void submit()}
                testID="request-reset"
              />
            </View>
          )}

          <View className="mt-6 border-t border-outline-variant pt-4">
            <View className="flex-row flex-wrap items-center justify-center gap-1">
              <Text className="font-body-md text-body-md text-on-surface-variant">{t('auth.havingTrouble')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => toast(t('auth.needHelpBody'), 'info')}
                hitSlop={8}
              >
                <Text className="font-label-md text-label-md text-primary">{t('auth.supportLink')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
