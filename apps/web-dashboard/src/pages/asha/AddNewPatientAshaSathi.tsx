import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ASHAButton, ASHACard } from 'asha-design-system';
import { useLocalization } from '@/hooks/useLocalization';
import { useUIStore } from '@/stores/ui.store';
import { useASHAStore } from '@/stores/asha.store';
import { Icon } from '@/components/common/Icons';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  apiErrorMessage,
  patientService,
  type RegisteredPatient,
} from '@/services/patient.service';
import { beneficiaryService } from '@/services/beneficiary.service';
import { householdService } from '@/services/household.service';
import { PhotoUploadField } from '@/components/common/PhotoUploadField';
import { ashaService } from '@/services/asha.service';
import { configService } from '@/services/config.service';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { relationshipOptions } from '@/lib/relationship';
import { useAuth } from '@/hooks/useAuth';
import { NOT_RECORDED } from '@/hooks/usePatientProfile';
import type { RiskLevel } from '@/pages/asha/mockData';

interface FormState {
  name: string;
  abhaId: string;
  mobile: string;
  dob: string;
  gender: string;
  state: string;
  district: string;
  village: string;
  householdId: string;
  relationship: string;
  bloodGroup: string;
  ashaWorker: string;
  risk: RiskLevel;
  notes: string;
}

import { RISK_STYLES } from '@/lib/risk';

const RISK_OPTIONS: { value: RiskLevel; label: string; dot: string; ring: string }[] = [
  {
    value: 'low',
    label: 'asha.riskLow',
    dot: 'h-3 w-3 rounded-full border ' + RISK_STYLES.low.rail + ' ' + RISK_STYLES.low.chip.bg,
    ring: 'peer-checked:border-' + RISK_STYLES.low.rail.replace('bg-', '') + ' peer-checked:bg-' + RISK_STYLES.low.rail.replace('bg-', ''),
  },
  {
    value: 'medium',
    label: 'asha.riskMedium',
    dot: 'h-3 w-3 rounded-full border-[orange] bg-[#F59E0B]/15',
    ring: 'peer-checked:border-[#F59E0B] peer-checked:bg-[#F59E0B]',
  },
  {
    value: 'high',
    label: 'asha.riskHigh',
    dot: 'h-3 w-3 rounded-full border-error ' + RISK_STYLES.high.chip.bg,
    ring: 'peer-checked:border-error peer-checked:bg-error',
  },
];

const inputCls =
  'h-touch-target w-full rounded-lg border border-outline bg-surface px-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
const selectWrap =
  'absolute inset-y-0 right-0 flex items-center pr-4 text-on-surface-variant pointer-events-none';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="font-caption text-caption text-error" role="alert">
      {message}
    </p>
  );
}

/** ABHA preset pattern: 14 digits shown as 12-3456-7890-1234. */
function formatAbha(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14);
  const parts = [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10), digits.slice(10, 14)];
  return parts.filter(Boolean).join('-');
}

