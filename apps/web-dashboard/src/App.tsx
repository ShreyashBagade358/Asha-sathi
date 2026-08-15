import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ASHAErrorScreen } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import type { Role } from '@/types'

// ─── Stitch auth screens ────────────────────────────────────────────────
import LoginAshaSathi from '@/pages/auth/LoginAshaSathi'
import VerifyOtpAshaSathi from '@/pages/auth/VerifyOtpAshaSathi'
import AccountRecoveryAshaSathi from '@/pages/auth/AccountRecoveryAshaSathi'
import RedirectingAshaSathi from '@/pages/auth/RedirectingAshaSathi'

// ─── Stitch PHC Admin screens ───────────────────────────────────────────
import PhcAdminDashboard from '@/pages/phc-admin/PhcAdminDashboard'
import AshaWorkerDirectoryPhcAdmin from '@/pages/phc-admin/AshaWorkerDirectoryPhcAdmin'
import AshaWorkerProfileSunitaDevi from '@/pages/phc-admin/AshaWorkerProfileSunitaDevi'
import AddNewAshaWorkerPhcAdmin from '@/pages/phc-admin/AddNewAshaWorkerPhcAdmin'
import BeneficiaryDirectoryPhcAdmin from '@/pages/phc-admin/BeneficiaryDirectoryPhcAdmin'
import BeneficiariesPhcAdmin2 from '@/pages/phc-admin/BeneficiariesPhcAdmin2'
import AddNewPatientAshaSathi from '@/pages/asha/AddNewPatientAshaSathi'
import HouseholdDirectoryPhcAdmin from '@/pages/phc-admin/HouseholdDirectoryPhcAdmin'
import HouseholdDetailsPhcAdmin from '@/pages/phc-admin/HouseholdDetailsPhcAdmin'
import HouseholdHealthSurveyPhcAdmin from '@/pages/phc-admin/HouseholdHealthSurveyPhcAdmin'
import MaternalHealthPhcAdmin from '@/pages/phc-admin/MaternalHealthPhcAdmin'
import PregnantWomenListPhcAdmin from '@/pages/phc-admin/PregnantWomenListPhcAdmin'
import PregnancyDetailsPhcAdmin from '@/pages/phc-admin/PregnancyDetailsPhcAdmin'
import ChildrenDirectoryPhcAdmin from '@/pages/phc-admin/ChildrenDirectoryPhcAdmin'
import ChildProfilePhcAdmin from '@/pages/phc-admin/ChildProfilePhcAdmin'
import ChildVaccinationSchedulePhcAdmin from '@/pages/phc-admin/ChildVaccinationSchedulePhcAdmin'
import GrowthNutritionMonitoringPhcAdmin from '@/pages/phc-admin/GrowthNutritionMonitoringPhcAdmin'
import VaccinationManagementPhcAdmin from '@/pages/phc-admin/VaccinationManagementPhcAdmin'
import NewHealthCheckUpPhcAdmin from '@/pages/phc-admin/NewHealthCheckUpPhcAdmin'
import HealthCheckUpHistoryPhcAdmin from '@/pages/phc-admin/HealthCheckUpHistoryPhcAdmin'
import ReferralDirectoryPhcAdmin from '@/pages/phc-admin/ReferralDirectoryPhcAdmin'
import CreateNewReferralPhcAdmin from '@/pages/phc-admin/CreateNewReferralPhcAdmin'
import ReferralDetailsPhcAdmin from '@/pages/phc-admin/ReferralDetailsPhcAdmin'
import AlertsNotificationsDashboardPhcAdmin from '@/pages/phc-admin/AlertsNotificationsDashboardPhcAdmin'
import CriticalAlertsHighRiskMonitoringPhcAdmin from '@/pages/phc-admin/CriticalAlertsHighRiskMonitoringPhcAdmin'
import MaternalHealthReportPhcAdmin from '@/pages/phc-admin/MaternalHealthReportPhcAdmin'
import ChildHealthVaccinationReportPhcAdmin from '@/pages/phc-admin/ChildHealthVaccinationReportPhcAdmin'
import AshaPerformanceReportPhcAdmin from '@/pages/phc-admin/AshaPerformanceReportPhcAdmin'
import AnalyticsDashboardPhcAdmin from '@/pages/phc-admin/AnalyticsDashboardPhcAdmin'
import RiskAnalysisPhcAdmin from '@/pages/phc-admin/RiskAnalysisPhcAdmin'

