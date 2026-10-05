/**
 * Shared TypeScript Domain Models & API Types for ASHA Sathi Platform
 */
export type UserRole = 'asha' | 'phc_admin' | 'patient' | 'district_admin' | 'state_admin' | 'super_admin';
export interface User {
    id: string;
    phone: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ASHAWorker {
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    phcId?: string;
    phcName?: string;
    assignedVillages: string[];
    totalHouseholds: number;
    totalBeneficiaries: number;
    activePregnancies: number;
    highRiskCases: number;
    monthlyTarget: number;
    completedCheckupsThisMonth: number;
    incentiveClaimedMonthInr: number;
}
export interface Household {
    id: string;
    householdNumber: string;
    headName: string;
    village: string;
    subCenter?: string;
    phcId?: string;
    pincode?: string;
    memberCount: number;
    economicStatus?: 'APL' | 'BPL' | 'Antyodaya';
    sanitationFacility?: boolean;
    drinkingWaterSource?: string;
    ashaWorkerId?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Beneficiary {
    id: string;
    householdId?: string;
    householdNumber?: string;
    fullName: string;
    gender: 'male' | 'female' | 'other';
    dateOfBirth: string;
    ageYears?: number;
    phone?: string;
    abhaId?: string;
    abhaAddress?: string;
    bloodGroup?: string;
    isPregnant?: boolean;
    maritalStatus?: string;
    village?: string;
    registeredById?: string;
    createdAt: string;
    updatedAt: string;
}
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export interface PregnancyRecord {
    id: string;
    beneficiaryId: string;
    motherName: string;
    phone?: string;
    village?: string;
    lmp: string;
    edd: string;
    trimester: number;
    gestationalAgeWeeks: number;
    riskLevel: RiskLevel;
    highRiskFlags: string[];
    ancVisitsCount: number;
    lastAncDate?: string;
    nextAncDueDate?: string;
    ttDosesCount: number;
    hemoglobinGdl?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    weightKg?: number;
    deliveryOutcome?: 'pending' | 'live_birth' | 'stillbirth' | 'miscarriage';
    deliveryDate?: string;
    createdAt: string;
    updatedAt: string;
}
export type ChildHealthStatus = 'normal' | 'moderate_underweight' | 'severely_malnourished' | 'at_risk';
export interface ChildRecord {
    id: string;
    beneficiaryId: string;
    childName: string;
    motherName: string;
    motherBeneficiaryId?: string;
    gender: 'male' | 'female' | 'other';
    dateOfBirth: string;
    ageMonths: number;
    weightKg?: number;
    heightCm?: number;
    muacCm?: number;
    healthStatus: ChildHealthStatus;
    vaccinationsGiven: string[];
    vaccinationsPending: string[];
    nextVaccineDueDate?: string;
    createdAt: string;
    updatedAt: string;
}
export type NCDType = 'hypertension' | 'diabetes' | 'oral_cancer' | 'breast_cancer' | 'cervical_cancer';
export interface NCDScreening {
    id: string;
    beneficiaryId: string;
    beneficiaryName: string;
    screeningDate: string;
    bpSystolic?: number;
    bpDiastolic?: number;
    randomBloodSugarMgDl?: number;
    screeningTypesCompleted: NCDType[];
    suspectedConditions: NCDType[];
    riskScore: number;
    referredToPhc: boolean;
    notes?: string;
    createdAt: string;
}
export type ReferralUrgency = 'routine' | 'urgent' | 'emergency';
export type ReferralStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export interface ReferralRecord {
    id: string;
    beneficiaryId: string;
    patientName: string;
    ageYears?: number;
    gender?: string;
    referredByAshaId: string;
    referredByAshaName: string;
    targetFacility: string;
    reason: string;
    urgency: ReferralUrgency;
    status: ReferralStatus;
    referralDate: string;
    outcomeNotes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface VaccineDose {
    id: string;
    vaccineName: string;
    doseName: string;
    recommendedAgeWeeks: number;
    dueDate: string;
    givenDate?: string;
    givenByAshaId?: string;
    status: 'pending' | 'given' | 'overdue';
}
export interface ABDMProfile {
    abhaId: string;
    abhaAddress: string;
    name: string;
    gender: string;
    dob: string;
    mobile: string;
    kycVerified: boolean;
    linkedRecordsCount: number;
}
export interface SyncOperation {
    id: string;
    entityType: 'household' | 'beneficiary' | 'pregnancy' | 'checkup' | 'referral' | 'ncd';
    operation: 'create' | 'update' | 'delete';
    payload: Record<string, unknown>;
    clientTimestamp: string;
}
export interface SyncBatchRequest {
    deviceId: string;
    lastWatermark: string;
    operations: SyncOperation[];
}
export interface SyncBatchResponse {
    success: boolean;
    processedCount: number;
    serverWatermark: string;
    errors?: Array<{
        operationId: string;
        message: string;
    }>;
}