export default function AddNewPatientAshaSathi() {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const { addPatient } = useASHAStore();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const phcId = user?.phcId;

  const { data: ashaData } = useQuery({
    queryKey: ['ashas', 'select', 1],
    queryFn: () => ashaService.listASHAs({ page: 1, pageSize: 50 }),
  });
  const ashaWorkers = ashaData?.items ?? [];

  const { data: villageData, isLoading: villagesLoading } = useQuery({
    queryKey: ['villages', phcId],
    queryFn: () => configService.getVillages(phcId!),
    enabled: Boolean(phcId),
  });
  const phcVillages = useMemo(() => villageData ?? [], [villageData]);

  const [form, setForm] = useState<FormState>({
    name: '',
    abhaId: '',
    mobile: '',
    dob: '',
    gender: '',
    state: '',
    district: '',
    village: '',
    householdId: '',
    relationship: '',
    bloodGroup: '',
    ashaWorker: '',
    risk: 'low',
    notes: '',
  });
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [creds, setCreds] = useState<RegisteredPatient | null>(null);
  const [copied, setCopied] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // --- Geography cascade: state -> district -> village -> household --------
  const { data: myRegion } = useQuery({
    queryKey: ['my-region'],
    queryFn: () => configService.getMyRegion(),
  });
  const { data: stateData, isLoading: statesLoading } = useQuery({
    queryKey: ['states'],
    queryFn: () => configService.getStates(),
  });
  const states = stateData ?? [];
  const { data: districtData, isLoading: districtsLoading } = useQuery({
    queryKey: ['districts', form.state],
    queryFn: () => configService.getDistricts(form.state),
    enabled: Boolean(form.state),
  });
  const districts = districtData ?? [];

  // The worker's own region villages carry the district id (one round trip);
  // the PHC list stays as the fallback when there is no personal assignment.
  const villages = useMemo(() => {
    const regionVillages = myRegion?.villages ?? [];
    const merged = new Map<string, { id: string; name: string; code?: string; districtId?: string }>();
    for (const v of regionVillages.length ? regionVillages : phcVillages) {
      merged.set(v.id, { id: v.id, name: v.name, code: v.code, districtId: (v as { districtId?: string }).districtId });
    }
    if (regionVillages.length) {
      for (const v of phcVillages) {
        if (!merged.has(v.id)) merged.set(v.id, { id: v.id, name: v.name, code: v.code });
      }
    }
    const list = [...merged.values()];
    if (!form.district) return list;
    const inDistrict = list.filter((v) => !v.districtId || v.districtId === form.district);
    return inDistrict.length ? inDistrict : list;
  }, [myRegion, phcVillages, form.district]);

  // Households offered in the picker: the worker's list narrowed to the
  // selected village, exactly how the mobile form filters its rows.
  const { data: householdData, isLoading: householdsLoading } = useQuery({
    queryKey: ['households', 'select', form.village],
    queryFn: () =>
      householdService.listHouseholds({
        villageId: form.village || undefined,
        page: 1,
        pageSize: 100,
      }),
  });
  const householdOptions = useMemo(
    () => [
      { id: 'none', name: t('asha.householdNone') },
      ...((householdData?.items ?? []).map((h) => ({
        id: h.id,
        name: [h.householdId, h.headName].filter(Boolean).join(' — ') || h.id,
      })) as Array<{ id: string; name: string }>),
    ],
    [householdData, t],
  );

  // Seed the worker's own state / district once, like the mobile form; the
  // village is left for her to pick.
  const geoPrefilled = useRef(false);
  useEffect(() => {
    if (geoPrefilled.current) return;
    const stateId = myRegion?.state?.id ?? user?.stateId ?? '';
    const districtId = myRegion?.district?.id ?? user?.districtId ?? '';
    if (!stateId && !districtId) return;
    geoPrefilled.current = true;
    setForm((prev) => ({
      ...prev,
      state: prev.state || stateId,
      district: prev.district || districtId,
    }));
  }, [myRegion, user]);

  const ageFromDob = (dob: string): number => {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
    return Math.max(age, 0);
  };

  const validate = (): Partial<Record<keyof FormState, string>> => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = t('asha.errNameRequired');
    // Exactly 10 digits, digits only — the input itself strips anything else.
    if (!/^\d{10}$/.test(form.mobile)) next.mobile = t('asha.errPhoneRequired');
    if (!form.dob) next.dob = t('asha.errDobRequired');
    if (!form.gender) next.gender = t('asha.errGenderRequired');
    const abhaDigits = form.abhaId.replace(/\D/g, '');
    if (!abhaDigits) next.abhaId = t('asha.errAbhaRequired');
    else if (!/^\d{14}$/.test(abhaDigits)) next.abhaId = t('asha.errAbhaInvalid');
    if (!form.state) next.state = t('asha.errStateRequired');
    if (!form.district) next.district = t('asha.errDistrictRequired');
    if (!form.village) next.village = t('asha.errVillageRequired');
    if (!form.ashaWorker) next.ashaWorker = t('asha.errWorkerRequired');
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saved) return;

    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaved(true);
    const village = villages.find((v) => v.id === form.village)?.name ?? '';
    const stateName = states.find((s) => s.id === form.state)?.name ?? '';
    const districtName = districts.find((d) => d.id === form.district)?.name ?? '';
    const ashaWorkerName = ashaWorkers.find((w) => w.id === form.ashaWorker)?.name ?? '';
    // The picker stores the row id; `none` means the patient belongs to no
    // household yet. The free-text fallback keeps old behaviour for hhids.
    const householdPick = form.householdId === 'none' ? '' : form.householdId.trim();
    const householdHhid =
      (householdData?.items ?? []).find((h) => h.id === householdPick)?.householdId ?? householdPick;
    try {
      const registered = await patientService.register({
        fullName: form.name.trim(),
        phone: form.mobile,
        dateOfBirth: form.dob,
        gender: form.gender as 'male' | 'female' | 'other',
        abhaId: form.abhaId.replace(/\D/g, ''),
        village,
        state: stateName || undefined,
        district: districtName || undefined,
        householdId: householdPick || undefined,
        relationshipToHead: form.relationship || undefined,
        bloodGroup: form.bloodGroup || undefined,
        ashaWorker: ashaWorkerName || undefined,
        risk: form.risk,
        notes: form.notes.trim() || undefined,
      });

      addPatient({
        // The backend user id doubles as the local record id, so the two stay
        // linkable when the patient later logs in.
        id: registered.userId,
        beneficiaryId: registered.beneficiaryId,
        name: registered.fullName,
        abhaId: form.abhaId.replace(/\D/g, ''),
        age: ageFromDob(form.dob),
        gender: form.gender.charAt(0).toUpperCase() + form.gender.slice(1),
        bloodGroup: form.bloodGroup || '—',
        phone: `+91 ${form.mobile}`,
        address: householdHhid ? `Household ${householdHhid}, ${village}` : village,
        village,
        ward: NOT_RECORDED,
        householdId: householdHhid || undefined,
        risk: form.risk,
        riskReason:
          form.risk === 'high' || form.risk === 'medium'
            ? form.notes.trim() || 'Under monitoring'
            : undefined,
        registeredAt: new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        activeConditions: form.notes.trim() ? [form.notes.trim()] : [],
      });

      // The patients list is API-backed now — pull the fresh row into it.
      void queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });

      addToast('success', t('asha.patientSavedToast'));
      if (photo) {
        try {
          await beneficiaryService.uploadPhoto(registered.beneficiaryId, photo);
        } catch {
          addToast('error', t('photo.saveFailed'));
        }
      }
      setCreds(registered);
      setCopied(false);
    } catch (err) {
      addToast('error', apiErrorMessage(err, t('asha.errRegistration')));
      setSaved(false);
    }
  };

  const closeCredentials = () => {
    setCreds(null);
    navigate('/asha/patients');
  };

  const copyPassword = async () => {
    if (!creds) return;
    try {
      await navigator.clipboard.writeText(creds.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context) — the password is still on screen.
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t('asha.newPatientTitle')} subtitle={t('asha.newPatientSubtitle')} />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="users" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.personalInfo')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex items-center gap-4 md:col-span-2 rounded-lg border border-outline-variant bg-surface-container-low p-4">
              <PhotoUploadField
                size="md"
                file={photo}
                onFileChange={setPhoto}
                onError={(msg) => addToast('error', msg)}
              />
              <div>
                <p className="font-label-md text-label-md text-on-surface">{t('photo.upload')}</p>
                <p className="font-caption text-caption text-on-surface-variant">
                  {t('photo.hint')} · {t('asha.photoAfterSave')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="patient_name"
              >
                {t('asha.fullName')} *
              </label>
              <input
                id="patient_name"
                className={inputCls}
                placeholder={t('asha.legalNamePlaceholder')}
                required
                type="text"
                value={form.name}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'patient_name-error' : undefined}
                onChange={(e) => set('name', e.target.value)}
              />
              <div id="patient_name-error">
                <FieldError message={errors.name} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="uid">
                {t('asha.abhaId')} *
              </label>
              <input
                id="uid"
                className={inputCls}
                placeholder={t('asha.abhaPlaceholder')}
                required
                type="text"
                inputMode="numeric"
                maxLength={17}
                value={form.abhaId}
                aria-invalid={!!errors.abhaId}
                aria-describedby={errors.abhaId ? 'uid-error' : undefined}
                onChange={(e) => set('abhaId', formatAbha(e.target.value))}
              />
              <div id="uid-error">
                <FieldError message={errors.abhaId} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="mobile"
              >
                {t('asha.mobileNumber')} *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 font-body-md text-body-md text-on-surface-variant">
                  +91
                </span>
                <input
                  id="mobile"
                  className={`${inputCls} pl-12`}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="\d{10}"
                  placeholder={t('asha.mobilePlaceholder')}
                  required
                  type="tel"
                  value={form.mobile}
                  aria-invalid={!!errors.mobile}
                  aria-describedby={errors.mobile ? 'mobile-error' : undefined}
                  onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
              <div id="mobile-error">
                <FieldError message={errors.mobile} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="dob">
                {t('asha.dob')} *
              </label>
              <input
                id="dob"
                className={inputCls}
                required
                type="date"
                value={form.dob}
                aria-invalid={!!errors.dob}
                aria-describedby={errors.dob ? 'dob-error' : undefined}
                onChange={(e) => set('dob', e.target.value)}
              />
              <div id="dob-error">
                <FieldError message={errors.dob} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="gender"
              >
                {t('asha.gender')} *
              </label>
              <div className="relative">
                <select
                  id="gender"
                  className={`${inputCls} appearance-none`}
                  required
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                >
                  <option value="" disabled>
                    {t('asha.selectGender')}
                  </option>
                  <option value="male">{t('asha.male')}</option>
                  <option value="female">{t('asha.female')}</option>
                  <option value="other">{t('asha.other')}</option>
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
              <div id="gender-error">
                <FieldError message={errors.gender} />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
            <Icon name="box" size={20} className="text-primary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.familyHousehold')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <SearchableSelect
                id="state"
                label={`${t('common.state')}`}
                required
                options={states.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
                showCode
                value={form.state}
                onChange={(id) => {
                  setForm((prev) => ({ ...prev, state: id, district: '', village: '', householdId: '' }));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.state;
                    delete next.district;
                    delete next.village;
                    return next;
                  });
                }}
                placeholder={t('asha.selectState')}
                loading={statesLoading}
                loadingLabel={t('asha.loadingGeo')}
                emptyLabel={t('asha.selectState')}
              />
              <div id="state-error">
                <FieldError message={errors.state} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <SearchableSelect
                id="district"
                label={`${t('common.district')}`}
                required
                options={districts.map((d) => ({ id: d.id, name: d.name, code: d.code }))}
                showCode
                value={form.district}
                onChange={(id) => {
                  setForm((prev) => ({ ...prev, district: id, village: '', householdId: '' }));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.district;
                    delete next.village;
                    return next;
                  });
                }}
                placeholder={form.state ? t('asha.selectDistrict') : t('asha.stateFirstPlaceholder')}
                loading={districtsLoading}
                loadingLabel={t('asha.loadingGeo')}
                emptyLabel={t('asha.selectDistrict')}
              />
              <div id="district-error">
                <FieldError message={errors.district} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <SearchableSelect
                id="village"
                label={`${t('asha.villageLocality')}`}
                required
                options={villages.map((v) => ({ id: v.id, name: v.name, code: v.code }))}
                showCode
                value={form.village}
                onChange={(id) => {
                  set('village', id);
                  setForm((prev) => ({ ...prev, householdId: '' }));
                }}
                placeholder={
                  form.district ? t('asha.selectVillage') : t('asha.districtFirstPlaceholder')
                }
                loading={villagesLoading}
                loadingLabel={t('asha.loadingVillages')}
                emptyLabel={t('asha.selectVillage')}
              />
              <div id="village-error">
                <FieldError message={errors.village} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <SearchableSelect
                id="household_id"
                label={t('asha.householdId')}
                options={householdOptions}
                value={form.householdId || 'none'}
                onChange={(id) => set('householdId', id)}
                placeholder={t('asha.householdPlaceholder')}
                loading={householdsLoading}
                loadingLabel={t('asha.loadingHouseholds')}
                emptyLabel={t('asha.householdPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="relationship"
              >
                {t('asha.relationshipToHead')}
              </label>
              <div className="relative">
                <select
                  id="relationship"
                  className={`${inputCls} appearance-none`}
                  value={form.relationship}
                  onChange={(e) => set('relationship', e.target.value)}
                >
                  <option value="">{t('asha.relationshipPlaceholder')}</option>
                  {relationshipOptions(t).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="blood_group"
              >
                {t('asha.bloodGroupOptional')}
              </label>
              <div className="relative">
                <select
                  id="blood_group"
                  className={`${inputCls} appearance-none`}
                  value={form.bloodGroup}
                  onChange={(e) => set('bloodGroup', e.target.value)}
                >
                  <option value="">{t('asha.selectBloodGroup')}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                <span className={selectWrap}>
                  <Icon name="chevronDown" size={20} />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
          <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-tertiary-container" />
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-5 py-4 pl-8">
            <Icon name="heart" size={20} className="text-tertiary" />
            <h2 className="font-headline-md text-headline-md font-semibold text-on-surface">
              {t('asha.initialAssessment')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 pl-8">
            <div className="flex flex-col gap-1 md:w-1/2">
              <SearchableSelect
                id="asha_worker"
                label={`${t('asha.assignedAsha')}`}
                required
                options={ashaWorkers.map((w) => ({
                  id: w.id,
                  name: `${w.name}${w.village ? ` (${w.village})` : ''}`,
                }))}
                value={form.ashaWorker}
                onChange={(id) => set('ashaWorker', id)}
                placeholder={t('asha.selectWorker')}
                emptyLabel={t('asha.selectWorker')}
              />
              <div id="asha_worker-error">
                <FieldError message={errors.ashaWorker} />
              </div>
            </div>

            <div className="mt-1 flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                {t('asha.riskAssessment')}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                {RISK_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="relative flex w-full cursor-pointer items-center rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low"
                  >
                    <input
                      className="peer sr-only"
                      name="risk_level"
                      type="radio"
                      value={option.value}
                      checked={form.risk === option.value}
                      onChange={() => set('risk', option.value)}
                    />
                    <div
                      className={`mr-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-outline ${option.ring}`}
                    >
                      <div className="hidden h-2.5 w-2.5 rounded-full bg-surface peer-checked:block" />
                    </div>
                    <span className="font-body-md text-body-md text-on-surface">
                      {t(option.label)}
                    </span>
                    <div className={`ml-auto ${option.dot}`} />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="notes"
              >
                {t('asha.clinicalNotes')}
              </label>
              <textarea
                id="notes"
                className="min-h-[100px] resize-y rounded-lg border border-outline bg-surface p-4 text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t('asha.notesPlaceholder')}
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            className="flex h-touch-target items-center justify-center rounded-full px-5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-highest"
            type="button"
            onClick={() => navigate(-1)}
          >
            {t('common.cancel')}
          </button>
          <button
            className="flex h-touch-target items-center justify-center gap-2 rounded-full bg-primary px-6 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
            type="submit"
            disabled={saved}
          >
            <Icon name="save" size={18} />
            {t('asha.savePatient')}
          </button>
        </div>
      </form>

      {creds && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credentials-title"
        >
          <ASHACard className="w-full max-w-lg">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name="checkCircle" size={22} />
                </span>
                <h2
                  id="credentials-title"
                  className="font-headline-md text-headline-md font-semibold text-on-surface"
                >
                  {t('asha.credentialsTitle')}
                </h2>
              </div>

              <p className="font-body-md text-body-md text-on-surface-variant">
                {t('asha.credentialsIntro', { name: creds.fullName })}
              </p>

              <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {t('asha.credentialsPhone')}
                  </span>
                  <span className="font-body-md text-body-md font-semibold text-on-surface">
                    +91 {creds.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {t('asha.credentialsPassword')}
                  </span>
                  <span className="flex items-center gap-2">
                    <code className="rounded bg-surface-container-highest px-2 py-1 font-mono text-body-md font-semibold text-on-surface">
                      {creds.password}
                    </code>
                    <ASHAButton
                      variant="outline"
                      fullWidth={false}
                      label={copied ? t('asha.credentialsCopied') : t('asha.credentialsCopy')}
                      onClick={() => void copyPassword()}
                    />
                  </span>
                </div>
              </div>

              <p className="font-caption text-caption text-error">{t('asha.credentialsOnce')}</p>

              <ASHAButton
                variant="primary"
                fullWidth
                label={t('asha.credentialsDone')}
                onClick={closeCredentials}
              />
            </div>
          </ASHACard>
        </div>
      )}
    </div>
  );
}
