import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authErrorMessage } from '@/auth/errors';
import {
  applyOtpBackspace,
  applyOtpInput,
  createOtpDigits,
  extractDevOtp,
  formatCountdown,
  isOtpComplete,
  maskPhone,
  otpCode,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  type OtpDigits,
} from '@/auth/otp';
import { requestOtp, verifyOtp } from '@/auth/session';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button, Icon, useToast } from '@/components/ui';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/** Matches the backend pattern ^[6-9]\d{9}$. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Port of the Stitch verify_otp_asha_sathi mock: six 48px boxes with
 * auto-advance, backspace-walks-back and whole-code paste, a 00:45 countdown
 * that swaps into "Resend Code", and the pill "Verify and Login" submit.
 */
export default function VerifyOtpScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const params = useLocalSearchParams<{ phone?: string; devOtp?: string }>();

  const phone = typeof params.phone === 'string' ? params.phone : '';
  const phoneValid = PHONE_PATTERN.test(phone);

  const [digits, setDigits] = useState<OtpDigits>(createOtpDigits);
  const [focusIndex, setFocusIndex] = useState(0);
  const [seconds, setSeconds] = useState(OTP_RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(() =>
    typeof params.devOtp === 'string' ? params.devOtp : null,
  );
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!phoneValid) return undefined;
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [phoneValid]);

  function focusBox(index: number) {
    setFocusIndex(index);
    inputs.current[index]?.focus();
  }

  function onBoxChange(index: number, text: string) {
    const result = applyOtpInput(digits, index, text);
    setDigits(result.digits);
    if (error) setError(null);
    if (result.index !== index) focusBox(result.index);
  }

  function onBoxKey(index: number, key: string) {
    if (key !== 'Backspace') return;
    // A filled box deletes its own digit through onChangeText; only an empty
    // box walks focus back, which is the mock's behaviour.
    if ((digits[index] ?? '').length > 0) return;
    const result = applyOtpBackspace(digits, index);
    setDigits(result.digits);
    if (result.index !== index) focusBox(result.index);
  }

  async function resend() {
    if (busy || !phoneValid) return;
    setBusy(true);
    setError(null);
    try {
      const message = await requestOtp(phone);
      const code = extractDevOtp(message);
      if (code) setDevOtp(code);
      setDigits(createOtpDigits());
      setFocusIndex(0);
      setSeconds(OTP_RESEND_SECONDS);
      toast(t('auth.codeSent'), 'success');
      inputs.current[0]?.focus();
    } catch (err) {
      const message = authErrorMessage(err, t, t('common.verifyFailed'));
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!phoneValid) return;
    if (!isOtpComplete(digits)) {
      setError(t('auth.codeRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone, otpCode(digits));
      router.replace('/redirecting');
    } catch (err) {
      const message = authErrorMessage(err, t, t('common.verifyFailed'));
      setError(message);
      toast(message, 'error');
      setDigits(createOtpDigits());
      setFocusIndex(0);
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-surface">
      <View pointerEvents="none" className="absolute inset-x-0 bottom-0 h-1/3 bg-surface-container" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View
          style={{ paddingTop: insets.top }}
          className="flex-row items-center justify-between px-2 py-2"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center"
          >
            <Icon name="arrowLeft" size={22} color={colors.onSurface} />
          </Pressable>
          <LanguageToggle onSurface />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center px-4 pb-8"
        >
          <View className="w-full max-w-md self-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-modal">
            <View className="px-6 pb-6 pt-8">
              <View className="items-center">
                <Text className="font-headline-md text-headline-md font-bold text-primary">{t('common.appName')}</Text>
                <Text className="mt-2 font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">
                  {t('auth.verifyTitle')}
                </Text>
                <Text className="mt-2 px-2 text-center font-body-md text-body-md text-on-surface-variant">
                  {t('auth.otpSentTo')}
                  {'\n'}
                  <Text className="font-semibold text-on-surface">{maskPhone(phone)}</Text>
                </Text>
              </View>

              {!phoneValid ? (
                <View className="mt-6 flex-row items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                  <Icon name="alertCircle" size={18} color={colors.error} />
                  <Text className="flex-1 font-caption text-caption font-medium text-on-error-container">
                    {t('auth.missingPhone')}
                  </Text>
                </View>
              ) : (
                <View className="mt-6">
                  <View className="flex-row items-center justify-between">
                    {digits.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(node) => {
                          inputs.current[index] = node;
                        }}
                        value={digit}
                        onChangeText={(text) => onBoxChange(index, text)}
                        onKeyPress={({ nativeEvent }) => onBoxKey(index, nativeEvent.key)}
                        onFocus={() => setFocusIndex(index)}
                        editable={phoneValid && !busy}
                        keyboardType="number-pad"
                        maxLength={OTP_LENGTH}
                        textContentType="oneTimeCode"
                        autoFocus={index === 0}
                        selectTextOnFocus
                        accessibilityLabel={t('auth.otpSentTo')}
                        className={cx(
                          'h-touch-target w-12 rounded-lg border bg-surface text-center font-headline-lg text-headline-lg text-on-surface',
                          focusIndex === index ? 'border-primary' : 'border-outline-variant',
                        )}
                        testID={`otp-box-${index}`}
                      />
                    ))}
                  </View>

                  <View className="mt-4 flex-row items-center justify-between">
                    <Text className="font-body-md text-body-md text-on-surface-variant">{t('auth.didntReceive')}</Text>
                    <View className="flex-row items-center gap-1">
                      {seconds > 0 ? (
                        <>
                          <Icon name="calendar" size={16} color={colors.outline} />
                          <Text className="font-label-md text-label-md text-outline">{formatCountdown(seconds)}</Text>
                        </>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void resend()}
                          disabled={busy}
                          hitSlop={8}
                          className="py-1"
                        >
                          <Text className="font-label-md text-label-md text-primary underline">
                            {t('auth.resendCode')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {devOtp ? (
                    <Text className="mt-3 text-center font-caption text-caption text-primary">
                      {t('auth.devOtpHint', { code: devOtp })}
                    </Text>
                  ) : null}

                  {error ? (
                    <View className="mt-4 flex-row items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                      <Icon name="alertCircle" size={18} color={colors.error} />
                      <Text className="flex-1 font-caption text-caption font-medium text-on-error-container">
                        {error}
                      </Text>
                    </View>
                  ) : null}

                  <View className="mt-4">
                    <Button
                      label={busy ? t('common.loading') : t('auth.verifyAndLogin')}
                      shape="pill"
                      full
                      loading={busy}
                      disabled={!phoneValid}
                      onPress={() => void verify()}
                      testID="verify-login"
                    />
                  </View>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/account-recovery')}
                className="mt-6 flex-row items-center justify-center gap-1.5"
              >
                <Icon name="alertCircle" size={16} color={colors.primary} />
                <Text className="font-label-md text-label-md text-primary">{t('auth.needHelpLogin')}</Text>
              </Pressable>
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
