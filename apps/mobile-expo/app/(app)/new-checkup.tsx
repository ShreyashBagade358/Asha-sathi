import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { tokenStore } from '@/auth/tokenStore';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { PhotoCapture } from '@/components/ui/PhotoCapture';
import { useToast } from '@/components/ui/Toast';
import { insertLocalNcdScreening, listPatients, type PatientRow } from '@/db/clinical';
import { enqueue } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';

/**
 * Port of the web's inline New Check-up form (HealthCheckUpAshaSathi).
 *
 * Only the readings `ncd_screenings` can hold are collected: the web's weight,
 * haemoglobin, temperature, pulse and notes fields have no column on either the
 * local table or the server model, so they are left out rather than collected
 * and dropped by the server's _clean_columns — the same call register.tsx
 * documents for the fields it omits.
 *
 * The write path is the one every module form uses: SQLite and the outbox
 * commit first, the upload happens whenever the network allows, and the list
 * reloads when it regains focus.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type Field = 'patientId' | 'bpSystolic' | 'bpDiastolic' | 'bloodSugar';

export default function NewCheckupScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const toast = useToast();

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [recordedBy, setRecordedBy] = useState<string | null>(null);
  const [patientId, setPatientId] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkupPhotos, setCheckupPhotos] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const [rows, user] = await Promise.all([listPatients(), tokenStore.getUser()]);
      setPatients(rows);
      setRecordedBy(user?.id ?? null);
    })();
  }, []);

  const patientOptions = useMemo(
    () =>
      patients.map((p) => ({
        label: p.household_hhid ? `${p.full_name} · ${p.household_hhid}` : p.full_name,
        value: p.id,
      })),
    [patients],
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
    if (!patientId) next.patientId = t('asha.errCheckupPatient');
    // A screening with neither reading is the one thing the list screen cannot
    // show, so at least one of the three has to be filled in.
    if (!bpSystolic && !bpDiastolic && !bloodSugar) next.bpSystolic = t('asha.errCheckupReading');
    return next;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setError(null);

    const id = newId();
    const screeningDate = new Date().toISOString().slice(0, 10);
    const online = isCurrentlyOnline();
    const systolic = bpSystolic === '' ? null : Number(bpSystolic);
    const diastolic = bpDiastolic === '' ? null : Number(bpDiastolic);
    const sugar = bloodSugar === '' ? null : Number(bloodSugar);

    try {
      // Local commit first: the record is visible immediately and survives a
      // crash, independent of the network.
      await insertLocalNcdScreening({
        id,
        beneficiaryId: patientId,
        screeningDate,
        bpSystolic: systolic,
        bpDiastolic: diastolic,
        bloodSugarRandom: sugar,
        recordedBy,
      });

      // The screening questions are not sent: the server model applies the same
      // defaults the local insert did, so both rows match after the next pull.
      await enqueue({
        clientRequestId: `create-ncd-screening-${id}`,
        entity: 'ncd_screenings',
        operation: 'create',
        recordId: id,
        version: 1,
        data: {
          id,
          beneficiary_id: patientId,
          screening_date: screeningDate,
          bp_systolic: systolic,
          bp_diastolic: diastolic,
          blood_sugar_random: sugar,
          recorded_by: recordedBy,
        },
      });

      if (online) scheduleSync(300);

      toast.toast(online ? t('asha.checkupSaved') : t('asha.checkupSavedOffline'));
      router.back();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('asha.errCheckupSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header="page"
      title={t('asha.newCheckup')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="gap-5">
        <Card>
          <View className="gap-3 p-4">
            <SelectField
              label={`${t('asha.checkupPatient')} *`}
              value={patientId}
              onChange={(next) => setField('patientId', next, setPatientId)}
              errorText={errors.patientId ?? (patients.length === 0 ? t('asha.noPatients') : undefined)}
              placeholder={t('asha.selectPatient')}
              options={patientOptions}
            />
          </View>
        </Card>

        <Card>
          <View className="gap-3 p-4">
            <SectionHeader title={t('patient.vitals')} />
            <TextField
              label={t('asha.formBpSystolic')}
              value={bpSystolic}
              onChangeText={(next) => setField('bpSystolic', next.replace(/\D/g, '').slice(0, 3), setBpSystolic)}
              errorText={errors.bpSystolic}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="next"
            />
            <TextField
              label={t('asha.formBpDiastolic')}
              value={bpDiastolic}
              onChangeText={(next) => setField('bpDiastolic', next.replace(/\D/g, '').slice(0, 3), setBpDiastolic)}
              errorText={errors.bpDiastolic}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="next"
            />
            <TextField
              label={t('asha.labBloodSugar')}
              value={bloodSugar}
              onChangeText={(next) =>
                setField('bloodSugar', next.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 6), setBloodSugar)
              }
              errorText={errors.bloodSugar}
              suffix={t('asha.unitMgDl')}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
        </Card>

        <PhotoCapture
          photos={checkupPhotos}
          onPhotosChange={setCheckupPhotos}
          maxPhotos={3}
          label={t('photo.checkupPhotoLabel')}
          hint={t('photo.checkupPhotoHint')}
          size="md"
        />

        {error ? (
          <Text className="rounded-lg bg-error-container p-3 font-body-md text-body-md text-on-error-container">{error}</Text>
        ) : null}

        <View className="flex-row gap-3">
          <Button label={t('common.cancel')} variant="ghost" shape="pill" onPress={() => router.back()} />
          <Button
            label={t('asha.saveCheckup')}
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
