import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { tokenStore } from '@/auth/tokenStore';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CredentialsModal } from '@/components/ui/CredentialsModal';
import { DateField, SelectField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { Screen } from '@/components/Screen';
import {
  allVillagesFor,
  districtsFor,
  statesFor,
  useMyRegion,
  villagesFor,
  type RegionVillage,
} from '@/data/region';
import { insertLocalHousehold } from '@/db/clinical';
import { enqueue, insertLocalBeneficiary, listHouseholds } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { queuePendingPhoto } from '@/sync/photos';
import { colors } from '@/theme';
import type { Household } from '@/types';
import { isoToDate, todayIso } from '@/utils/date';
import { generatePatientPassword } from '@/utils/password';
import { relationshipOptions } from '@/utils/relationship';

/**
 * Port of AddNewPatientAshaSathi.tsx plus the web's AddNewHousehold screen.
 *
 * `/register` serves both forms: the route parameter `mode` picks the screen
 * (`mode=household` is what the Households tab's FAB and empty state push).
 *
 * The write path is unchanged from the working version: SQLite and the outbox
 * commit first, the form clears immediately, and the upload happens whenever the
 * network allows. That is what makes the screen behave the same online and off.
 *
 * State / district / village come from `GET /config/my-region` (cached for
 * offline use) because they are what places the patient in a PHC's geography.
 * The ASHA is not asked to pick herself: `registered_by` is the signed-in user,
 * so a patient created here refers to the worker who created it and the PHC
 * resolves from her assignment.
 *
 * Validation matches the web's `validate()`: each field reports its own message
 * under the input rather than a single banner at the top, and the message clears
 * as soon as the field is edited.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

type Option = { label: string; value: string };

/**
 * Village options for a form: the worker's bundled / fetched villages by
 * name, plus any village referenced by a locally stored household (so a
 * phone whose seed predates a new household can still offer it).
 */
function buildVillageOptions(villages: RegionVillage[], households: Household[]): Option[] {
  const seen = new Map<string, string>();
  for (const village of villages) seen.set(village.id, village.name);
  for (const household of households) {
    if (household.village_id && !seen.has(household.village_id)) {
      seen.set(household.village_id, household.village_id);
    }
  }
  return [...seen].map(([value, label]) => ({ label, value }));
}

/** ABHA preset pattern: 14 digits shown as 12-3456-7890-1234. */
function formatAbha(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  const parts = [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10), d.slice(10, 14)];
  return parts.filter(Boolean).join('-');
}

export default function RegisterScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === 'household' ? <RegisterHouseholdScreen /> : <RegisterPatientScreen />;
}

type Field = 'fullName' | 'abhaId' | 'phone' | 'dateOfBirth' | 'gender' | 'stateId' | 'districtId' | 'villageId';

