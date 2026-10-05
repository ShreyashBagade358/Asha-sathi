import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

const ROLES: { key: string; icon: IconName }[] = [
  { key: 'admin', icon: 'barChart' },
  { key: 'asha', icon: 'heart' },
  { key: 'patient', icon: 'users' },
];

const SCAN_MS = 600;
const RESOLVE_MS = 2500;
const REDIRECT_MS = 3400;

const styles = StyleSheet.create({
  outerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderTopColor: colors.primaryContainer,
    borderBottomColor: colors.tertiaryContainer,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  innerRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderLeftColor: colors.secondaryContainer,
    borderRightColor: colors.inversePrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

/**
 * Port of RedirectingAshaSathi.tsx (Stitch mock): the glass card, the dual
 * loader ring, and the 3-role bento that scans for 2.5s before locking onto the
 * ASHA role and routing into the app.
 *
 * The mock's blurred ambient blobs and backdrop blur are dropped: React Native
 * has no CSS filter, and react-native-svg/blur are not in this bundle. The
 * opacity-tinted circles carry the same silhouette.
 */
export default function RedirectingScreen() {
  const { t } = useLocalization();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [resolved, setResolved] = useState(false);

  const spin = useRef(new Animated.Value(0)).current;
  const spinBack = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const forward = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1500, useNativeDriver: true }),
    );
    const backward = Animated.loop(
      Animated.timing(spinBack, { toValue: 1, duration: 2000, useNativeDriver: true }),
    );
    forward.start();
    backward.start();
    return () => {
      forward.stop();
      backward.stop();
      spin.stopAnimation();
      spinBack.stopAnimation();
    };
  }, [spin, spinBack]);

  // Timers are mount-scoped on purpose: `router` identity is not stable across
  // renders, so listing it would restart the 2.5s countdown on every scan tick.
  useEffect(() => {
    const scan = setInterval(() => setActive((current) => (current + 1) % ROLES.length), SCAN_MS);
    const lock = setTimeout(() => {
      clearInterval(scan);
      setResolved(true);
    }, RESOLVE_MS);
    const done = setTimeout(() => router.replace('/'), REDIRECT_MS);
    return () => {
      clearInterval(scan);
      clearTimeout(lock);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateBack = spinBack.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const centerIcon: IconName = resolved ? 'heart' : (ROLES[active]?.icon ?? 'heart');

  const labels: Record<string, string> = {
    admin: t('auth.roleAdmin'),
    asha: t('auth.roleAsha'),
    patient: t('auth.rolePatient'),
  };

  return (
    <View className="relative flex-1 items-center justify-center bg-surface-bright px-4">
      <View
        pointerEvents="none"
        className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary-container opacity-30"
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-tertiary-container opacity-25"
      />

      <View className="w-full max-w-md items-center rounded-xl border border-outline-variant/30 bg-surface/80 p-6 text-center shadow-modal">
        <View className="mb-6 items-center">
          <Icon name="heart" size={44} color={colors.primaryContainer} />
          <Text className="mt-2 font-display-lg text-display-lg font-bold text-primary">{t('common.appName')}</Text>
          <View className="mt-2 h-px w-16 bg-outline-variant" />
        </View>

        <View className="mb-6 h-20 w-20 items-center justify-center">
          <Animated.View style={[styles.outerRing, { transform: [{ rotate }] }]} />
          <Animated.View style={[styles.innerRing, { transform: [{ rotate: rotateBack }] }]} />
          <Icon name={centerIcon} size={30} color={colors.onSurface} />
        </View>

        <Text className="font-headline-md text-headline-md text-on-surface">
          {resolved ? t('auth.welcomeAsha') : t('auth.redirectingTitle')}
        </Text>
        <Text className="mt-1 max-w-[280px] font-body-md text-body-md text-on-surface-variant">
          {resolved ? t('auth.redirectingWelcomeDesc') : t('auth.redirectingDesc')}
        </Text>

        <View className="mt-6 w-full flex-row gap-2">
          {ROLES.map((role, index) => {
            const isTarget = resolved && role.key === 'asha';
            const isScanning = !resolved && active === index;
            return (
              <View
                key={role.key}
                className={[
                  'flex-1 items-center justify-center gap-1 rounded-lg p-2',
                  isTarget
                    ? 'border-2 border-primary bg-primary-container scale-105 shadow-md'
                    : isScanning
                      ? 'border border-primary bg-surface-variant opacity-80'
                      : 'border border-outline-variant/50 bg-surface-container opacity-40',
                  resolved && !isTarget ? 'opacity-20' : '',
                ].join(' ')}
                testID={`role-${role.key}`}
              >
                <Icon
                  name={role.icon}
                  size={20}
                  color={isTarget ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                />
                <Text
                  className={[
                    'font-label-md text-label-md',
                    isTarget ? 'font-bold text-on-primary-container' : 'text-on-surface-variant',
                  ].join(' ')}
                >
                  {labels[role.key]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
