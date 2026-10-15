import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/cx';
import { getQueueCounts } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatVisitDate(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) {
    const month = MONTHS[Number(iso[2]) - 1];
    return `${month ?? ''} ${Number(iso[3])}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${MONTHS[parsed.getMonth()] ?? ''} ${parsed.getDate()}`;
}

export default function CheckupCompletedScreen() {
  const { risk, nextVisit, patientId } = useLocalSearchParams<{
    risk?: string;
    nextVisit?: string;
    patientId?: string;
  }>();
  const { t } = useLocalization();
  const router = useRouter();
  const [queued, setQueued] = useState(true);

  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const riseLate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.timing(pop, {
        toValue: 1,
        duration: 500,
        easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 1,
        duration: 600,
        delay: 100,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(riseLate, {
        toValue: 1,
        duration: 600,
        delay: 300,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ];
    for (const animation of animations) animation.start();
    return () => {
      for (const animation of animations) animation.stop();
    };
  }, [pop, rise, riseLate]);

  useEffect(() => {
    let active = true;
    void getQueueCounts()
      .then((counts) => {
        if (!active) return;
        setQueued(counts.pending + counts.syncing + counts.failed > 0);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const hasRisk = Boolean(risk);
  const visitLabel = nextVisit ? formatVisitDate(nextVisit) : t('asha.checkupNextVisitTbd');

  return (
    <Screen title={t('asha.checkupDoneTitle')} withTabBar={false} contentClassName="grow justify-center">
      <Animated.View
        style={{
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
        className="items-center pb-6 pt-10"
      >
        <View className="mb-4 h-48 w-48 items-center justify-center">
          <View className="absolute left-0 top-0 h-48 w-48 rounded-full border-2 border-secondary-container opacity-10" />
          <View className="absolute left-4 top-4 h-40 w-40 rounded-full border-4 border-secondary-container opacity-30" />
          <View className="h-32 w-32 items-center justify-center rounded-full bg-secondary-container shadow-lg">
            <Icon name="checkCircle" size={72} color={colors.onSecondaryContainer} />
          </View>
        </View>
        <Text className="mb-1 text-center font-headline-lg-bold text-headline-lg text-on-surface">
          {t('asha.registrationComplete')}
        </Text>
        <Text className="max-w-[280px] text-center font-body-md text-body-md text-on-surface-variant">
          {t('asha.checkupRecorded')}
        </Text>
      </Animated.View>

      <Animated.View
        style={{
          opacity: rise,
          transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}
        className="gap-4"
      >
        <View
          className={cx(
            'flex-row items-start gap-4 rounded-3xl p-4 shadow-sm',
            hasRisk ? 'border-l-4 border-error bg-error-container' : 'border-l-4 border-outline-variant bg-surface-container',
          )}
        >
          <View
            className={cx(
              'shrink-0 items-center justify-center rounded-full p-2',
              hasRisk ? 'bg-error/10' : 'bg-secondary/10',
            )}
          >
            <Icon
              name={hasRisk ? 'alert' : 'checkCircle'}
              size={28}
              color={hasRisk ? colors.error : colors.secondary}
            />
          </View>
          <View className="flex-1 pt-1">
            <Text
              className={cx(
                'mb-1 font-label-md text-label-md uppercase tracking-widest',
                hasRisk ? 'text-on-error-container/80' : 'text-on-surface-variant',
              )}
            >
              {hasRisk ? t('asha.riskIndicator') : t('asha.checkupNoRiskLabel')}
            </Text>
            <Text
              className={cx(
                'font-headline-md text-headline-md',
                hasRisk ? 'text-on-error-container' : 'text-on-surface',
              )}
            >
              {hasRisk ? risk : t('asha.checkupNoRisk')}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 items-center justify-center rounded-3xl bg-surface-container-high p-5 shadow-sm">
            <View className="mb-2 rounded-full bg-primary-container/20 p-2">
              <Icon name="calendar" size={28} color={colors.primary} />
            </View>
            <Text className="mb-1 text-center font-label-md text-label-md text-on-surface-variant">
              {t('asha.nextVisitLabel')}
            </Text>
            <Text className="text-center font-headline-md text-headline-md text-on-surface">{visitLabel}</Text>
          </View>
          <View className="relative flex-1 items-center justify-center rounded-3xl border border-outline-variant/30 bg-surface-container p-5 shadow-sm">
            <View
              className={cx('absolute right-4 top-4 h-3 w-3 rounded-full shadow-sm', queued ? 'bg-outline' : 'bg-secondary')}
            />
            <View className="mb-2 rounded-full bg-surface-container-highest/50 p-2">
              <Icon
                name={queued ? 'box' : 'checkCircle'}
                size={28}
                color={queued ? colors.onSurfaceVariant : colors.secondary}
              />
            </View>
            <Text className="mb-1 text-center font-label-md text-label-md text-on-surface-variant">
              {t('asha.dataStatus')}
            </Text>
            <Text className="text-center font-label-md text-label-md text-on-surface">
              {queued ? t('asha.checkupSavedOffline') : t('asha.synced')}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: riseLate,
          transform: [{ translateY: riseLate.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}
        className="gap-2 pb-4 pt-4"
      >
        <Button label={t('asha.goToDashboard')} icon="dashboard" shape="pill" full onPress={() => router.replace('/')} />
        <Button
          label={t('asha.viewPatientProfile')}
          icon="users"
          variant="ghost"
          shape="pill"
          full
          onPress={() => router.replace(patientId ? `/patient/${patientId}` : '/patients')}
        />
      </Animated.View>
    </Screen>
  );
}