function RegisterPatientScreen() {
  const router = useRouter();
  const { t } = useLocalization();

  const { region, loading } = useMyRegion();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [householdId, setHouseholdId] = useState('');
  /** True once she changes geography herself; stops auto-fill from overriding her. */
  const [geoTouched, setGeoTouched] = useState(false);
  const [fullName, setFullName] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [relationship, setRelationship] = useState('');
  const [risk, setRisk] = useState('low');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** One-time sign-in credentials shown after a successful save. */
  const [creds, setCreds] = useState<{ name: string; phone: string; password: string; note?: string } | null>(null);

  useEffect(() => {
    void listHouseholds().then(setHouseholds);
  }, []);

  // Apply the worker's own assignment (state / district) once, the first time
  // region data exists - never over a choice she already made. The village is
  // left blank so the ASHA always picks the right one for this patient.
  const assignmentApplied = useRef(false);
  useEffect(() => {
    if (assignmentApplied.current || geoTouched) return;
    if (!region.state && !region.district && region.villages.length === 0) return;
    assignmentApplied.current = true;
    if (region.state) setStateId(region.state.id);
    if (region.district) setDistrictId(region.district.id);
  }, [region, geoTouched]);

  const stateOptions = useMemo(
    () => statesFor(region).map(({ id, name }) => ({ label: name, value: id })),
    [region],
  );
  const districtOptions = useMemo(
    () => districtsFor(region, stateId).map(({ id, name }) => ({ label: name, value: id })),
    [region, stateId],
  );
  const villageOptions = useMemo(
    () => buildVillageOptions(villagesFor(region, districtId), households),
    [region, districtId, households],
  );
  const householdOptions = useMemo(
    () =>
      [
        { label: t('asha.householdNone'), value: '' },
        ...households
          .filter((household) => household.village_id === villageId)
          .map((household) => ({ label: household.hhid || household.id, value: household.id })),
      ],
    [households, villageId, t],
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

  /** Geography errors go stale as a group: picking a state can clear all three. */
  const clearGeoErrors = () => {
    setErrors((prev) => {
      if (!prev.stateId && !prev.districtId && !prev.villageId) return prev;
      const next = { ...prev };
      delete next.stateId;
      delete next.districtId;
      delete next.villageId;
      return next;
    });
  };

  /** State changes invalidate the district below it (and its village link). */
  const onStateChange = (next: string) => {
    setStateId(next);
    setGeoTouched(true);
    setDistrictId('');
    setVillageId('');
    setHouseholdId('');
    clearGeoErrors();
  };

  /** District changes invalidate the village below it. */
  const onDistrictChange = (next: string) => {
    setDistrictId(next);
    setGeoTouched(true);
    setVillageId('');
    setHouseholdId('');
    clearGeoErrors();
  };

  /** A patient belongs to the village first; switching villages drops a household from another. */
  const onVillageChange = (next: string) => {
    setVillageId(next);
    setGeoTouched(true);
    clearGeoErrors();
    setHouseholdId((current) => {
      if (!current) return current;
      const match = households.find((household) => household.id === current);
      return match?.village_id === next ? current : '';
    });
  };

  const pickPhoto = async () => {
    if (photoUri) {
      setPhotoUri(null);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
  };

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!fullName.trim()) next.fullName = t('asha.errNameRequired');
    // Exactly 10 digits, digits only — the input itself strips anything else.
    if (!/^\d{10}$/.test(phone)) next.phone = t('asha.errPhoneRequired');
    if (!dateOfBirth) next.dateOfBirth = t('asha.errDobRequired');
    else if (!isoToDate(dateOfBirth)) next.dateOfBirth = t('asha.errDobFormat');
    else if (dateOfBirth > todayIso()) next.dateOfBirth = t('asha.errDobFuture');
    if (!gender) next.gender = t('asha.errGenderRequired');
    // ABHA preset strength: exactly 14 digits (NHAI format).
    if (!/^\d{14}$/.test(abhaId)) next.abhaId = t('asha.errAbhaInvalid');
    if (!stateId) next.stateId = t('asha.errStateRequired');
    if (!districtId) next.districtId = t('asha.errDistrictRequired');
    if (!villageId) next.villageId = t('asha.errVillageRequired');
    return next;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setError(null);

    const id = newId();
    const user = await tokenStore.getUser();
    // Generated here because the save may be offline; the server hashes it
    // when the record syncs, and this is the only moment it can be shown.
    const patientPassword = generatePatientPassword(phone);
    const patientName = fullName.trim();
    const online = isCurrentlyOnline();
    const metadata = {
      risk,
      notes: notes.trim() || null,
      state: stateOptions.find((option) => option.value === stateId)?.label ?? null,
      district: districtOptions.find((option) => option.value === districtId)?.label ?? null,
      village: villageOptions.find((option) => option.value === villageId)?.label ?? villageId,
      village_id: villageId,
      // Display name for the worker the patient belongs to; the durable link
      // is the registered_by column below.
      ...(user?.full_name ? { asha_worker: user.full_name } : {}),
    };
    const data = {
      id,
      beneficiary_id: `BEN-${id.slice(-8).toUpperCase()}`,
      household_id: householdId || null,
      relationship_to_head: relationship || null,
      // The creating worker - what makes this patient "hers" on the server
      // and what the PHC is resolved from.
      registered_by: user?.id,
      abha_id: abhaId.trim(),
      full_name: fullName.trim(),
      gender,
      date_of_birth: dateOfBirth,
      phone,
      blood_group: bloodGroup || null,
      // The patient's login password - consumed by the server's sync push to
      // create their account, never stored as a beneficiary column.
      password: patientPassword,
      // Sent under the ORM attribute name; the server stores it in the
      // beneficiaries.metadata column and ships it back the same way.
      metadata_json: metadata,
    };

    try {
      // Local commit first: the record is visible immediately and survives a
      // crash, independent of the network.
      await insertLocalBeneficiary({
        id,
        beneficiaryId: data.beneficiary_id,
        householdId: householdId || null,
        abhaId: data.abha_id,
        fullName: data.full_name,
        gender,
        dateOfBirth,
        phone,
        bloodGroup,
        relationshipToHead: relationship || null,
        metadata,
      });

      await enqueue({
        clientRequestId: `create-beneficiary-${id}`,
        entity: 'beneficiaries',
        operation: 'create',
        recordId: id,
        version: 1,
        data,
      });

      // The photo uploads only once the server row exists, i.e. after the
      // sync that this enqueue triggers (offline now = a later sync).
      if (photoUri) {
        await queuePendingPhoto(id, photoUri);
      }

      setFullName('');
      setAbhaId('');
      setDateOfBirth('');
      setPhone('');
      setGender('');
      setBloodGroup('');
      setRelationship('');
      setRisk('low');
      setNotes('');
      setPhotoUri(null);
      setHouseholdId('');
      setErrors({});

      if (online) scheduleSync(300);
      setCreds({
        name: patientName,
        phone,
        password: patientPassword,
        note: online ? undefined : t('errors.savedOfflineHint'),
      });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('asha.errRegistration'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header="page"
      title={t('asha.newPatientTitle')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="gap-5">
        <Card>
          <View className="gap-3 p-4">
            <SectionLabel>{t('asha.personalInfo')}</SectionLabel>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('asha.photoUpload')}
              onPress={() => void pickPhoto()}
              className="flex-row items-center gap-3 rounded-lg border border-outline-variant bg-surface p-3 active:scale-[0.98]"
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} className="h-14 w-14 rounded-full bg-surface-container-high" />
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-container-high">
                  <Icon name="upload" size={22} color={colors.onSurfaceVariant} />
                </View>
              )}
              <View className="flex-1">
                <Text className="font-label-md text-label-md font-semibold text-on-surface">
                  {photoUri ? t('asha.photoChange') : t('asha.photoUpload')}
                </Text>
                <Text className="font-caption text-caption text-on-surface-variant">{t('asha.photoAfterSave')}</Text>
              </View>
              {photoUri ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('asha.photoRemove')}
                  onPress={() => setPhotoUri(null)}
                  hitSlop={8}
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface-container"
                >
                  <Icon name="x" size={16} color={colors.onSurface} />
                </Pressable>
              ) : null}
            </Pressable>
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
              value={formatAbha(abhaId)}
              onChangeText={(next) => setField('abhaId', next.replace(/\D/g, '').slice(0, 14), setAbhaId)}
              errorText={errors.abhaId}
              placeholder={t('asha.abhaPlaceholder')}
              keyboardType="number-pad"
              maxLength={17}
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
            <DateField
              label={`${t('asha.dob')} *`}
              value={dateOfBirth}
              onChange={(next) => setField('dateOfBirth', next, setDateOfBirth)}
              errorText={errors.dateOfBirth}
              placeholder="DD/MM/YYYY"
              doneLabel={t('common.done')}
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
            {!loading && stateOptions.length === 0 ? (
              <Text className="rounded-lg bg-surface-container px-3 py-2 font-caption text-caption text-on-surface-variant">
                {t('asha.regionOfflineHint')}
              </Text>
            ) : null}
            <SelectField
              label={`${t('common.state')} *`}
              value={stateId}
              onChange={onStateChange}
              errorText={errors.stateId}
              placeholder={t('common.state')}
              options={stateOptions}
            />
            <SelectField
              label={`${t('common.district')} *`}
              value={districtId}
              onChange={onDistrictChange}
              errorText={errors.districtId}
              placeholder={stateId ? t('common.district') : t('asha.stateFirstPlaceholder')}
              options={districtOptions}
            />
            <SelectField
              label={`${t('asha.villageLocality')} *`}
              value={villageId}
              onChange={onVillageChange}
              errorText={errors.villageId}
              placeholder={districtId ? t('asha.selectVillage') : t('asha.districtFirstPlaceholder')}
              options={villageOptions}
            />
            <SelectField
              label={t('asha.householdId')}
              value={householdId}
              onChange={setHouseholdId}
              placeholder={t('asha.householdPlaceholder')}
              options={householdOptions}
              searchable
            />
            <SelectField
              label={t('asha.relationshipToHead')}
              value={relationship}
              onChange={setRelationship}
              placeholder={t('asha.relationshipPlaceholder')}
              options={relationshipOptions(t)}
            />
            <SelectField
              label={t('asha.bloodGroupOptional')}
              value={bloodGroup}
              onChange={setBloodGroup}
              placeholder={t('asha.selectBloodGroup')}
              options={BLOOD_GROUPS.map((group) => ({ label: group, value: group }))}
            />
          </View>
        </Card>

        <Card>
          <View className="gap-3 p-4">
            <SectionLabel>{t('asha.initialAssessment')}</SectionLabel>
            <SelectField
              label={t('asha.riskAssessment')}
              value={risk}
              onChange={setRisk}
              options={[
                { label: t('asha.riskLow'), value: 'low' },
                { label: t('asha.riskMedium'), value: 'medium' },
                { label: t('asha.riskHigh'), value: 'high' },
              ]}
            />
            <TextField
              label={t('asha.clinicalNotes')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('asha.notesPlaceholder')}
              multiline
              numberOfLines={3}
              style={{ height: undefined, minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }}
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
            icon="save"
            shape="pill"
            loading={busy}
            disabled={busy}
            onPress={() => void save()}
            className="flex-1"
          />
        </View>
      </View>

      <CredentialsModal
        visible={creds !== null}
        name={creds?.name ?? ''}
        phone={creds?.phone ?? ''}
        password={creds?.password ?? ''}
        note={creds?.note}
        onClose={() => {
          setCreds(null);
          router.back();
        }}
      />
    </Screen>
  );
}

