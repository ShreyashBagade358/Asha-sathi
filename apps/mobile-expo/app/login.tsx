import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authErrorMessage } from '@/auth/errors';
import { login, RoleMismatchError } from '@/auth/session';
import { tokenStore } from '@/auth/tokenStore';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button, Icon, PasswordField, TextField, useToast } from '@/components/ui';
import { cx } from '@/cx';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

/** Matches the backend pattern ^[6-9]\d{9}$. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * The user type is picked BEFORE the credentials are typed, mirroring the
 * web's role pills. The selection is checked against the account's real role
 * after login so a PHC user cannot sit on an ASHA session (and vice versa).
 */
const ROLE_OPTIONS = [
  { key: 'asha', labelKey: 'auth.roleAsha', icon: 'heart', role: 'asha' },
  { key: 'patient', labelKey: 'auth.rolePatient', icon: 'users', role: 'patient' },
] as const;

type RoleKey = (typeof ROLE_OPTIONS)[number]['key'];

/**
 * Phone + password login with a user-type picker above the fields.
 *
 *  - Password is the only path: the OTP entry moved behind verify-otp and is
 *    no longer offered here, so the flow is select type → number → password.
 *  - "Need help logging in?" is the signed-out door into account recovery,
 *    which is what continues into verify-otp.
 *  - The decorative #e7eeff band covers the bottom third (the desktop mock's
 *    `w-2/3` right column is a desktop-only shape).
 */
export default function LoginScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [role, setRole] = useState<RoleKey | null>('asha');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Closes the double-submit race: `busy` only lands on the next render, so a
  // second activation arriving in the same tick is stopped here instead.
  const inFlight = useRef(false);

  useEffect(() => {
    tokenStore.getLastPhone().then((saved) => {
      if (saved) setPhone(saved);
    });
  }, []);

  const hasTyped = phone.length > 0;
  const phoneValid = PHONE_PATTERN.test(phone);
  const phoneInvalid = hasTyped && !phoneValid;

  function onPhoneChange(next: string) {
    setPhone(next.replace(/\D/g, '').slice(0, 10));
    if (error) setError(null);
  }

  async function submitPassword() {
    if (inFlight.current) return;
    if (!phoneValid) {
      setError(t('common.phoneInvalid'));
      return;
    }
    if (!password) {
      setError(t('common.passwordRequired'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const expected = ROLE_OPTIONS.find((option) => option.key === role)?.role;
      const user = await login(phone, password, expected);
      // Land straight on the role's shell: routing through "/" would replay the
      // cold-start splash and restore a session that login just created.
      router.replace(user.role === 'patient' ? '/home' : '/(app)');
    } catch (err) {
      if (err instanceof RoleMismatchError) {
        // The credentials are valid but for a different user type: drop the
        // session so the app never opens with the wrong identity.
        await tokenStore.clear();
        const message = t('auth.roleMismatch');
        setError(message);
        toast(message, 'error');
        return;
      }
      const message = authErrorMessage(err, t);
      setError(message);
      toast(message, 'error');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const labelCls = 'font-label-md text-label-md font-semibold text-on-surface';

  return (
    <View className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="flex-grow justify-center px-4 pb-8"
          style={{ paddingTop: insets.top }}
        >
          <View className="w-full max-w-md self-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-modal">
            <View className="absolute right-3 top-3 z-10">
              <LanguageToggle onSurface />
            </View>
            <View className="items-center px-6 pb-4 pt-8">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-primary-container shadow-sm">
                <Icon name="heart" size={30} color={colors.onPrimaryContainer} />
              </View>
              <Text className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                {t('common.appName')}
              </Text>
              <Text className="mt-1 text-center font-body-md text-body-md text-on-surface-variant">
                {t('auth.portalSubtitle')}
              </Text>
            </View>

            <View className="gap-5 px-6 pb-6">
              <View className="gap-1.5">
                <Text className={labelCls}>{t('auth.selectRole')}</Text>
                <View className="flex-row gap-2">
                  {ROLE_OPTIONS.map((option) => {
                    const selected = role === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityLabel={t(option.labelKey)}
                        testID={`login-role-${option.key}`}
                        onPress={() => {
                          setRole(option.key);
                          if (error) setError(null);
                        }}
                        className={cx(
                          'flex-1 items-center gap-1 rounded-lg border px-2 py-3',
                          selected
                            ? 'border-primary bg-primary-container'
                            : 'border-outline-variant bg-surface-container-low',
                        )}
                      >
                        <Icon
                          name={option.icon}
                          size={18}
                          color={selected ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                        />
                        <Text
                          className={cx(
                            'font-label-md text-label-md',
                            selected ? 'font-bold text-on-primary-container' : 'text-on-surface-variant',
                          )}
                        >
                          {t(option.labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-1.5">
                <Text className={labelCls}>{t('common.phone')}</Text>
                <TextField
                  value={phone}
                  onChangeText={onPhoneChange}
                  placeholder={t('auth.enterPhone')}
                  prefixText="+91"
                  keyboardType="phone-pad"
                  maxLength={10}
                  numberOfLines={1}
                  autoFocus
                  autoComplete="tel"
                  accessibilityLabel={t('common.phone')}
                  errorText={phoneInvalid ? t('common.phoneInvalid') : undefined}
                  suffixIcon={phoneValid ? 'check' : undefined}
                  suffixIconColor={phoneValid ? colors.secondary : undefined}
                  testID="phone-input"
                />
              </View>

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
                disabled={!role || !phoneValid || password.length === 0}
                onPress={() => void submitPassword()}
                testID="login"
              />

              {error ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-3 py-2.5">
                  <Icon name="alertCircle" size={18} color={colors.error} />
                  <Text className="flex-1 font-caption text-caption font-medium text-on-error-container">{error}</Text>
                </View>
              ) : null}

              <View className="flex-row items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
                <Icon name="alertCircle" size={18} color={colors.tertiary} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-label-md text-label-md font-semibold text-on-surface">{t('auth.needHelp')}</Text>
                  <Text className="mt-0.5 font-caption text-caption text-on-surface-variant">
                    {t('auth.needHelpBody')}
                  </Text>
                </View>
              </View>

              {/* Without this, account recovery has no signed-out entry point
                  and a forgotten password dead-ends on this screen. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.needHelpLogin')}
                onPress={() => router.push('/account-recovery')}
                hitSlop={8}
                testID="forgot-password"
                className="flex-row items-center justify-center gap-1.5"
              >
                <Icon name="key" size={16} color={colors.primary} />
                <Text className="font-label-md text-label-md text-primary underline">
                  {t('auth.needHelpLogin')}
                </Text>
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
