import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, SectionHeader } from '@/components/ui/Card';
import { Chip, chipToneColor, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { Modal } from '@/components/ui/Modal';
import { RiskStrip, type RiskLevel } from '@/components/ui/RiskStrip';
import { SelectField, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import {
  getHouseholdCard,
  listHouseholdMemberCards,
  listHouseholdVisitRecords,
  type HouseholdCard,
  type HouseholdMemberCard,
  type HouseholdVisitRecord,
} from '@/db/clinical';
import { enqueue, insertLocalBeneficiary } from '@/db/database';
import { useLocalization } from '@/i18n/useLocalization';
import { isCurrentlyOnline, scheduleSync } from '@/sync/network';
import { colors } from '@/theme';
import { cx } from '@/cx';

type Status = 'loading' | 'ready' | 'missing' | 'failed';

const GENDER_LABEL: Record<string, string> = {
  female: 'asha.female',
  male: 'asha.male',
  other: 'asha.other',
  transgender: 'asha.other',
};

function genderLabel(gender: string | null | undefined, t: (key: string) => string): string {
  if (!gender) return '—';
  const key = GENDER_LABEL[gender];
  return key ? t(key) : gender;
}

function newId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function riskOf(members: HouseholdMemberCard[]): RiskLevel {
  const levels = members.map((m) => String(m.risk_level ?? '').toLowerCase());
  if (levels.some((l) => l === 'high' || l === 'high_risk')) return 'high';
  if (levels.some((l) => l === 'medium' || l === 'moderate')) return 'medium';
  return 'none';
}

const RISK_CHIP: Record<string, { labelKey: string; tone: ChipTone }> = {
  high: { labelKey: 'asha.riskHighLabel', tone: 'error' },
  high_risk: { labelKey: 'asha.riskHighLabel', tone: 'error' },
  medium: { labelKey: 'asha.riskMediumLabel', tone: 'warning' },
  moderate: { labelKey: 'asha.riskMediumLabel', tone: 'warning' },
  low: { labelKey: 'asha.riskLowLabel', tone: 'success' },
};

export default function HouseholdDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useLocalization();
  const router = useRouter();
  const toast = useToast();

  const [status, setStatus] = useState<Status>('loading');
  const [household, setHousehold] = useState<HouseholdCard | null>(null);
  const [members, setMembers] = useState<HouseholdMemberCard[]>([]);
  const [visits, setVisits] = useState<HouseholdVisitRecord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
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
      const [card, memberRows, visitRows] = await Promise.all([
        getHouseholdCard(id),
        listHouseholdMemberCards(id),
        listHouseholdVisitRecords(id),
      ]);
      if (!card) {
        setHousehold(null);
        setStatus('missing');
        return;
      }
      setHousehold(card);
      setMembers(memberRows);
      setVisits(visitRows);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMember() {
    if (!id || !household) return;
    // The server enforces these too, but a rejected push would leave the
    // member on the device and the outbox stuck on a row it cannot fix.
    if (name.trim().length < 2) {
      setError(t('asha.errNameRequired'));
      return;
    }
    if (phone.trim() && !/^\d{10}$/.test(phone.trim())) {
      setError(t('asha.errPhoneRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const memberId = newId();
      const ageYears = age.trim() === '' ? null : Number(age);
      const data = {
        id: memberId,
        beneficiary_id: `BEN-${memberId.slice(-8).toUpperCase()}`,
        household_id: id,
        abha_id: null,
        full_name: name.trim(),
        gender,
        date_of_birth: null,
        age_years: ageYears !== null && Number.isFinite(ageYears) ? ageYears : null,
        phone: phone.trim() || null,
      };
      await insertLocalBeneficiary({
        id: memberId,
        beneficiaryId: data.beneficiary_id,
        householdId: id,
        fullName: data.full_name,
        gender,
        dateOfBirth: '',
        phone: phone.trim(),
        ageYears: data.age_years,
      });
      await enqueue({
        clientRequestId: `create-beneficiary-${memberId}`,
        entity: 'beneficiaries',
        operation: 'create',
        recordId: memberId,
        version: 1,
        data,
      });
      if (isCurrentlyOnline()) scheduleSync(300);
      setName('');
      setAge('');
      setPhone('');
      setShowAdd(false);
      toast.toast(t('asha.patientSavedToast'), 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errorMsg'));
    } finally {
      setSaving(false);
    }
  }

  if (status === 'failed') {
    return (
      <Screen title={t('asha.householdVisit')} back withTabBar={false}>
        <ErrorState message={t('common.errorMsg')} retryLabel={t('common.retry')} onRetry={() => void load()} />
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

  const risk = riskOf(members);

  return (
    <Screen
      title={household.hhid ?? t('asha.households')}
      subtitle={household.head_name ?? undefined}
      back
      withTabBar={false}
    >
      <View className="gap-5">
        <RiskStrip risk={risk} variant="lg">
          <View className="gap-2">
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text className="font-caption text-caption text-on-surface-variant">{t('asha.householdIdLabel')}</Text>
                <Text className="font-headline-md text-headline-md font-semibold text-on-surface" numberOfLines={1}>
                  {household.hhid ?? '—'}
                </Text>
              </View>
              <Chip tone="success" size="md">
                {t('common.active')}
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
            <View className="flex-row flex-wrap items-center gap-2">
              <Chip tone="neutral">{t('asha.familySize', { count: household.members })}</Chip>
              {household.pregnant > 0 ? (
                <Chip tone="success" icon={<Icon name="heart" size={12} color={chipToneColor.success} />}>
                  {t('asha.pregnantCount', { count: household.pregnant })}
                </Chip>
              ) : null}
            </View>
          </View>
        </RiskStrip>

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
            <Card>
              <View>
                {members.map((member, index) => {
                  const level = String(member.risk_level ?? '').toLowerCase();
                  const chip = RISK_CHIP[level];
                  return (
                    <ListRow
                      key={member.id}
                      avatar={<Icon name={member.is_pregnant > 0 ? 'heart' : 'users'} size={20} />}
                      avatarTone={member.is_pregnant > 0 ? 'tertiary' : level.startsWith('high') ? 'error' : 'primary'}
                      title={member.full_name}
                      subtitle={`${genderLabel(member.gender, t)}, ${ageLabel(member, t('asha.ageYearsShort'), t('asha.ageMonthsShort'))}`}
                      meta={member.edd ? `${t('asha.edd')}: ${member.edd}` : undefined}
                      right={
                        member.is_pregnant > 0 ? (
                          <Chip tone="info">{t('asha.highRisk')}</Chip>
                        ) : chip ? (
                          <Chip tone={chip.tone}>{t(chip.labelKey)}</Chip>
                        ) : undefined
                      }
                      divider
                      isLast={index === members.length - 1}
                    />
                  );
                })}
              </View>
            </Card>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('asha.addFamilyMember')}
            onPress={() => setShowAdd(true)}
            className="mt-3 h-12 w-full flex-row items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary active:scale-95"
          >
            <Icon name="plus" size={18} color={colors.primary} />
            <Text className="font-label-md text-label-md font-bold text-primary">{t('asha.addFamilyMember')}</Text>
          </Pressable>
        </View>

        {visits.length > 0 ? (
          <View>
            <SectionHeader title={t('asha.householdSurvey')} />
            <Card>
              <View>
                {visits.map((visit, index) => (
                  <ListRow
                    key={visit.id}
                    avatar={<Icon name="checkCircle" size={20} />}
                    avatarTone="secondary"
                    title={visit.visited_at ?? '—'}
                    subtitle={visitSubtitle(visit, t)}
                    right={
                      <Chip tone={visit.status === 'verified' ? 'success' : 'neutral'}>
                        {visit.status === 'verified' ? t('modules.surveyVerified') : t('modules.surveySubmitted')}
                      </Chip>
                    }
                    divider
                    isLast={index === visits.length - 1}
                  />
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        <Button
          label={t('asha.startVisit')}
          icon="activity"
          shape="rounded"
          full
          onPress={() => router.push(`/household/${household.id}/visit`)}
        />
      </View>

      <Modal visible={showAdd} onClose={() => setShowAdd(false)} title={t('asha.addFamilyMember')}>
        <View className="gap-3">
          <TextField
            label={`${t('asha.fullName')} *`}
            value={name}
            onChangeText={setName}
            placeholder={t('asha.legalNamePlaceholder')}
            autoCapitalize="words"
          />
          <SelectField
            label={t('asha.gender')}
            value={gender}
            onChange={setGender}
            placeholder={t('asha.selectGender')}
            options={[
              { label: t('asha.female'), value: 'female' },
              { label: t('asha.male'), value: 'male' },
              { label: t('asha.other'), value: 'other' },
            ]}
          />
          <TextField
            label={t('asha.age')}
            value={age}
            onChangeText={(next) => setAge(next.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="0"
          />
          <TextField
            label={t('asha.mobileNumber')}
            value={phone}
            onChangeText={(next) => setPhone(next.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            errorText={phone && !/^\d{10}$/.test(phone) ? t('asha.errPhoneRequired') : undefined}
          />
          {error ? (
            <Text className="font-body-md text-body-md text-on-error-container">{error}</Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button label={t('common.cancel')} variant="ghost" shape="pill" onPress={() => setShowAdd(false)} />
            <Button
              label={t('common.save')}
              icon="check"
              shape="pill"
              loading={saving}
              disabled={saving || !name.trim()}
              onPress={() => void addMember()}
              className="flex-1"
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ageLabel(member: HouseholdMemberCard, yearsUnit: string, monthsUnit: string): string {
  if (member.age_years !== null) return `${member.age_years} ${yearsUnit}`;
  if (member.age_months !== null) return `${member.age_months} ${monthsUnit}`;
  return '—';
}

function visitSubtitle(visit: HouseholdVisitRecord, t: (key: string) => string): string {
  const fever = visit.answers.recent_fever;
  if (fever === 'yes' || fever === 'no') {
    return `${t('asha.recentFever')}: ${fever === 'yes' ? t('common.yes') : t('common.no')}`;
  }
  return t('asha.householdSurvey');
}
