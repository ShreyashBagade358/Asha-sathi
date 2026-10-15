import { Pressable, Text, View } from 'react-native';

import { Modal } from '@/components/ui/Modal';
import { useLocalization } from '@/i18n/useLocalization';

export type CredentialsModalProps = {
  visible: boolean;
  name: string;
  phone: string;
  password: string;
  /** Extra note under the warning, e.g. the offline "will upload" hint. */
  note?: string;
  onClose: () => void;
};

/**
 * One label/value line of the reveal sheet. Declared at module level rather
 * than inside the modal: an inline component is a fresh type on every render,
 * so React would tear the row down and rebuild it (dropping `selectable`
 * highlight state) on any parent re-render.
 */
function CredentialRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-lg border border-outline bg-surface px-4 py-3">
      <Text className="text-body-md text-on-surface-variant">{label}</Text>
      <Text
        className={strong ? 'text-body-lg font-bold text-on-surface' : 'text-body-md text-on-surface'}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * One-time reveal of a new patient's sign-in credentials, matching the web
 * dashboard's CredentialsModal. The password is generated at save time and
 * never stored in plain text anywhere the worker can come back to it, so
 * this dialog is the only chance to hand it over.
 */
export function CredentialsModal({ visible, name, phone, password, note, onClose }: CredentialsModalProps) {
  const { t } = useLocalization();

  return (
    <Modal visible={visible} onClose={onClose} title={t('asha.credentialsTitle')}>
      <Text className="text-body-md text-on-surface-variant">{t('asha.credentialsIntro', { name })}</Text>
      <View className="mt-4 gap-2">
        <CredentialRow label={t('asha.credentialsPhone')} value={phone} />
        <CredentialRow label={t('asha.credentialsPassword')} value={password} strong />
      </View>
      <Text className="mt-4 text-caption text-error">{t('asha.credentialsOnce')}</Text>
      {note ? <Text className="mt-2 text-caption text-on-surface-variant">{note}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        className="mt-4 h-touch-target items-center justify-center rounded-lg bg-primary px-4"
      >
        <Text className="text-body-md font-semibold text-on-primary">{t('asha.credentialsDone')}</Text>
      </Pressable>
    </Modal>
  );
}
