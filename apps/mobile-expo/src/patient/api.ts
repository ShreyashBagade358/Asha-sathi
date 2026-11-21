import axios from 'axios';

const apiBase = process.env.EXPO_PUBLIC_API_URL || 'https://asha-sathi-17da.onrender.com';

// Create axios instance with auth header
const apiRequest = async <T>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
  const token = await tokenStore.getUser?.().then(u => u?.id).catch(() => null);
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await axios({
    method: options.method || 'GET',
    url: `${apiBase}${url}`,
    data: options.body,
    headers: { ...headers, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  return response.data as T;
}

// Raw shapes for deserialization (match backend OpenAPI types)
import type { MyPatientProfile } from "./types";
interface RawMyProfile {
  photo_url: string | null;
  photo_urls: Record<string, string> | null;
  full_name: string;
  phone: string;
  abha_id: string | null;
  date_of_birth: string | null;
  age_years: number | null;
  gender: string | null;
  blood_group: string | null;
  village: string | null;
  household_id: string | null;
  address: string | null;
  phc_name: string | null;
  asha_worker_name: string | null;
  is_pregnant: boolean;
  active_conditions: string[];
  profile_inputs?: Record<string, unknown> | null;
  pregnancy: {
    lmp: string | null;
    edd: string | null;
    anc_visits: number;
    risk_level: string;
    high_risk: boolean;
    trimester: number | null;
    week: number | null;
  } | null;
  vitals: {
    height_cm: number | null;
    weight_kg: number | null;
    bmi: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    pulse: number | null;
    temperature: number | null;
    spo2: number | null;
    hemoglobin: number | null;
    blood_sugar_random: number | null;
    waist_circumference_cm: number | null;
    blood_group: string | null;
    // Photo URLs for beneficiary/child profile pictures
    photo_url: string | null;
    photo_urls: Record<string, string> | null;
  }
}

interface RawMyHousehold {
  id: string;
  hhid: string;
  head_name: string | null;
  ward: string | null;
  address: string | null;
  village: string | null;
  family_size: number | null;
  contact_phone: string | null;
  member_count: number | null;
  members?: Array<{
    id: string;
    full_name: string | null;
    gender: string | null;
    age_years: number | null;
    age_months: number | null;
    is_pregnant: boolean;
    is_lactating: boolean;
    registration_date: string | null;
    registered_by: string | null;
    status: string | null;
  } | null> | null;
}

interface RawNCDScreening {
  beneficiary_id: string;
  screening_date: string;
  age_above_30: boolean;
  tobacco_use: boolean;
  alcohol_use: boolean;
  physical_activity: boolean;
  waist_circumference_cm: number | null;
  family_history_diabetes: boolean;
  family_history_hypertension: boolean;
  family_history_cancer: boolean;
  known_diabetes: boolean;
  known_hypertension: boolean;
  known_cancer: boolean;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  blood_sugar_random: number | null;
  cbac_score: number;
  diabetes_risk: string;
  hypertension_risk: string;
  cardiovascular_risk: string;
  cancer_risk: string;
  referral_made: boolean;
  referral_type: string | null;
  referral_facility_id: string | null;
  recorded_by: string | null;
}

function mapMyProfile(data: RawMyProfile): MyPatientProfile {
    const photoUrls = data.photo_urls
      ? Object.fromEntries(
          Object.entries(data.photo_urls).map(([key, value]) => [key, value])
        )
      : null;
    return {
      userId: data.id,
      beneficiaryId: data.household_id,
      fullName: data.full_name,
      phone: data.phone,
      abhaId: data.abha_id,
      dateOfBirth: data.date_of_birth,
      ageYears: data.age_years,
      gender: data.gender,
      bloodGroup: data.blood_group,
      village: data.village,
      householdId: data.household_id,
      address: data.address,
      phcName: data.phc_name,
      ashaWorkerName: data.asha_worker_name,
      isPregnant: data.is_pregnant,
      activeConditions: data.active_conditions,
      pregnancy: data.pregnancy,
      vitals: data.vitals
        ? {
            heightCm: data.vitals.height_cm,
            weightKg: data.vitals.weight_kg,
            bmi: data.vitals.bmi,
            bpSystolic: data.vitals.bp_systolic,
            bpDiastolic: data.vitals.bp_diastolic,
            pulse: data.vitals.pulse,
            temperature: data.vitals.temperature,
            spo2: data.vitals.spo2,
            hemoglobin: data.vitals.hemoglobin,
            bloodSugarRandom: data.vitals.blood_sugar_random,
            waistCircumferenceCm: data.vitals.waist_circumference_cm,
            bloodGroup: data.vitals.blood_group,
          }
        : null,
      profileInputs: data.profile_inputs,
      photoUrls,
    };
  }

function mapMyHousehold(data: RawMyHousehold): MyHousehold {
  return {
    id: data.id,
    householdId: data.hhid,
    headName: data.head_name,
    ward: data.ward,
    address: data.address,
    village: data.village,
    familySize: data.family_size,
    contactPhone: data.contact_phone,
    memberCount: data.member_count,
    members: (data.members ?? []).map((member) => ({
      id: member?.id,
      fullName: member?.full_name,
      gender: member?.gender,
      ageYears: member?.age_years,
      ageMonths: member?.age_months,
      isPregnant: member?.is_pregnant ?? false,
      isLactating: member?.is_lactating ?? false,
      registrationDate: member?.registration_date,
      registeredBy: member?.registered_by,
      status: member?.status,
    })) | null,
  };
}

export { mapMyProfile, mapMyHousehold, RawMyProfile, RawMyHousehold, RawNCDScreening };

export function invalidateProfileCache(): void {
  profileCache = null;
}

