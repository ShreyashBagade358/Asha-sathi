import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Pill, SectionHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { listVillageForms, readFormData, type VillageForm } from '@/db/clinical';
import { enqueue, insertLocalVillageForm, listHouseholds } from '@/db/database';
import { tokenStore } from '@/auth/tokenStore';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { cx } from '@/cx';

type FormType = 'general' | 'maternal' | 'child';

const FORM_TYPES: { key: FormType; labelKey: string }[] = [
  { key: 'general', labelKey: 'modules.surveyTypeGeneral' },
  { key: 'maternal', labelKey: 'modules.surveyTypeMaternal' },
  { key: 'child', labelKey: 'modules.surveyTypeChild' },
];

/**
 * Stored values map to keys through an explicit table rather than by
 * interpolating the value into a key name: a survey written by an older build
 * could hold a value this build has no label for, and interpolating would render
 * the missing key itself to the user.
 */
const WATER_LABELS: Record<string, string> = {
  tap: 'modules.surveyWaterTap',
  handpump: 'modules.surveyWaterHandpump',
  other: 'modules.surveyWaterOther',
};
const TOILET_LABELS: Record<string, string> = {
  own: 'modules.surveyToiletOwn',
  shared: 'modules.surveyToiletShared',
  none: 'modules.surveyToiletNone',
};
const SMOKE_LABELS: Record<string, string> = {
  yes: 'modules.surveySmokeYes',
  no: 'modules.surveySmokeNo',
};

const STATUS_CLS: Record<string, string> = {
  draft: 'bg-surface-container',
  submitted: 'bg-primary-container',
  verified: 'bg-secondary-container',
};