// ─── Stitch ASHA Worker mobile screens ──────────────────────────────────
import AshaWorkerHomeAshaSathi from '@/pages/asha/AshaWorkerHomeAshaSathi'
import TasksAshaSathi from '@/pages/asha/TasksAshaSathi'
import PatientDashboardAshaSathi from '@/pages/asha/PatientDashboardAshaSathi'
import PatientDetailsAshaSathi from '@/pages/asha/PatientDetailsAshaSathi'
import MyHealthProfileAshaSathi from '@/pages/asha/MyHealthProfileAshaSathi'
import ImmunizationScheduleAshaSathi from '@/pages/asha/ImmunizationScheduleAshaSathi'
import AssignedHouseholdsAshaSathi from '@/pages/asha/AssignedHouseholdsAshaSathi'
import HouseholdVisitSurveyAshaSathi from '@/pages/asha/HouseholdVisitSurveyAshaSathi'
import CheckUpCompletedAshaSathi from '@/pages/asha/CheckUpCompletedAshaSathi'
import OfflineSyncCenterAshaSathi from '@/pages/asha/OfflineSyncCenterAshaSathi'
import ConnectionErrorAshaSathi from '@/pages/asha/ConnectionErrorAshaSathi'

// ─── Existing role pages (unchanged: District / State / Super) ──────────
import DistrictDashboardPage from '@/pages/district/DashboardPage'
import PHCComparisonPage from '@/pages/district/PHCComparisonPage'
import ResourceAllocationPage from '@/pages/district/ResourceAllocationPage'
import StateDashboardPage from '@/pages/state/DashboardPage'
import DistrictComparisonPage from '@/pages/state/DistrictComparisonPage'
import PolicyConfigPage from '@/pages/state/PolicyConfigPage'
import AuditLogsPage from '@/pages/state/AuditLogsPage'
import UserManagementPage from '@/pages/super/UserManagementPage'
import SystemConfigPage from '@/pages/super/SystemConfigPage'
import DeploymentPage from '@/pages/super/DeploymentPage'

export const ROLE_HOME: Record<Role, string> = {
  asha: '/asha/home',
  anm: '/phc/dashboard',
  moic: '/phc/dashboard',
  bpm: '/phc/dashboard',
  dpm: '/district/dashboard',
  state_admin: '/state/dashboard',
  super_admin: '/super/users',
}

const PHC_ROLES: Role[] = ['asha', 'anm', 'moic', 'bpm']
const DISTRICT_ROLES: Role[] = ['dpm']
const STATE_ROLES: Role[] = ['state_admin']
const SUPER_ROLES: Role[] = ['super_admin']

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isHydrating } = useAuth()
  const location = useLocation()

  if (isHydrating) {
    return <LoadingSpinner fullPage />
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'super_admin' && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }
  return <>{children}</>
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </ProtectedRoute>
  )
}

function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME[user.role]} replace />
}

function NotFoundPage() {
  return <ASHAErrorScreen type="notFound404" onPrimary={() => window.location.assign('/dashboard')} />
}

