import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

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
 * Validation matches the web's `validate()`: each field reports its own message
 * under the input rather than a single banner at the top, and the message clears
 * as soon as the field is edited.
 *
 * Fields the web collects that are deliberately absent here rather than
 * collected-and-dropped:
 *  - `risk_level` is not a beneficiary column anywhere in the schema. Risk is
 *    derived from pregnancies and NCD screenings, so a value typed here would be
 *    discarded by the server's _clean_columns and never come back on a pull.
 *  - `clinical notes` likewise has no beneficiary column. Task and visit notes
 *    live on asha_tasks / anc_visits instead.
 *  - Blood group and the assigned ASHA worker are not `beneficiaries` columns
 *    this app syncs either, and the web's worker picker needs a directory
 *    endpoint the offline app does not call. Both would be sent once and lost
 *    on the next pull, so they are left out.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Field = 'fullName' | 'abhaId' | 'phone' | 'dateOfBirth' | 'gender' | 'householdId';

export default function RegisterPatientScreen() {
  const router = useRouter();
  const { t } = useLocalization();

  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [fullName, setFullName] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
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

  /** Mirror of the web's `set()`: writing a field also clears its error. */
  const setField = <K extends Field>(key: K, value: string, assign: (next: string) => void) => {
    assign(value);
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!fullName.trim()) next.fullName = t('asha.errNameRequired');
    // Exactly 10 digits, digits only — the input itself strips anything else.
    if (!/^\d{10}$/.test(phone)) next.phone = t('asha.errPhoneRequired');
    if (!dateOfBirth) next.dateOfBirth = t('asha.errDobRequired');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) next.dateOfBirth = t('asha.errDobFormat');
    if (!gender) next.gender = t('asha.errGenderRequired');
    if (abhaId.trim().length < 4) next.abhaId = t('asha.errAbhaRequired');
    if (!householdId) next.householdId = t('asha.errVillageRequired');
    return next;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setError(null);

    const id = newId();
    const data = {
      id,
      beneficiary_id: `BEN-${id.slice(-8).toUpperCase()}`,
      household_id: householdId,
      abha_id: abhaId.trim(),
      full_name: fullName.trim(),
      gender,
      date_of_birth: dateOfBirth,
      phone,
    };

    try {
      // Local commit first: the record is visible immediately and survives a
      // crash, independent of the network.
      await insertLocalBeneficiary({
        id,
        beneficiaryId: data.beneficiary_id,
        householdId,
        abhaId: data.abha_id,
        fullName: data.full_name,
        gender,
        dateOfBirth,
        phone,
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
      setGender('');
      setErrors({});

      if (isCurrentlyOnline()) {
        scheduleSync(300);
        Alert.alert(t('asha.patientSavedToast'), t('errors.savedQueued'), [{ text: t('common.confirm'), onPress: () => router.back() }]);
      } else {
        Alert.alert(t('errors.savedOfflineTitle'), t('errors.savedOfflineHint'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('asha.errRegistration'));
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
              onChangeText={(next) => setField('fullName', next, setFullName)}
              errorText={errors.fullName}
              placeholder={t('asha.legalNamePlaceholder')}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.abhaId')} *`}
              value={abhaId}
              onChangeText={(next) => setField('abhaId', next, setAbhaId)}
              errorText={errors.abhaId}
              placeholder={t('asha.abhaPlaceholder')}
              autoCapitalize="characters"
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.mobileNumber')} *`}
              value={phone}
              onChangeText={(next) => setField('phone', next.replace(/\D/g, '').slice(0, 10), setPhone)}
              errorText={errors.phone}
              prefixText="+91"
              placeholder={t('asha.mobilePlaceholder')}
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.dob')} *`}
              value={dateOfBirth}
              onChangeText={(next) => setField('dateOfBirth', next, setDateOfBirth)}
              errorText={errors.dateOfBirth}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <SelectField
              label={`${t('asha.gender')} *`}
              value={gender}
              onChange={(next) => setField('gender', next, setGender)}
              errorText={errors.gender}
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
              onChange={(next) => setField('householdId', next, setHouseholdId)}
              errorText={errors.householdId}
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
