import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useLocalization } from '@/i18n/useLocalization';
import { colors } from '@/theme';

export type ErrorScreenType =
  | 'network'
  | 'sessionExpired'
  | 'dataNotFound'
  | 'notFound404'
  | 'maintenance'
  | 'syncFailed'
  | 'serverError500';

type ErrorScreenConfig = {
  icon: IconName;
  headlineKey: string;
  messageKey: string;
  primaryKey: string;
  secondaryKey: string;
};

/**
 * Port of ASHAErrorScreen in
 * packages/design-system/react/src/components/ErrorScreens.tsx, reusing the
 * same seven states. The web version's copy is hardcoded English; the mobile
 * version resolves the same strings through i18n so the app is fully bilingual.
 * Layout matches: 96px icon circle -> centered headline/message -> stacked
 * primary + outline actions.
 */
const CONFIGS: Record<ErrorScreenType, ErrorScreenConfig> = {
  network: {
    icon: 'wifiOff',
    headlineKey: 'errors.network.headline',
    messageKey: 'errors.network.message',
    primaryKey: 'errors.retry',
    secondaryKey: 'errors.workOffline',
  },
  sessionExpired: {
    icon: 'lock',
    headlineKey: 'errors.sessionExpired.headline',
    messageKey: 'errors.sessionExpired.message',
    primaryKey: 'errors.logInAgain',
    secondaryKey: 'errors.goToLogin',
  },
  dataNotFound: {
    icon: 'search',
    headlineKey: 'errors.dataNotFound.headline',
    messageKey: 'errors.dataNotFound.message',
    primaryKey: 'errors.clearFilters',
    secondaryKey: 'errors.goBack',
  },
  notFound404: {
    icon: 'alertCircle',
    headlineKey: 'errors.notFound404.headline',
    messageKey: 'errors.notFound404.message',
    primaryKey: 'errors.goToHome',
    secondaryKey: 'errors.goBack',
  },
  maintenance: {
    icon: 'tool',
    headlineKey: 'errors.maintenance.headline',
    messageKey: 'errors.maintenance.message',
    primaryKey: 'errors.refresh',
    secondaryKey: 'errors.backToHome',
  },
  syncFailed: {
    icon: 'refresh',
    headlineKey: 'errors.syncFailed.headline',
    messageKey: 'errors.syncFailed.message',
    primaryKey: 'errors.retrySync',
    secondaryKey: 'errors.workOffline',
  },
  serverError500: {
    icon: 'alert',
    headlineKey: 'errors.serverError500.headline',
    messageKey: 'errors.serverError500.message',
    primaryKey: 'errors.retry',
    secondaryKey: 'errors.backToHome',
  },
};

export type ErrorScreenProps = {
  type: ErrorScreenType;
  onPrimary?: () => void;
  onSecondary?: () => void;
};

export function ErrorScreen({ type, onPrimary, onSecondary }: ErrorScreenProps) {
  const { t } = useLocalization();
  const c = CONFIGS[type];

  return (
    <View className="flex-1 items-center justify-center bg-surface px-5 py-10">
      <View className="w-full max-w-sm items-center gap-6">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-surface-container-highest">
          <Icon name={c.icon} size={48} color={colors.onSurfaceVariant} />
        </View>
        <View className="items-center">
          <Text className="text-center text-[30px] font-bold leading-[38px] tracking-tight text-on-surface">
            {t(c.headlineKey)}
          </Text>
          <Text className="mt-2 text-center text-body-md text-on-surface-variant">{t(c.messageKey)}</Text>
        </View>
        <View className="w-full gap-2">
          <Button label={t(c.primaryKey)} onPress={onPrimary} full />
          <Button label={t(c.secondaryKey)} variant="ghost" onPress={onSecondary} full />
        </View>
      </View>
    </View>
  );
}
