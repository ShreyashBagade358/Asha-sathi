import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useLocalization } from '@/hooks/useLocalization';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/ui.store';
import { useASHAStore } from '@/stores/asha.store';
import { householdService } from '@/services/household.service';
import { relationshipLabel, relationshipOptions } from '@/lib/relationship';
import { referralService } from '@/services/referral.service';
import { pregnancyService } from '@/services/pregnancy.service';
import { beneficiaryService } from '@/services/beneficiary.service';
import { PatientHistoryTimeline } from '@/components/patient/PatientHistoryTimeline';
import { Icon } from '@/components/common/Icons';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState, getErrorMessage } from '@/components/common/ErrorState';
import { beneficiaryToPatient } from '@/pages/asha/patientView';
import type { RiskLevel } from '@/pages/asha/mockData';

type Tab = 'summary' | 'history' | 'maternal' | 'vaccination' | 'referrals';

import { RISK_STYLES } from '@/lib/risk';

// Use the centralized risk styles
const riskStyles: Record<RiskLevel, string> = {
  low: RISK_STYLES.low.bg + ' ' + RISK_STYLES.low.text,
  medium: RISK_STYLES.medium.bg + ' ' + RISK_STYLES.medium.text,
  high: RISK_STYLES.high.bg + ' ' + RISK_STYLES.high.text,
};

