import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { tokenStore } from '@/auth/tokenStore';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import {
  completeHouseholdTasks,
  getHouseholdCard,
  listHouseholdMemberCards,
  listHouseholdVisitRecords,
  listHouseholdVisitTasks,
  type HouseholdCard,
  type HouseholdMemberCard,
} from '@/db/clinical';
import { enqueue, insertLocalVillageForm, insertLocalVisitChecks } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { colors } from '@/theme';
import { cx } from '@/cx';

type Status = 'loading' | 'ready' | 'missing' | 'failed';
type FeverAnswer = '' | 'yes' | 'no';
type CheckResult = 'ok' | 'concern';

const FEVER_OPTIONS: readonly Exclude<FeverAnswer, ''>[] = ['yes', 'no'];

/** What the ASHA records per member during this visit. */
const CHECK_OPTIONS: readonly CheckResult[] = ['ok', 'concern'];

function newId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function memberAge(member: HouseholdMemberCard, yearsUnit: string, monthsUnit: string): string {
  if (member.age_years !== null) return `${member.age_years} ${yearsUnit}`;
  if (member.age_months !== null) return `${member.age_months} ${monthsUnit}`;
  return '—';
}

/**
 * Household visit survey - the mobile counterpart of the web's
 * HouseholdVisitSurveyAshaSathi screen.
 *
 * The visit is written to `village_forms` (form_type `household_visit`), the one
 * survey-shaped table the sync feed carries, and queued before any upload is
 * attempted: the visit happens where there is often no signal. Completing it
 * closes the household's open tasks locally and queues those status changes, so
 * the task list is correct on the device immediately and on the server as soon
 * as the outbox drains.
 *
 * Each member's ok/concern flag is its own row in `household_visit_checks`,
 * queued alongside the visit, so a concern raised in the field is a first-class
 * record rather than a note buried in the survey answers.
 */
