import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Screen } from '@/components/Screen';
import { enqueue, insertLocalBeneficiary, listHouseholds } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import type { Household } from '@/types';

/**
 * Port of AddNewPatientAshaSathi.tsx.
 *
 * The write path is unchanged from the working version: SQLite and the outbox
 * commit first, the form clears immediately, and the upload happens whenever the
 * network allows. That is what makes the screen behave the same online and off.
 *
 * Two web fields are deliberately absent rather than collected-and-dropped:
 *  - `risk_level` is not a beneficiary column anywhere in the schema. Risk is
 *    derived from pregnancies and NCD screenings, so a value typed here would be
 *    discarded by the server's _clean_columns and never come back on a pull.
 *  - `clinical notes` likewise has no beneficiary column. Task and visit notes
 *    live on asha_tasks / anc_visits instead.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function RegisterPatientScreen() {
  const router = useRouter();
  const { t } = useLocalization();

  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [fullName, setFullName] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [gender, setGender] = useState('female');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const rows = await listHouseholds();
      setHouseholds(rows);
      if (rows[0]) setHouseholdId(rows[0].id);
    })();
  }, []);

  const householdOptions = useMemo(
    () => households.map((h) => ({ label: h.hhid || h.id, value: h.id })),
    [households],
  );

  async function save() {
    if (!fullName.trim()) {
      setError(t('asha.fullName'));
      return;
    }
    if (!householdId) {
      setError(t('asha.selectVillage'));
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setError(t('asha.dob'));
      return;
    }

    setBusy(true);
    setError(null);

    const id = newId();
    const data = {
      id,
      beneficiary_id: `BEN-${id.slice(-8).toUpperCase()}`,
      household_id: householdId,
      abha_id: abhaId.trim() || null,
      full_name: fullName.trim(),
      gender,
      date_of_birth: dateOfBirth || null,
      phone: phone.trim() || null,
    };

    try {
      // Local commit first: the record is visible immediately and survives a
      // crash, independent of the network.
      await insertLocalBeneficiary({
        id,
        beneficiaryId: data.beneficiary_id,
        householdId,
        abhaId: data.abha_id ?? '',
        fullName: data.full_name,
        gender,
        dateOfBirth,
        phone: phone.trim(),
      });

      await enqueue({
        clientRequestId: `create-beneficiary-${id}`,
        entity: 'beneficiaries',
        operation: 'create',
        recordId: id,
        version: 1,
        data,
      });

      setFullName('');
      setAbhaId('');
      setDateOfBirth('');
      setPhone('');

      if (isCurrentlyOnline()) {
        scheduleSync(300);
        Alert.alert(t('asha.patientSavedToast'), t('errors.savedQueued'), [{ text: t('common.confirm'), onPress: () => router.back() }]);
      } else {
        Alert.alert(t('errors.savedOfflineTitle'), t('errors.savedOfflineHint'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.retry'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('asha.newPatientTitle')} subtitle={t('asha.newPatientSubtitle')} back withTabBar={false}>
      <View className="gap-5">
        <Card>
          <View className="gap-3 p-4">
            <SectionLabel>{t('asha.personalInfo')}</SectionLabel>
            <TextField
              label={`${t('asha.fullName')} *`}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('asha.legalNamePlaceholder')}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextField
              label={t('asha.abhaId')}
              value={abhaId}
              onChangeText={setAbhaId}
              placeholder={t('asha.abhaPlaceholder')}
              autoCapitalize="characters"
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.mobileNumber')} *`}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('asha.mobilePlaceholder')}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.dob')} *`}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <SelectField
              label={`${t('asha.gender')} *`}
              value={gender}
              onChange={setGender}
              placeholder={t('asha.selectGender')}
              options={[
                { label: t('asha.female'), value: 'female' },
                { label: t('asha.male'), value: 'male' },
                { label: t('asha.other'), value: 'other' },
              ]}
            />
          </View>
        </Card>

        <Card>
          <View className="gap-3 p-4">
            <SectionLabel>{t('asha.familyHousehold')}</SectionLabel>
            <SelectField
              label={`${t('asha.villageLocality')} *`}
              value={householdId}
              onChange={setHouseholdId}
              placeholder={t('asha.selectVillage')}
              options={householdOptions}
            />
          </View>
        </Card>

        {error ? (
          <Text className="rounded-lg bg-error-container p-3 font-body-md text-body-md text-on-error-container">{error}</Text>
        ) : null}

        <View className="flex-row gap-3">
          <Button label={t('common.cancel')} variant="ghost" shape="pill" onPress={() => router.back()} />
          <Button
            label={t('asha.savePatient')}
            icon="check"
            shape="pill"
            loading={busy}
            disabled={busy}
            onPress={() => void save()}
            className="flex-1"
          />
        </View>
      </View>
    </Screen>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text className="font-headline-md text-headline-md font-semibold text-on-surface">{children}</Text>;
}