function SessionExpiredScreen() {
  return <ASHAErrorScreen type="sessionExpired" onPrimary={() => window.location.assign('/login')} />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <ErrorBoundary>
        <LoginAshaSathi />
      </ErrorBoundary>
    ),
  },
  {
    path: '/otp',
    element: (
      <ErrorBoundary>
        <VerifyOtpAshaSathi />
      </ErrorBoundary>
    ),
  },
  {
    path: '/account-recovery',
    element: (
      <ErrorBoundary>
        <AccountRecoveryAshaSathi />
      </ErrorBoundary>
    ),
  },
  {
    path: '/redirecting',
    element: (
      <ErrorBoundary>
        <RedirectingAshaSathi />
      </ErrorBoundary>
    ),
  },
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <RoleHome /> },
      { path: '/dashboard', element: <RoleHome /> },

      // ASHA Worker (mobile) ───────────────────────────────────────────
      { path: '/asha/home', element: <RoleRoute roles={PHC_ROLES}><AshaWorkerHomeAshaSathi /></RoleRoute> },
      { path: '/asha/tasks', element: <RoleRoute roles={PHC_ROLES}><TasksAshaSathi /></RoleRoute> },
      { path: '/asha/patients', element: <RoleRoute roles={PHC_ROLES}><PatientDashboardAshaSathi /></RoleRoute> },
      { path: '/asha/patients/:id', element: <RoleRoute roles={PHC_ROLES}><PatientDetailsAshaSathi /></RoleRoute> },
      { path: '/asha/patients/:id/profile', element: <RoleRoute roles={PHC_ROLES}><MyHealthProfileAshaSathi /></RoleRoute> },
      { path: '/asha/patients/:id/immunization', element: <RoleRoute roles={PHC_ROLES}><ImmunizationScheduleAshaSathi /></RoleRoute> },
      { path: '/asha/patients/new', element: <RoleRoute roles={PHC_ROLES}><AddNewPatientAshaSathi /></RoleRoute> },
      { path: '/asha/households', element: <RoleRoute roles={PHC_ROLES}><AssignedHouseholdsAshaSathi /></RoleRoute> },
      { path: '/asha/households/:id/visit', element: <RoleRoute roles={PHC_ROLES}><HouseholdVisitSurveyAshaSathi /></RoleRoute> },
      { path: '/asha/checkup-completed', element: <RoleRoute roles={PHC_ROLES}><CheckUpCompletedAshaSathi /></RoleRoute> },
      { path: '/asha/sync', element: <RoleRoute roles={PHC_ROLES}><OfflineSyncCenterAshaSathi /></RoleRoute> },
      { path: '/asha/connection-error', element: <RoleRoute roles={PHC_ROLES}><ConnectionErrorAshaSathi /></RoleRoute> },

      // PHC Admin (desktop) ────────────────────────────────────────────
      { path: '/phc/dashboard', element: <RoleRoute roles={PHC_ROLES}><PhcAdminDashboard /></RoleRoute> },
      { path: '/phc/ashas', element: <RoleRoute roles={PHC_ROLES}><AshaWorkerDirectoryPhcAdmin /></RoleRoute> },
      { path: '/phc/ashas/:id', element: <RoleRoute roles={PHC_ROLES}><AshaWorkerProfileSunitaDevi /></RoleRoute> },
      { path: '/phc/ashas/new', element: <RoleRoute roles={PHC_ROLES}><AddNewAshaWorkerPhcAdmin /></RoleRoute> },
      { path: '/phc/beneficiaries', element: <RoleRoute roles={PHC_ROLES}><BeneficiaryDirectoryPhcAdmin /></RoleRoute> },
      { path: '/phc/beneficiaries/:id', element: <RoleRoute roles={PHC_ROLES}><BeneficiariesPhcAdmin2 /></RoleRoute> },
      { path: '/phc/households', element: <RoleRoute roles={PHC_ROLES}><HouseholdDirectoryPhcAdmin /></RoleRoute> },
      { path: '/phc/households/:id', element: <RoleRoute roles={PHC_ROLES}><HouseholdDetailsPhcAdmin /></RoleRoute> },
      { path: '/phc/households/:id/survey', element: <RoleRoute roles={PHC_ROLES}><HouseholdHealthSurveyPhcAdmin /></RoleRoute> },
      { path: '/phc/maternal', element: <RoleRoute roles={PHC_ROLES}><MaternalHealthPhcAdmin /></RoleRoute> },
      { path: '/phc/maternal/pregnant', element: <RoleRoute roles={PHC_ROLES}><PregnantWomenListPhcAdmin /></RoleRoute> },
      { path: '/phc/maternal/:id', element: <RoleRoute roles={PHC_ROLES}><PregnancyDetailsPhcAdmin /></RoleRoute> },
      { path: '/phc/children', element: <RoleRoute roles={PHC_ROLES}><ChildrenDirectoryPhcAdmin /></RoleRoute> },
      { path: '/phc/children/:id', element: <RoleRoute roles={PHC_ROLES}><ChildProfilePhcAdmin /></RoleRoute> },
      { path: '/phc/children/:id/vaccination', element: <RoleRoute roles={PHC_ROLES}><ChildVaccinationSchedulePhcAdmin /></RoleRoute> },
      { path: '/phc/growth-nutrition', element: <RoleRoute roles={PHC_ROLES}><GrowthNutritionMonitoringPhcAdmin /></RoleRoute> },
      { path: '/phc/vaccination', element: <RoleRoute roles={PHC_ROLES}><VaccinationManagementPhcAdmin /></RoleRoute> },
      { path: '/phc/health-checkups/new', element: <RoleRoute roles={PHC_ROLES}><NewHealthCheckUpPhcAdmin /></RoleRoute> },
      { path: '/phc/health-checkups/history', element: <RoleRoute roles={PHC_ROLES}><HealthCheckUpHistoryPhcAdmin /></RoleRoute> },
      { path: '/phc/referrals', element: <RoleRoute roles={PHC_ROLES}><ReferralDirectoryPhcAdmin /></RoleRoute> },
      { path: '/phc/referrals/new', element: <RoleRoute roles={PHC_ROLES}><CreateNewReferralPhcAdmin /></RoleRoute> },
      { path: '/phc/referrals/:id', element: <RoleRoute roles={PHC_ROLES}><ReferralDetailsPhcAdmin /></RoleRoute> },
      { path: '/phc/alerts', element: <RoleRoute roles={PHC_ROLES}><AlertsNotificationsDashboardPhcAdmin /></RoleRoute> },
      { path: '/phc/alerts/critical', element: <RoleRoute roles={PHC_ROLES}><CriticalAlertsHighRiskMonitoringPhcAdmin /></RoleRoute> },
      { path: '/phc/reports/maternal', element: <RoleRoute roles={PHC_ROLES}><MaternalHealthReportPhcAdmin /></RoleRoute> },
      { path: '/phc/reports/child-vaccination', element: <RoleRoute roles={PHC_ROLES}><ChildHealthVaccinationReportPhcAdmin /></RoleRoute> },
      { path: '/phc/reports/asha-performance', element: <RoleRoute roles={PHC_ROLES}><AshaPerformanceReportPhcAdmin /></RoleRoute> },
      { path: '/phc/analytics', element: <RoleRoute roles={PHC_ROLES}><AnalyticsDashboardPhcAdmin /></RoleRoute> },
      { path: '/phc/risk-analysis', element: <RoleRoute roles={PHC_ROLES}><RiskAnalysisPhcAdmin /></RoleRoute> },

      // District ───────────────────────────────────────────────────────
      { path: '/district/dashboard', element: <RoleRoute roles={DISTRICT_ROLES}><DistrictDashboardPage /></RoleRoute> },
      { path: '/district/phc-comparison', element: <RoleRoute roles={DISTRICT_ROLES}><PHCComparisonPage /></RoleRoute> },
      { path: '/district/resources', element: <RoleRoute roles={DISTRICT_ROLES}><ResourceAllocationPage /></RoleRoute> },

      // State ──────────────────────────────────────────────────────────
      { path: '/state/dashboard', element: <RoleRoute roles={STATE_ROLES}><StateDashboardPage /></RoleRoute> },
      { path: '/state/district-comparison', element: <RoleRoute roles={STATE_ROLES}><DistrictComparisonPage /></RoleRoute> },
      { path: '/state/policy-config', element: <RoleRoute roles={STATE_ROLES}><PolicyConfigPage /></RoleRoute> },
      { path: '/state/audit-logs', element: <RoleRoute roles={STATE_ROLES}><AuditLogsPage /></RoleRoute> },

      // Super admin ────────────────────────────────────────────────────
      { path: '/super/users', element: <RoleRoute roles={SUPER_ROLES}><UserManagementPage /></RoleRoute> },
      { path: '/super/system-config', element: <RoleRoute roles={SUPER_ROLES}><SystemConfigPage /></RoleRoute> },
      { path: '/super/deployment', element: <RoleRoute roles={SUPER_ROLES}><DeploymentPage /></RoleRoute> },

      { path: '/session-expired', element: <SessionExpiredScreen /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
    errorElement: <ErrorBoundary />,
  },
])