export default function HouseholdVisitScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLocalization();
  const router = useRouter();
  const toast = useToast();

  const [status, setStatus] = useState<Status>('loading');
  const [household, setHousehold] = useState<HouseholdCard | null>(null);
  const [members, setMembers] = useState<HouseholdMemberCard[]>([]);
  const [pastVisits, setPastVisits] = useState(0);
  const [ashaId, setAshaId] = useState('');
  const [consent, setConsent] = useState(false);
  const [water, setWater] = useState(false);
  const [toilet, setToilet] = useState(false);
  const [fever, setFever] = useState<FeverAnswer>('');
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setStatus('missing');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const [card, memberRows, visitRows, user] = await Promise.all([
        getHouseholdCard(id),
        listHouseholdMemberCards(id),
        listHouseholdVisitRecords(id),
        tokenStore.getUser(),
      ]);
      if (!card) {
        setHousehold(null);
        setStatus('missing');
        return;
      }
      setHousehold(card);
      setMembers(memberRows);
      setChecks(() => Object.fromEntries(memberRows.map((m) => [m.id, 'ok' as CheckResult])));
      setPastVisits(visitRows.length);
      setAshaId(user?.id ?? '');
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!id || !household) return;
    setSaving(true);
    setError(null);
    try {
      const formId = newId();
      const answers = {
        household_id: id,
        household_hhid: household.hhid,
        consent_obtained: consent,
        clean_water: water,
        functional_toilet: toilet,
        ...(fever ? { recent_fever: fever } : {}),
      };
      const formDate = new Date().toISOString().slice(0, 10);
      const submittedAt = new Date().toISOString();

      await insertLocalVillageForm({
        id: formId,
        ashaId: ashaId || null,
        formType: 'household_visit',
        formDate,
        villageId: null,
        formData: answers,
      });
      await enqueue({
        clientRequestId: `create-village-form-${formId}`,
        entity: 'village_forms',
        operation: 'create',
        recordId: formId,
        version: 1,
        data: {
          asha_id: ashaId,
          form_type: 'household_visit',
          form_date: formDate,
          village_id: null,
          form_data: JSON.stringify(answers),
          status: 'submitted',
          submitted_at: submittedAt,
        },
      });

      const checkRows = members.map((member) => ({
        id: newId(),
        householdId: id,
        beneficiaryId: member.id,
        checkType: 'general',
        result: checks[member.id] ?? 'ok',
        notes: null,
        visitedAt: formDate,
        createdBy: ashaId || null,
      }));
      await insertLocalVisitChecks(checkRows);
      for (const row of checkRows) {
        await enqueue({
          clientRequestId: `create-household-visit-check-${row.id}`,
          entity: 'household_visit_checks',
          operation: 'create',
          recordId: row.id,
          version: 1,
          data: {
            household_id: row.householdId,
            survey_id: null,
            beneficiary_id: row.beneficiaryId,
            check_type: row.checkType,
            result: row.result,
            notes: row.notes,
            visited_at: row.visitedAt,
            created_by: row.createdBy,
          },
        });
      }
      const openTasks = await listHouseholdVisitTasks(id);
      await completeHouseholdTasks(id, true);

      if (isCurrentlyOnline()) scheduleSync(300);

      const today = new Date().toISOString().slice(0, 10);
      const upcoming = openTasks
        .map((task) => task.task_date)
        .filter((date): date is string => date != null && date >= today)
        .sort();
      const nextVisit = upcoming[0];

      const flagged = members.find((member) => {
        const level = (member.risk_level ?? '').toLowerCase();
        return level === 'high' || level === 'high_risk';
      });
      const focus =
        flagged ??
        members.find((member) => member.is_pregnant > 0) ??
        (members.length === 1 ? members[0] : undefined);
      const riskMessage = flagged
        ? flagged.is_pregnant > 0
          ? t('asha.highRiskPregnancy')
          : t('asha.riskHighLabel')
        : undefined;

      toast.toast(t('errors.savedQueued'), 'success');
      router.replace({
        pathname: '/checkup-completed',
        params: {
          ...(riskMessage ? { risk: riskMessage } : {}),
          ...(nextVisit ? { nextVisit } : {}),
          ...(focus ? { patientId: focus.id } : {}),
        },
      });
    } catch (err) {
      console.error('[household-visit] save failed', err);
      setError(t('modules.surveySaveFailed'));
    } finally {
      setSaving(false);
    }
  }, [id, household, members, checks, consent, water, toilet, fever, ashaId, t, toast, router]);

  if (status === 'failed') {
    return (
      <Screen title={t('asha.householdVisit')} back withTabBar={false}>
        <ErrorState
          message={t('errors.dataNotFound.message')}
          retryLabel={t('common.retry')}
          onRetry={() => void load()}
        />
      </Screen>
    );
  }

  if (status === 'missing' || !household) {
    return (
      <Screen title={t('asha.householdVisit')} back withTabBar={false}>
        <EmptyState
          icon="inbox"
          title={t('errors.dataNotFound.headline')}
          description={t('errors.dataNotFound.message')}
          actionLabel={t('common.back')}
          onActionPress={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('asha.householdVisit')} subtitle={household.hhid ?? undefined} back withTabBar={false}>
      <View className="gap-5">
        <View className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
          <View className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />
          <View className="gap-2 pl-2">
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text className="font-caption text-caption text-on-surface-variant">
                  {t('asha.householdIdLabel')}
                </Text>
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                  {household.hhid ?? '—'}
                </Text>
              </View>
              <Chip tone="success" size="md">
                {t('asha.active')}
              </Chip>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon name="users" size={18} color={colors.outline} />
              <Text className="min-w-0 flex-1 text-body-md text-body-md text-on-surface" numberOfLines={1}>
                <Text className="font-bold">{t('asha.head')}:</Text> {household.head_name ?? '—'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon name="mapPin" size={18} color={colors.outline} />
              <Text className="min-w-0 flex-1 text-body-md text-body-md text-on-surface" numberOfLines={2}>
                {household.address ?? '—'}
              </Text>
            </View>
          </View>
        </View>

        <View>
          <SectionHeader
            title={t('asha.familyMembers')}
            action={<Chip tone="neutral">{`${members.length} ${t('asha.members')}`}</Chip>}
          />
          {members.length === 0 ? (
            <Text className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t('asha.noMembersRecorded')}
            </Text>
          ) : (
            <View className="gap-3">
              <Text className="font-caption text-caption text-on-surface-variant">
                {t('asha.memberChecksHint')}
              </Text>
              {members.map((member) => {
                const value = checks[member.id] ?? 'ok';
                return (
                  <View
                    key={member.id}
                    className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="min-w-0 flex-1 flex-row items-center gap-3">
                        <View
                          className={cx(
                            'h-touch-target w-touch-target items-center justify-center rounded-full',
                            member.is_pregnant > 0 ? 'bg-tertiary-container' : 'bg-surface-container-high',
                          )}
                        >
                          <Icon
                            name={member.is_pregnant > 0 ? 'heart' : 'users'}
                            size={20}
                            color={member.is_pregnant > 0 ? colors.tertiary : colors.primary}
                          />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-body-md text-body-md font-bold text-on-surface" numberOfLines={1}>
                            {member.full_name}
                          </Text>
                          <Text className="font-caption text-caption text-on-surface-variant">
                            {member.gender ?? '—'},{' '}
                            {memberAge(member, t('asha.ageYearsShort'), t('asha.ageMonthsShort'))}
                          </Text>
                        </View>
                      </View>
                      {member.is_pregnant > 0 ? <Chip tone="info">{t('asha.highRisk')}</Chip> : null}
                    </View>
                    <View className="mt-3 flex-row gap-2">
                      {CHECK_OPTIONS.map((option) => {
                        const selected = value === option;
                        return (
                          <Pressable
                            key={option}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={
                              option === 'ok' ? t('asha.checkOk') : t('asha.checkConcern')
                            }
                            onPress={() => setChecks((prev) => ({ ...prev, [member.id]: option }))}
                            className={cx(
                              'h-touch-target min-w-0 flex-1 items-center justify-center rounded-xl border py-3',
                              selected
                                ? option === 'ok'
                                  ? 'border-primary bg-primary-container'
                                  : 'border-error bg-error-container'
                                : 'border-outline-variant bg-surface-container-lowest',
                            )}
                          >
                            <Text
                              className={cx(
                                'font-label-md text-label-md',
                                selected ? 'font-bold' : 'text-on-surface-variant',
                                selected
                                  ? option === 'ok'
                                    ? 'text-on-primary-container'
                                    : 'text-on-error-container'
                                  : '',
                              )}
                            >
                              {option === 'ok' ? t('asha.checkOk') : t('asha.checkConcern')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View>
          <SectionHeader
            title={t('asha.householdSurvey')}
            action={<Chip tone="neutral">{t('asha.pastVisits', { count: pastVisits })}</Chip>}
          />
          <View className="gap-3">
            <SwitchRow
              label={t('asha.consentLabel')}
              hint={t('asha.consentHint')}
              value={consent}
              onChange={setConsent}
            />
            <SwitchRow
              label={t('asha.cleanWater')}
              hint={t('asha.cleanWaterHint')}
              value={water}
              onChange={setWater}
            />
            <SwitchRow
              label={t('asha.functionalToilet')}
              hint={t('asha.toiletHint')}
              value={toilet}
              onChange={setToilet}
            />

            <View className="gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <View>
                <Text className="font-body-md text-body-md font-bold text-on-surface">{t('asha.recentFever')}</Text>
                <Text className="mt-1 font-caption text-caption text-on-surface-variant">{t('asha.feverHint')}</Text>
              </View>
              <View className="flex-row gap-4">
                {FEVER_OPTIONS.map((option) => {
                  const selected = fever === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option === 'yes' ? t('common.yes') : t('common.no')}
                      onPress={() => setFever(option)}
                      className={cx(
                        'h-touch-target min-w-0 flex-1 items-center justify-center rounded-xl border py-4',
                        selected
                          ? 'border-primary bg-primary-container'
                          : 'border-outline-variant bg-surface-container-lowest',
                      )}
                    >
                      <Text
                        className={cx(
                          'font-label-md text-label-md',
                          selected ? 'font-bold text-on-primary-container' : 'text-on-surface-variant',
                        )}
                      >
                        {option === 'yes' ? t('common.yes') : t('common.no')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {error ? (
          <Text className="rounded-lg bg-error-container px-3 py-2 font-body-md text-body-md text-on-error-container">
            {error}
          </Text>
        ) : null}

        <Button
          label={t('asha.completeVisit')}
          icon="checkCircle"
          shape="rounded"
          full
          loading={saving}
          disabled={saving}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <View className="min-w-0 flex-1 pr-2">
        <Text className="font-body-md text-body-md font-bold text-on-surface">{label}</Text>
        <Text className="mt-1 font-caption text-caption text-on-surface-variant">{hint}</Text>
      </View>
      <Toggle value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