function formatReferralDate(value: string | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PatientDetailsAshaSathi() {
  const { t } = useLocalization();
  const { user } = useAuth();
  const { addToast } = useUIStore();
  const patients = useASHAStore((s) => s.patients);
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('summary');

  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberGender, setMemberGender] = useState('');
  const [memberAge, setMemberAge] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');
  const [memberSaving, setMemberSaving] = useState(false);

  // Link this (unattached) patient into one of the worker's households.
  const [showLink, setShowLink] = useState(false);
  const [linkHouseholdId, setLinkHouseholdId] = useState('');

  const addMemberMutation = useMutation({
    mutationFn: (name: string) =>
      householdService.addMember(patient!.householdId!, {
        fullName: name,
        gender: (memberGender || undefined) as
          'male' | 'female' | 'transgender' | 'other' | undefined,
        ageYears: memberAge.trim() === '' ? undefined : Number(memberAge),
        relationshipToHead: memberRelationship || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['household-members', patient?.householdId] });
      void queryClient.invalidateQueries({ queryKey: ['household-detail', patient?.householdId] });
      resetMemberForm();
      setShowAdd(false);
      addToast('success', t('asha.addMemberSaved'));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : t('common.errorMsg');
      addToast('error', msg);
      setMemberSaving(false);
    },
  });

  const householdsQuery = useQuery({
    queryKey: ['households', 'link-picker'],
    queryFn: () => householdService.listHouseholds({ page: 1, pageSize: 100 }),
    enabled: showLink,
  });

  const linkHouseholdMutation = useMutation({
    mutationFn: (householdId: string) => householdService.linkMember(householdId, patient!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['beneficiary', id] });
      void queryClient.invalidateQueries({ queryKey: ['household-members'] });
      setShowLink(false);
      setLinkHouseholdId('');
      addToast('success', t('asha.linkHouseholdSaved'));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : t('common.errorMsg');
      addToast('error', msg);
    },
  });

  function resetMemberForm() {
    setMemberName('');
    setMemberGender('');
    setMemberAge('');
    setMemberRelationship('');
    setMemberSaving(false);
  }

  function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (memberSaving) return;
    if (memberName.trim().length < 2) {
      addToast('error', t('asha.errMemberNameRequired'));
      return;
    }
    const age = memberAge.trim();
    if (age && (!/^\d{1,2}$/.test(age) || Number(age) > 120)) {
      addToast('error', t('common.errorMsg'));
      return;
    }
    setMemberSaving(true);
    addMemberMutation.mutate(memberName.trim());
  }

  // Locally-registered rows live in the browser store; anything else is a
  // server id and has to come from the API. Falling back to `patients[0]`
  // would render the wrong person for an unknown id.
  const storePatient = patients.find((p) => p.id === id);

  const patientQuery = useQuery({
    queryKey: ['beneficiary', id],
    queryFn: () => beneficiaryService.getBeneficiaryById(id ?? ''),
    enabled: !storePatient && Boolean(id),
    retry: (failureCount, err) =>
      !(isAxiosError(err) && err.response?.status === 404) && failureCount < 2,
  });

  const patient = storePatient ?? (patientQuery.data ? beneficiaryToPatient(patientQuery.data) : undefined);

  const { data: memberData, isLoading: membersLoading } = useQuery({
    queryKey: ['household-members', patient?.householdId],
    queryFn: () => householdService.listHouseholdMembers(patient!.householdId!, { pageSize: 50 }),
    enabled: Boolean(patient?.householdId),
  });
  const householdMembers = memberData?.items ?? [];

  const { data: referralData, isLoading: referralsLoading } = useQuery({
    queryKey: ['patient-referrals', patient?.beneficiaryId],
    queryFn: () =>
      referralService.listReferrals({ beneficiaryId: patient!.beneficiaryId!, pageSize: 50 }),
    enabled: Boolean(patient?.beneficiaryId),
  });
  const referralLog = referralData?.items ?? [];

  const { data: pregnancyData, isLoading: pregnancyLoading } = useQuery({
    queryKey: ['patient-pregnancy', patient?.beneficiaryId],
    queryFn: () =>
      pregnancyService.listPregnancies({
        status: 'all',
        beneficiaryId: patient!.beneficiaryId!,
        pageSize: 10,
      }),
    enabled: Boolean(patient?.beneficiaryId),
  });
  const activePregnancy = (pregnancyData?.items ?? []).find((p) => p.status === 'ongoing') ?? null;

  const { data: ancVisits } = useQuery({
    queryKey: ['patient-anc', activePregnancy?.id],
    queryFn: () => pregnancyService.listANCVisits(activePregnancy!.id),
    enabled: Boolean(activePregnancy?.id),
  });
  const ancCount = ancVisits?.length ?? 0;

  if (!storePatient && patientQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <LoadingState label={t('common.loading')} />
      </div>
    );
  }

  if (
    !storePatient &&
    isAxiosError(patientQuery.error) &&
    patientQuery.error.response?.status === 404
  ) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState
          icon="person_search"
          title={t('asha.patientNotFound')}
          description={t('asha.patientNotFoundDesc')}
          action={
            <Link
              to="/asha/patients"
              className="mt-2 inline-flex h-touch-target items-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
            >
              <Icon name="chevronLeft" size={18} />
              {t('asha.backToPatients')}
            </Link>
          }
        />
      </div>
    );
  }

  if (!storePatient && patientQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState
          message={getErrorMessage(patientQuery.error)}
          onRetry={() => patientQuery.refetch()}
        />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState message={getErrorMessage(patientQuery.error)} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: t('asha.tabSummary') },
    { key: 'history', label: t('asha.tabHistory') },
    { key: 'maternal', label: t('asha.tabMaternal') },
    { key: 'vaccination', label: t('asha.tabVaccination') },
    { key: 'referrals', label: t('asha.tabReferrals') },
  ].filter((item): item is { key: Tab; label: string } => {
    if (item.key === 'maternal') {
      return patient.gender?.toLowerCase() === 'female';
    }
    return true;
  });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-headline-lg text-headline-lg font-bold text-on-surface">
            {patient.name}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-label-md text-caption font-semibold ${riskStyles[patient.risk]}`}
            >
              <Icon name="alert" size={14} />
              {t(
                patient.risk === 'high'
                  ? 'asha.riskHighLabel'
                  : patient.risk === 'medium'
                    ? 'asha.riskMediumLabel'
                    : 'asha.riskLowLabel',
              )}
            </span>
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            {t('asha.regId', { abha: patient.abhaId })} |{' '}
            {t('asha.regDate', { date: patient.registeredAt })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addToast('info', t('asha.editToast'))}
            className="flex items-center gap-2 rounded-full border border-primary px-4 py-2 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-low"
          >
            <Icon name="edit" size={18} />
            {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={() => addToast('success', t('asha.referToast'))}
            className="flex items-center gap-2 rounded-full bg-error px-4 py-2 font-label-md text-label-md font-semibold text-on-error shadow-sm transition-opacity hover:bg-opacity-90"
          >
            <Icon name="heart" size={18} />
            {t('asha.referSpecialist')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-outline-variant">
        <div className="flex min-w-max gap-6 px-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`whitespace-nowrap border-b-2 pb-2 font-label-md text-label-md font-semibold transition-colors ${
                tab === item.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'summary' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-outline-variant bg-surface p-5 shadow-card md:flex-row">
              <span
                className={`absolute bottom-0 left-0 top-0 w-2 ${patient.risk === 'high' ? 'bg-error' : patient.risk === 'medium' ? 'bg-[#F59E0B]' : 'bg-secondary'}`}
              />
              <div className="flex shrink-0 justify-center pl-3 md:justify-start">
                <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-primary-container font-display-lg text-display-lg font-bold text-on-primary-container shadow-sm md:h-32 md:w-32">
                  {patient.name.charAt(0)}
                </span>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3 self-center">
                {[
                  { label: t('asha.age'), value: `${patient.age} ${t('asha.years')}` },
                  { label: t('asha.gender'), value: patient.gender },
                  { label: t('asha.bloodGroup'), value: patient.bloodGroup },
                  { label: t('asha.primaryLanguage'), value: t('asha.hindi') },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="font-caption text-caption text-on-surface-variant">{row.label}</p>
                    <p className="font-body-md text-body-md font-semibold text-on-surface">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
              <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
                <Icon name="fileText" size={20} className="text-primary" />
                {t('asha.contactDetails')}
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Icon name="phone" size={18} className="mt-1 text-on-surface-variant" />
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {t('asha.phoneNumber')}
                    </p>
                    <p className="font-body-md text-body-md text-on-surface">{patient.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="mapPin" size={18} className="mt-1 text-on-surface-variant" />
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">
                      {t('asha.address')}
                    </p>
                    <p className="font-body-md text-body-md text-on-surface">{patient.address}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
              <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-error">
                <Icon name="activity" size={20} />
                {t('asha.activeConditions')}
              </h3>
              {patient.activeConditions.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('asha.noConditions')}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {patient.activeConditions.map((condition) => (
                    <li
                      key={condition}
                      className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container p-3"
                    >
                      <span className="font-body-md text-body-md font-semibold text-on-surface">
                        {condition}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
                  <Icon name="users" size={20} className="text-primary" />
                  {t('asha.householdMembers')}
                </h3>
                <button
                  type="button"
                  aria-label={t('asha.addMember')}
                  onClick={() => setShowAdd(true)}
                  className="rounded-full p-1 text-primary transition-colors hover:bg-primary-container/20"
                >
                  <Icon name="plus" size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {!patient?.householdId ? (
                  <div className="flex flex-col gap-3">
                    <p className="rounded-lg border border-outline-variant/50 bg-surface-container p-3 font-caption text-caption text-on-surface-variant">
                      {t('asha.patientNoHousehold')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowLink(true)}
                      className="flex h-touch-target items-center justify-center gap-2 rounded-full border border-primary px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-primary-container/20"
                    >
                      <Icon name="plus" size={18} />
                      {t('asha.linkToHousehold')}
                    </button>
                  </div>
                ) : membersLoading ? (
                  <p className="p-3 font-caption text-caption text-on-surface-variant">
                    {t('asha.loadingMembers')}
                  </p>
                ) : householdMembers.length === 0 ? (
                  <p className="rounded-lg border border-outline-variant/50 bg-surface-container p-3 font-caption text-caption text-on-surface-variant">
                    {t('asha.noMembersRecorded')}
                  </p>
                ) : (
                  householdMembers.map((member) => (
                    <div
                      key={member.id}
                      className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-lowest"
                    >
                      {member.isPregnant ? (
                        <span className="absolute bottom-0 left-0 top-0 w-1 bg-secondary" />
                      ) : null}
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container font-label-md font-bold text-primary">
                        {(member.fullName.charAt(0) || '?').toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <p className="font-label-md text-label-md text-on-surface">
                          {member.fullName}
                        </p>
                        <p className="font-caption text-caption text-on-surface-variant">
                          {[
                            member.relationshipToHead
                              ? relationshipLabel(member.relationshipToHead, t)
                              : null,
                            member.gender,
                            member.ageYears ? `${member.ageYears} yrs` : null,
                            member.isPregnant ? t('asha.pregnantLabel') : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || t('common.notRecorded')}
                        </p>
                      </div>
                      {member.isPregnant ? (
                        <Icon name="checkCircle" size={18} className="text-secondary" />
                      ) : (
                        <Icon name="chevronRight" size={18} className="text-on-surface-variant" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
              <p className="mb-2 font-caption text-caption text-on-surface-variant">
                {t('asha.assignedWorker')}
              </p>
              <div className="flex items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-label-lg font-bold text-on-primary">
                  {(user?.fullName.charAt(0) || '?').toUpperCase()}
                </span>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">
                    {user?.fullName ?? t('common.notRecorded')}
                  </p>
                  <p className="font-caption text-caption text-on-surface-variant">
                    {[user?.phcName, user?.districtName].filter(Boolean).join(', ') ||
                      t('common.notRecorded')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <PatientHistoryTimeline
            beneficiaryId={patient.beneficiaryId ?? patient.id}
            title={t('asha.medicalHistory')}
          />
        </div>
      ) : null}

      {tab === 'maternal' ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="heart" size={20} className="text-primary" />
            {t('asha.maternalHealth')}
          </h3>
          {pregnancyLoading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('asha.loadingMaternal')}
            </p>
          ) : activePregnancy ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: t('asha.lmp'), value: formatReferralDate(activePregnancy.lmp) },
                { label: t('asha.edd'), value: formatReferralDate(activePregnancy.edd) },
                { label: t('asha.ancVisits'), value: `${ancCount} / 8` },
                {
                  label: t('asha.gravidaPara'),
                  value: `G${activePregnancy.gravida} P${activePregnancy.para}`,
                },
                { label: t('asha.pregnancyStatus'), value: activePregnancy.status },
                {
                  label: t('asha.riskLevel'),
                  value:
                    activePregnancy.hrpLevel ??
                    (activePregnancy.highRisk ? t('asha.high') : t('asha.low')),
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-outline-variant/50 bg-surface-container p-4"
                >
                  <p className="font-caption text-caption text-on-surface-variant">{row.label}</p>
                  <p className="mt-1 font-headline-md text-headline-md font-semibold text-on-surface">
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('asha.notPregnant')}
            </p>
          )}
        </div>
      ) : null}

      {tab === 'vaccination' ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="checkCircle" size={20} className="text-primary" />
            {t('asha.vaccinationStatus')}
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('asha.vaccinationHint')}
          </p>
          <Link
            to={`/asha/patients/${patient.id}/immunization`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
          >
            <Icon name="calendar" size={18} />
            {t('asha.viewSchedule')}
          </Link>
        </div>
      ) : null}

      {tab === 'referrals' ? (
        <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-headline-md text-headline-md font-semibold text-on-surface">
            <Icon name="activity" size={20} className="text-primary" />
            {t('asha.referrals')}
          </h3>
          <div className="flex flex-col gap-3">
            {referralsLoading ? (
              <p className="font-caption text-caption text-on-surface-variant">
                {t('asha.loadingReferrals')}
              </p>
            ) : referralLog.length === 0 ? (
              <EmptyState
                title={t('asha.noReferralsForPatient')}
                description={t('asha.noReferralsForPatientDesc')}
                icon="referral"
              />
            ) : (
              referralLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container p-4"
                >
                  <Icon name="chevronRight" size={18} className="mt-1 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-body-md text-body-md font-semibold text-on-surface">
                        {entry.toFacility || t('asha.refToUnspecified')}
                      </p>
                      <span className="whitespace-nowrap font-caption text-caption text-on-surface-variant">
                        {formatReferralDate(entry.referredAt)}
                      </span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {entry.reason || t('common.notRecorded')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {showAdd && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
        >
          <form
            className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-5 shadow-card"
            onSubmit={handleAddMember}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="add-member-title"
                className="font-headline-md text-headline-md font-semibold text-on-surface"
              >
                {t('asha.addMemberTitle')}
              </h2>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => {
                  setShowAdd(false);
                  resetMemberForm();
                }}
                className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="member_name"
                >
                  {t('asha.fullName')} *
                </label>
                <input
                  id="member_name"
                  className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-md text-label-md text-on-surface-variant"
                    htmlFor="member_gender"
                  >
                    {t('asha.gender')}
                  </label>
                  <select
                    id="member_gender"
                    className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={memberGender}
                    onChange={(e) => setMemberGender(e.target.value)}
                  >
                    <option value="">{t('common.notRecorded')}</option>
                    <option value="male">{t('asha.male')}</option>
                    <option value="female">{t('asha.female')}</option>
                    <option value="other">{t('asha.other')}</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="font-label-md text-label-md text-on-surface-variant"
                    htmlFor="member_age"
                  >
                    {t('asha.memberAgeYears')}
                  </label>
                  <input
                    id="member_age"
                    className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    inputMode="numeric"
                    maxLength={3}
                    type="text"
                    value={memberAge}
                    onChange={(e) => setMemberAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  className="font-label-md text-label-md text-on-surface-variant"
                  htmlFor="member_relationship"
                >
                  {t('asha.relationshipToHead')}
                </label>
                <select
                  id="member_relationship"
                  className="h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={memberRelationship}
                  onChange={(e) => setMemberRelationship(e.target.value)}
                >
                  <option value="">{t('asha.relationshipPlaceholder')}</option>
                  {relationshipOptions(t).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="flex h-touch-target items-center justify-center rounded-full px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                  onClick={() => {
                    setShowAdd(false);
                    resetMemberForm();
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={memberSaving}
                  className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  <Icon name="plus" size={18} />
                  {memberSaving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showLink && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-household-title"
        >
          <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="link-household-title"
                className="font-headline-md text-headline-md font-semibold text-on-surface"
              >
                {t('asha.linkHouseholdTitle')}
              </h2>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => {
                  setShowLink(false);
                  setLinkHouseholdId('');
                }}
                className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <SearchableSelect
                id="link_household"
                label={t('asha.selectHousehold')}
                value={linkHouseholdId}
                onChange={setLinkHouseholdId}
                placeholder={t('asha.selectHousehold')}
                options={householdsQuery.data?.items?.map((household) => ({
                  id: household.id,
                  name: [household.householdId, household.headName, household.village].filter(Boolean).join(' — ') || household.id,
                })) ?? []}
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="flex h-touch-target items-center justify-center rounded-full px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-highest"
                  onClick={() => {
                    setShowLink(false);
                    setLinkHouseholdId('');
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={!linkHouseholdId || linkHouseholdMutation.isPending}
                  onClick={() => linkHouseholdMutation.mutate(linkHouseholdId)}
                  className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
                >
                  <Icon name="checkCircle" size={18} />
                  {linkHouseholdMutation.isPending ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