function newId(): string {
  // The server upserts on this id, and the same id anchors the retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Health Survey, from the More menu.
 *
 * The web renders captured surveys from a mock array. Here the list is the local
 * `village_forms` table, and the capture form writes to SQLite plus the outbox
 * before attempting any upload - the same offline-first contract as beneficiary
 * registration, so a survey taken in a village with no signal is not lost.
 */
export default function HealthSurveyScreen() {
  const { t } = useLocalization();
  const [rows, setRows] = useState<VillageForm[]>([]);
  const [households, setHouseholds] = useState<{ id: string; hhid: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ashaId, setAshaId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formType, setFormType] = useState<FormType>('general');
  const [householdId, setHouseholdId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [waterSource, setWaterSource] = useState('tap');
  const [toilet, setToilet] = useState('own');
  const [smoke, setSmoke] = useState('no');
  const [membersSeen, setMembersSeen] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [forms, hs, user] = await Promise.all([
        listVillageForms(),
        listHouseholds(),
        tokenStore.getUser(),
      ]);
      setRows(forms);
      setHouseholds(hs.map((h) => ({ id: h.id, hhid: h.hhid })));
      // The server column is NOT NULL and the record must be attributable to
      // the ASHA who actually took the survey, so it is resolved from the
      // signed-in session rather than left blank.
      setAshaId(user?.id ?? '');
      setStatus('ready');
    } catch {
      setRows([]);
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!householdId || !ashaId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = newId();
      const household = households.find((h) => h.id === householdId);
      // `village_forms` has no household column, so the household the survey
      // covers is carried in the JSON payload; without it every survey would
      // be unattributable on the server.
      const answers = {
        household_id: householdId,
        household_hhid: household?.hhid ?? null,
        water_source: waterSource,
        toilet_facility: toilet,
        tobacco_smoke: smoke === 'yes',
        members_screened: membersSeen.trim() === '' ? null : Number(membersSeen),
      };
      const data = {
        asha_id: ashaId,
        form_type: formType,
        form_date: formDate,
        village_id: null,
        form_data: JSON.stringify(answers),
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      };

      await insertLocalVillageForm({
        id,
        ashaId,
        formType,
        formDate,
        villageId: null,
        formData: answers,
      });
      await enqueue({
        clientRequestId: `create-village-form-${id}`,
        entity: 'village_forms',
        operation: 'create',
        recordId: id,
        version: 1,
        data,
      });

      setSaved(true);
      setShowForm(false);
      setHouseholdId('');
      setMembersSeen('');
      await load();

      if (isCurrentlyOnline()) {
        void scheduleSync();
      }
    } catch (error) {
      // A rejected save used to be swallowed here by `void save()`, which left
      // the form looking untouched and the survey silently missing.
      console.error('[health-survey] save failed', error);
      setSaveError(t('modules.surveySaveFailed'));
    } finally {
      setSaving(false);
    }
  }, [ashaId, households, formType, formDate, householdId, waterSource, toilet, smoke, membersSeen, load]);

  return (
    <Screen
      header="page"
      title={t('asha.healthSurveyTitle')}
      back
      withTabBar={false}
      actions={<LanguageToggle onSurface />}
    >
      <View className="mb-4 gap-3">
        <Button
          label={showForm ? t('asha.cancel') : t('asha.startSurvey')}
          icon={showForm ? 'x' : 'plus'}
          full
          onPress={() => {
            setShowForm((v) => !v);
            setSaved(false);
            setSaveError(null);
          }}
        />
        {saveError ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-error-container px-3 py-2.5">
            <Icon name="alert" size={16} />
            <Text className="min-w-0 flex-1 text-body-sm text-body-sm text-on-error-container">
              {saveError}
            </Text>
          </View>
        ) : null}
        {saved ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-secondary-container px-3 py-2.5">
            <Icon name="checkCircle" size={16} />
            <Text className="min-w-0 flex-1 text-body-sm text-body-sm text-on-secondary-container">
              {t('modules.surveySaved')}
            </Text>
          </View>
        ) : null}
      </View>

      {showForm ? (
        <Card className="mb-5">
          <View className="gap-3 p-4">
            <SectionHeader title={t('asha.startSurvey')} />

            <SelectField
              label={t('modules.surveyType')}
              value={formType}
              placeholder={t('modules.surveyType')}
              options={FORM_TYPES.map((f) => ({ label: t(f.labelKey), value: f.key }))}
              onChange={(value) => setFormType(value as FormType)}
            />

            <SelectField
              label={t('modules.surveyHousehold')}
              value={householdId}
              placeholder={t('modules.selectHousehold')}
              options={households.map((h) => ({ label: h.hhid, value: h.id }))}
              onChange={setHouseholdId}
              errorText={households.length === 0 ? t('modules.surveyNoHouseholds') : undefined}
            />

            <TextField
              label={t('modules.surveyDate')}
              value={formDate}
              onChangeText={setFormDate}
              placeholder="YYYY-MM-DD"
            />

            <SelectField
              label={t('modules.surveyWaterSource')}
              value={waterSource}
              placeholder={t('modules.surveyWaterSource')}
              options={[
                { label: t('modules.surveyWaterTap'), value: 'tap' },
                { label: t('modules.surveyWaterHandpump'), value: 'handpump' },
                { label: t('modules.surveyWaterOther'), value: 'other' },
              ]}
              onChange={setWaterSource}
            />

            <SelectField
              label={t('modules.surveyToilet')}
              value={toilet}
              placeholder={t('modules.surveyToilet')}
              options={[
                { label: t('modules.surveyToiletOwn'), value: 'own' },
                { label: t('modules.surveyToiletShared'), value: 'shared' },
                { label: t('modules.surveyToiletNone'), value: 'none' },
              ]}
              onChange={setToilet}
            />

            <SelectField
              label={t('modules.surveySmoke')}
              value={smoke}
              placeholder={t('modules.surveySmoke')}
              options={[
                { label: t('modules.surveySmokeYes'), value: 'yes' },
                { label: t('modules.surveySmokeNo'), value: 'no' },
              ]}
              onChange={setSmoke}
            />

            <TextField
              label={t('modules.surveyMembersSeen')}
              value={membersSeen}
              onChangeText={setMembersSeen}
              keyboardType="number-pad"
              placeholder="0"
            />

            <Button
              label={t('modules.surveySave')}
              icon="save"
              full
              loading={saving}
              disabled={!householdId || !ashaId}
              onPress={() => void save()}
            />
          </View>
        </Card>
      ) : null}

      {status === 'failed' ? (
        <EmptyState
          icon="alertCircle"
          title={t('common.errorTitle')}
          description={t('common.errorMsg')}
          action={<Button label={t('common.retry')} onPress={() => void load()} />}
        />
      ) : status === 'loading' ? (
        <EmptyState icon="inbox" title={t('common.loading')} />
      ) : rows.length === 0 ? (
        <EmptyState icon="fileText" title={t('modules.surveyEmpty')} description={t('modules.surveyEmptyHint')} />
      ) : (
        <View className="gap-3">
          {rows.map((form) => (
            <SurveyCard key={form.id} form={form} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function SurveyCard({ form }: { form: VillageForm }) {
  const { t } = useLocalization();
  const answers = readFormData(form);
  const members = answers.members_screened;
  const typeLabel = FORM_TYPES.find((f) => f.key === form.form_type)?.labelKey;

  return (
    <Card>
      <View className="gap-3 p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="min-w-0 flex-1 font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={2}>
            {typeLabel ? t(typeLabel) : form.form_type}
          </Text>
          <View className={cx('rounded-full px-2.5 py-1', STATUS_CLS[String(form.status)] ?? 'bg-surface-container')}>
            <Text className="text-caption text-caption font-semibold text-on-surface-variant" numberOfLines={1}>
              {form.status === 'draft'
                ? t('modules.surveyDraft')
                : form.status === 'verified'
                  ? t('modules.surveyVerified')
                  : t('modules.surveySubmitted')}
            </Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-x-6 gap-y-2">
          {typeof answers.household_hhid === 'string' ? (
            <Meta label={t('modules.householdLabel')} value={answers.household_hhid} />
          ) : null}
          <Meta label={t('modules.surveyDate')} value={form.form_date ?? '—'} />
          {typeof members === 'number' ? (
            <Meta label={t('modules.surveyMembersSeen')} value={String(members)} />
          ) : null}
          {typeof answers.water_source === 'string' ? (
            <Meta
              label={t('modules.surveyWaterSource')}
              value={t(WATER_LABELS[answers.water_source] ?? 'modules.surveyWaterOther')}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-0">
      <Text className="text-caption text-caption text-on-surface-variant" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-body-md text-body-md font-semibold text-on-surface" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