type HouseholdField = 'hhid' | 'headName' | 'villageId' | 'consent';

const HOUSEHOLD_AMENITIES = [
  { key: 'toilet', labelKey: 'asha.amenityToilet' },
  { key: 'electricity', labelKey: 'asha.amenityElectricity' },
  { key: 'clean_water', labelKey: 'asha.amenityCleanWater' },
  { key: 'lpg_connection', labelKey: 'asha.amenityLpg' },
] as const;

/**
 * Add New Household - what the Households tab's FAB and empty-state action
 * open. Mirrors the web's phc-admin registration: Household ID and head of
 * family are required, village comes from the worker's own geography, and the
 * write lands in SQLite plus the outbox like every other field form.
 */
function RegisterHouseholdScreen() {
  const router = useRouter();
  const { t } = useLocalization();

  const { region, loading } = useMyRegion();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [ashaId, setAshaId] = useState('');
  const [hhid, setHhid] = useState('');
  const [headName, setHeadName] = useState('');
  const [villageId, setVillageId] = useState('');
  const [address, setAddress] = useState('');
  const [amenities, setAmenities] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<HouseholdField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [rows, user] = await Promise.all([listHouseholds(), tokenStore.getUser()]);
      setHouseholds(rows);
      setAshaId(user?.id ?? '');
      // Pre-fill the next sequential HHID: HH-YYYY-NNNN
      const year = new Date().getFullYear();
      const prefix = `HH-${year}-`;
      const maxSeq = rows
        .map((h) => h.hhid ?? '')
        .filter((id) => id.startsWith(prefix))
        .map((id) => parseInt(id.slice(prefix.length), 10))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => Math.max(a, b), 0);
      setHhid(`${prefix}${String(maxSeq + 1).padStart(4, '0')}`);
    })();
  }, []);

  // No village auto-fill: the ASHA always picks the village herself.
  const villageOptions = useMemo(
    () => buildVillageOptions(allVillagesFor(region), households),
    [region, households],
  );

  const setField = <K extends HouseholdField>(key: K, value: string, assign: (next: string) => void) => {
    assign(value);
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  function validate(): Partial<Record<HouseholdField, string>> {
    const next: Partial<Record<HouseholdField, string>> = {};
    // The server's HouseholdCreate requires min_length=3; catching it here
    // keeps the outbox from holding a push that would be rejected.
    if (!hhid.trim()) next.hhid = t('asha.errHhidRequired');
    else if (hhid.trim().length < 3) next.hhid = t('asha.errHhidShort');
    if (!headName.trim()) next.headName = t('asha.errHeadNameRequired');
    if (!villageId) next.villageId = t('asha.errVillageRequired');
    if (!consent) next.consent = t('asha.errConsentRequired');
    return next;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setError(null);

    const id = newId();
    const now = new Date().toISOString();
    const hhidValue = hhid.trim();
    const head = headName.trim();
    const addressValue = address.trim() || null;
    const amenityEntries = Object.keys(amenities);
    const amenitiesValue = amenityEntries.length ? amenities : null;
    const consentDate = todayIso();
    const data = {
      id,
      hhid: hhidValue,
      village_id: villageId,
      asha_id: ashaId,
      address: addressValue,
      head_name: head,
      amenities: amenitiesValue,
      consent_given: consent,
      consent_date: consent ? consentDate : null,
      consent_version: consent ? 'v1' : null,
      version: 1,
      updated_at: now,
    };

    try {
      await insertLocalHousehold({
        id,
        hhid: hhidValue,
        villageId,
        ashaId,
        address: addressValue,
        consentGiven: consent,
        headName: head,
        amenities: amenitiesValue,
      });

      await enqueue({
        clientRequestId: `create-household-${id}`,
        entity: 'households',
        operation: 'create',
        recordId: id,
        version: 1,
        data,
      });

      setHhid('');
      setHeadName('');
      setAddress('');
      setAmenities({});
      setConsent(false);
      if (region.villages.length !== 1) setVillageId('');
      setErrors({});

      if (isCurrentlyOnline()) {
        scheduleSync(300);
        Alert.alert(t('asha.householdSavedToast'), t('errors.savedQueued'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t('errors.savedOfflineTitle'), t('errors.savedOfflineHint'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('asha.errHouseholdRegistration'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header="page"
      title={t('asha.addHousehold')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="gap-5">
        <Card>
          <View className="gap-3 p-4">
            <SectionLabel>{t('asha.familyHousehold')}</SectionLabel>
            <TextField
              label={`${t('asha.householdIdLabel')} *`}
              value={hhid}
              onChangeText={(next) => setField('hhid', next, setHhid)}
              errorText={errors.hhid}
              placeholder="e.g. HH-2024-0001"
              autoCapitalize="characters"
              returnKeyType="next"
            />
            <TextField
              label={`${t('asha.headOfFamily')} *`}
              value={headName}
              onChangeText={(next) => setField('headName', next, setHeadName)}
              errorText={errors.headName}
              placeholder={t('asha.legalNamePlaceholder')}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {!loading && villageOptions.length === 0 ? (
              <Text className="rounded-lg bg-surface-container px-3 py-2 font-caption text-caption text-on-surface-variant">
                {t('asha.regionOfflineHint')}
              </Text>
            ) : null}
            <SelectField
              label={`${t('asha.villageLocality')} *`}
              value={villageId}
              onChange={(next) => setField('villageId', next, setVillageId)}
              errorText={errors.villageId}
              placeholder={t('asha.selectVillage')}
              options={villageOptions}
            />
            <TextField
              label={t('asha.address')}
              value={address}
              onChangeText={setAddress}
              placeholder={t('asha.address')}
              autoCapitalize="words"
            />
            <View className="gap-2">
              <Text className="font-label-md text-label-md text-on-surface-variant">
                {t('asha.amenities')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {HOUSEHOLD_AMENITIES.map((a) => {
                  const on = Boolean(amenities[a.key]);
                  return (
                    <Pressable
                      key={a.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() =>
                        setAmenities((prev) => {
                          const next = { ...prev };
                          if (next[a.key]) delete next[a.key];
                          else next[a.key] = true;
                          return next;
                        })
                      }
                      className={`rounded-lg border px-3 py-2 ${
                        on
                          ? 'border-primary bg-primary-container'
                          : 'border-outline bg-surface'
                      }`}
                    >
                      <Text
                        className={`font-label-md text-label-md font-semibold ${
                          on ? 'text-on-primary-container' : 'text-on-surface-variant'
                        }`}
                      >
                        {t(a.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View className="gap-1">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="font-body-md text-body-md text-on-surface">
                  {t('asha.consentLabel')}
                </Text>
                <Toggle
                  value={consent}
                  onValueChange={(next) => {
                    setConsent(next);
                    if (next) {
                      setErrors((prev) => {
                        if (!prev.consent) return prev;
                        const copy = { ...prev };
                        delete copy.consent;
                        return copy;
                      });
                    }
                  }}
                  accessibilityLabel={t('asha.consentLabel')}
                />
              </View>
              <Text className="font-caption text-caption text-on-surface-variant">
                {t('asha.consentRegister')}
              </Text>
              {errors.consent ? (
                <Text className="font-caption text-caption text-error" accessibilityRole="alert">
                  {errors.consent}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {error ? (
          <Text className="rounded-lg bg-error-container p-3 font-body-md text-body-md text-on-error-container">{error}</Text>
        ) : null}

        <View className="flex-row gap-3">
          <Button label={t('common.cancel')} variant="ghost" shape="pill" onPress={() => router.back()} />
          <Button
            label={t('asha.saveHousehold')}
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
