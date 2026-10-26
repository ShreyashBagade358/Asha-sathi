import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ASHAErrorScreen } from 'asha-design-system'
import { useAuth } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AdminLayout } from '@/components/layout/AdminLayout'
import type { Role } from '@/types'

// ─── Stitch auth screens ────────────────────────────────────────────────
import LoginAshaSathi from '@/pages/auth/LoginAshaSathi'
import VerifyOtpAshaSathi from '@/pages/auth/VerifyOtpAshaSathi'
import AccountRecoveryAshaSathi from '@/pages/auth/AccountRecoveryAshaSathi'
import RedirectingAshaSathi from '@/pages/auth/RedirectingAshaSathi'

// ─── PHC Admin screens ─────────────────────────────────────────────────
import Dashboard from '@/pages/phc-admin/dashboard'
import Workers from '@/pages/phc-admin/workers'
import WorkerProfile from '@/pages/phc-admin/workerProfile'
import AddWorker from '@/pages/phc-admin/addWorker'
import Beneficiaries from '@/pages/phc-admin/beneficiaries'
import BeneficiaryDetails from '@/pages/phc-admin/beneficiaryDetails'
import AddPatient from '@/pages/phc-admin/addPatient'
import AddNewPatientAshaSathi from '@/pages/asha/AddNewPatientAshaSathi'
import Households from '@/pages/phc-admin/households'
import AddHousehold from '@/pages/phc-admin/addHousehold'
import HouseholdDetails from '@/pages/phc-admin/householdDetails'
import HouseholdSurvey from '@/pages/phc-admin/householdSurvey'
import MaternalHealth from '@/pages/phc-admin/maternalHealth'
import PregnantWomen from '@/pages/phc-admin/pregnantWomen'
import PregnancyDetails from '@/pages/phc-admin/pregnancyDetails'
import ChildrenDir from '@/pages/phc-admin/children'
import ChildProfile from '@/pages/phc-admin/childProfile'
import VaccinationSchedule from '@/pages/phc-admin/vaccinationSchedule'
import NutritionMonitoring from '@/pages/phc-admin/nutritionMonitoring'
import Vaccination from '@/pages/phc-admin/vaccination'
import NewCheckup from '@/pages/phc-admin/newCheckup'
import CheckupHistory from '@/pages/phc-admin/checkupHistory'
import Referrals from '@/pages/phc-admin/referrals'
import NewReferral from '@/pages/phc-admin/newReferral'
import ReferralDetails from '@/pages/phc-admin/referralDetails'
import Alerts from '@/pages/phc-admin/alerts'
import CriticalAlerts from '@/pages/phc-admin/criticalAlerts'
import MaternalReport from '@/pages/phc-admin/maternalReport'
import ChildVaccinationReport from '@/pages/phc-admin/childVaccinationReport'
import AshaPerformance from '@/pages/phc-admin/ashaPerformance'
import Analytics from '@/pages/phc-admin/analytics'
import RiskAnalysis from '@/pages/phc-admin/riskAnalysis'
import FollowUps from '@/pages/phc-admin/followUps'
import Notifications from '@/pages/phc-admin/notifications'
import Settings from '@/pages/phc-admin/settings'
import AuditLogs from '@/pages/phc-admin/auditLogs'
import ReportCenter from '@/pages/phc-admin/report'
import NewVaccination from '@/pages/phc-admin/newVaccination'
import NewBirth from '@/pages/phc-admin/newBirth'
import AddVillage from '@/pages/phc-admin/addVillage'
import Sanitize from '@/pages/phc-admin/sanitize'

// ─── Stitch ASHA Worker mobile screens ──────────────────────────────────
import AshaWorkerHomeAshaSathi from '@/pages/asha/AshaWorkerHomeAshaSathi'
import TasksAshaSathi from '@/pages/asha/TasksAshaSathi'
import PatientDashboardAshaSathi from '@/pages/asha/PatientDashboardAshaSathi'
import PatientDetailsAshaSathi from '@/pages/asha/PatientDetailsAshaSathi'
import MyHealthProfileAshaSathi from '@/pages/asha/MyHealthProfileAshaSathi'
import ImmunizationScheduleAshaSathi from '@/pages/asha/ImmunizationScheduleAshaSathi'
import AssignedHouseholdsAshaSathi from '@/pages/asha/AssignedHouseholdsAshaSathi'
import AddNewHouseholdAshaSathi from '@/pages/asha/AddNewHouseholdAshaSathi'
import HouseholdDetailAshaSathi from '@/pages/asha/HouseholdDetailAshaSathi'
import HouseholdVisitSurveyAshaSathi from '@/pages/asha/HouseholdVisitSurveyAshaSathi'
import CheckUpCompletedAshaSathi from '@/pages/asha/CheckUpCompletedAshaSathi'
import OfflineSyncCenterAshaSathi from '@/pages/asha/OfflineSyncCenterAshaSathi'
import ConnectionErrorAshaSathi from '@/pages/asha/ConnectionErrorAshaSathi'
import HealthSurveyAshaSathi from '@/pages/asha/HealthSurveyAshaSathi'
import PregnancyTrackingAshaSathi from '@/pages/asha/PregnancyTrackingAshaSathi'
import ChildHealthAshaSathi from '@/pages/asha/ChildHealthAshaSathi'
import HealthCheckUpAshaSathi from '@/pages/asha/HealthCheckUpAshaSathi'
import ReferralAshaSathi from '@/pages/asha/ReferralAshaSathi'
import FollowUpAshaSathi from '@/pages/asha/FollowUpAshaSathi'
import NotificationsAshaSathi from '@/pages/asha/NotificationsAshaSathi'
import ProfileSettingsAshaSathi from '@/pages/asha/ProfileSettingsAshaSathi'

// ─── Stitch Patient mobile screens ──────────────────────────────────────
import PatientHomePage from '@/pages/patient/PatientHomePage'
import PatientHealthProfilePage from '@/pages/patient/PatientHealthProfilePage'
import PatientHealthRecordsPage from '@/pages/patient/PatientHealthRecordsPage'
import PatientVaccinationPage from '@/pages/patient/PatientVaccinationPage'
import PatientFamilyPage from '@/pages/patient/PatientFamilyPage'
import PatientAppointmentsPage from '@/pages/patient/PatientAppointmentsPage'
import PatientReferralsPage from '@/pages/patient/PatientReferralsPage'
import PatientFollowUpsPage from '@/pages/patient/PatientFollowUpsPage'
import PatientNotificationsPage from '@/pages/patient/PatientNotificationsPage'
import PatientProfileSettingsPage from '@/pages/patient/PatientProfileSettingsPage'

// ─── Admin pages (District / State / Super — unified under pages/admin) ──
import DistrictDashboardPage from '@/pages/admin/DistrictDashboardPage'
import PHCComparisonPage from '@/pages/admin/PHCComparisonPage'
import ResourceAllocationPage from '@/pages/admin/ResourceAllocationPage'
import StateDashboardPage from '@/pages/admin/StateDashboardPage'
import DistrictComparisonPage from '@/pages/admin/DistrictComparisonPage'
import UserManagementPage from '@/pages/admin/UserManagementPage'
import DeploymentPage from '@/pages/admin/DeploymentPage'

export const ROLE_HOME: Record<Role, string> = {
  asha: '/asha/home',
  admin: '/phc/dashboard',
  patient: '/patient/dashboard',
}

const ADMIN_ROLES: Role[] = ['admin']
const ASHA_ROLES: Role[] = ['asha']
const PATIENT_ROLES: Role[] = ['patient']

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
  if (!roles.includes(user.role)) {
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
    path: '/account-recovery',
    element: (
      <ErrorBoundary>
        <AccountRecoveryAshaSathi />
      </ErrorBoundary>
    ),
  },
  {
    path: '/verify-otp',
    element: (
      <ErrorBoundary>
        <VerifyOtpAshaSathi />
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

      // ASHA Worker (desktop sidebar + mobile bottom nav) ────────────
      {
        path: '/asha',
        element: (
          <ProtectedRoute>
            <ErrorBoundary>
              <AdminLayout />
            </ErrorBoundary>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/asha/home" replace /> },
          { path: 'home', element: <RoleRoute roles={ASHA_ROLES}><AshaWorkerHomeAshaSathi /></RoleRoute> },
          { path: 'tasks', element: <RoleRoute roles={ASHA_ROLES}><TasksAshaSathi /></RoleRoute> },
          { path: 'patients', element: <RoleRoute roles={ASHA_ROLES}><PatientDashboardAshaSathi /></RoleRoute> },
          { path: 'patients/:id', element: <RoleRoute roles={ASHA_ROLES}><PatientDetailsAshaSathi /></RoleRoute> },
          { path: 'patients/:id/profile', element: <RoleRoute roles={ASHA_ROLES}><MyHealthProfileAshaSathi /></RoleRoute> },
          { path: 'patients/:id/immunization', element: <RoleRoute roles={ASHA_ROLES}><ImmunizationScheduleAshaSathi /></RoleRoute> },
          { path: 'patients/new', element: <RoleRoute roles={ASHA_ROLES}><AddNewPatientAshaSathi /></RoleRoute> },
          { path: 'households', element: <RoleRoute roles={ASHA_ROLES}><AssignedHouseholdsAshaSathi /></RoleRoute> },
          { path: 'households/new', element: <RoleRoute roles={ASHA_ROLES}><AddNewHouseholdAshaSathi /></RoleRoute> },
          { path: 'households/:id', element: <RoleRoute roles={ASHA_ROLES}><HouseholdDetailAshaSathi /></RoleRoute> },
          { path: 'households/:id/visit', element: <RoleRoute roles={ASHA_ROLES}><HouseholdVisitSurveyAshaSathi /></RoleRoute> },
          { path: 'checkup-completed', element: <RoleRoute roles={ASHA_ROLES}><CheckUpCompletedAshaSathi /></RoleRoute> },
          { path: 'sync', element: <RoleRoute roles={ASHA_ROLES}><OfflineSyncCenterAshaSathi /></RoleRoute> },
          { path: 'health-survey', element: <RoleRoute roles={ASHA_ROLES}><HealthSurveyAshaSathi /></RoleRoute> },
          { path: 'pregnancy', element: <RoleRoute roles={ASHA_ROLES}><PregnancyTrackingAshaSathi /></RoleRoute> },
          { path: 'child-health', element: <RoleRoute roles={ASHA_ROLES}><ChildHealthAshaSathi /></RoleRoute> },
          { path: 'health-checkup', element: <RoleRoute roles={ASHA_ROLES}><HealthCheckUpAshaSathi /></RoleRoute> },
          { path: 'referrals', element: <RoleRoute roles={ASHA_ROLES}><ReferralAshaSathi /></RoleRoute> },
          { path: 'follow-ups', element: <RoleRoute roles={ASHA_ROLES}><FollowUpAshaSathi /></RoleRoute> },
          { path: 'notifications', element: <RoleRoute roles={ASHA_ROLES}><NotificationsAshaSathi /></RoleRoute> },
          { path: 'profile', element: <RoleRoute roles={ASHA_ROLES}><ProfileSettingsAshaSathi /></RoleRoute> },
        ],
      },
      { path: '/asha/connection-error', element: <RoleRoute roles={ASHA_ROLES}><ConnectionErrorAshaSathi /></RoleRoute> },

      // Patient (mobile bottom nav) ────────────────────────────────────
      {
        path: '/patient',
        element: (
          <ProtectedRoute>
            <ErrorBoundary>
              <AdminLayout />
            </ErrorBoundary>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/patient/dashboard" replace /> },
          { path: 'dashboard', element: <RoleRoute roles={PATIENT_ROLES}><PatientHomePage /></RoleRoute> },
          { path: 'health-profile', element: <RoleRoute roles={PATIENT_ROLES}><PatientHealthProfilePage /></RoleRoute> },
          { path: 'records', element: <RoleRoute roles={PATIENT_ROLES}><PatientHealthRecordsPage /></RoleRoute> },
          { path: 'family', element: <RoleRoute roles={PATIENT_ROLES}><PatientFamilyPage /></RoleRoute> },
          { path: 'vaccination', element: <RoleRoute roles={PATIENT_ROLES}><PatientVaccinationPage /></RoleRoute> },
          { path: 'appointments', element: <RoleRoute roles={PATIENT_ROLES}><PatientAppointmentsPage /></RoleRoute> },
          { path: 'referrals', element: <RoleRoute roles={PATIENT_ROLES}><PatientReferralsPage /></RoleRoute> },
          { path: 'follow-ups', element: <RoleRoute roles={PATIENT_ROLES}><PatientFollowUpsPage /></RoleRoute> },
          { path: 'notifications', element: <RoleRoute roles={PATIENT_ROLES}><PatientNotificationsPage /></RoleRoute> },
          { path: 'profile', element: <RoleRoute roles={PATIENT_ROLES}><PatientProfileSettingsPage /></RoleRoute> },
        ],
      },

      // Admin (PHC + District + State + Super) ─────────────────────────
      {
        element: (
          <ProtectedRoute>
            <ErrorBoundary>
              <AdminLayout />
            </ErrorBoundary>
          </ProtectedRoute>
        ),
        children: [
          // PHC ──────────────────────────────────────────────────────
          { path: '/phc/dashboard', element: <RoleRoute roles={ADMIN_ROLES}><Dashboard /></RoleRoute> },
          { path: '/phc/ashas', element: <RoleRoute roles={ADMIN_ROLES}><Workers /></RoleRoute> },
          { path: '/phc/ashas/:id', element: <RoleRoute roles={ADMIN_ROLES}><WorkerProfile /></RoleRoute> },
          { path: '/phc/ashas/new', element: <RoleRoute roles={ADMIN_ROLES}><AddWorker /></RoleRoute> },
          { path: '/phc/beneficiaries', element: <RoleRoute roles={ADMIN_ROLES}><Beneficiaries /></RoleRoute> },
          { path: '/phc/beneficiaries/:id', element: <RoleRoute roles={ADMIN_ROLES}><BeneficiaryDetails /></RoleRoute> },
          { path: '/phc/beneficiaries/new', element: <RoleRoute roles={ADMIN_ROLES}><AddPatient /></RoleRoute> },
          { path: '/phc/households', element: <RoleRoute roles={ADMIN_ROLES}><Households /></RoleRoute> },
          { path: '/phc/households/new', element: <RoleRoute roles={ADMIN_ROLES}><AddHousehold /></RoleRoute> },
          { path: '/phc/households/:id', element: <RoleRoute roles={ADMIN_ROLES}><HouseholdDetails /></RoleRoute> },
          { path: '/phc/households/:id/survey', element: <RoleRoute roles={ADMIN_ROLES}><HouseholdSurvey /></RoleRoute> },
          { path: '/phc/maternal', element: <RoleRoute roles={ADMIN_ROLES}><MaternalHealth /></RoleRoute> },
          { path: '/phc/maternal/pregnant', element: <RoleRoute roles={ADMIN_ROLES}><PregnantWomen /></RoleRoute> },
          { path: '/phc/maternal/:id', element: <RoleRoute roles={ADMIN_ROLES}><PregnancyDetails /></RoleRoute> },
          { path: '/phc/children', element: <RoleRoute roles={ADMIN_ROLES}><ChildrenDir /></RoleRoute> },
          { path: '/phc/children/:id', element: <RoleRoute roles={ADMIN_ROLES}><ChildProfile /></RoleRoute> },
          { path: '/phc/children/:id/vaccination', element: <RoleRoute roles={ADMIN_ROLES}><VaccinationSchedule /></RoleRoute> },
          { path: '/phc/growth-nutrition', element: <RoleRoute roles={ADMIN_ROLES}><NutritionMonitoring /></RoleRoute> },
          { path: '/phc/vaccination', element: <RoleRoute roles={ADMIN_ROLES}><Vaccination /></RoleRoute> },
          { path: '/phc/vaccination/new', element: <RoleRoute roles={ADMIN_ROLES}><NewVaccination /></RoleRoute> },
          { path: '/phc/health-checkups/new', element: <RoleRoute roles={ADMIN_ROLES}><NewCheckup /></RoleRoute> },
          { path: '/phc/health-checkups/history', element: <RoleRoute roles={ADMIN_ROLES}><CheckupHistory /></RoleRoute> },
          { path: '/phc/referrals', element: <RoleRoute roles={ADMIN_ROLES}><Referrals /></RoleRoute> },
          { path: '/phc/referrals/new', element: <RoleRoute roles={ADMIN_ROLES}><NewReferral /></RoleRoute> },
          { path: '/phc/referrals/:id', element: <RoleRoute roles={ADMIN_ROLES}><ReferralDetails /></RoleRoute> },
          { path: '/phc/alerts', element: <RoleRoute roles={ADMIN_ROLES}><Alerts /></RoleRoute> },
          { path: '/phc/alerts/critical', element: <RoleRoute roles={ADMIN_ROLES}><CriticalAlerts /></RoleRoute> },
          { path: '/phc/follow-ups', element: <RoleRoute roles={ADMIN_ROLES}><FollowUps /></RoleRoute> },
          { path: '/phc/notifications', element: <RoleRoute roles={ADMIN_ROLES}><Notifications /></RoleRoute> },
          { path: '/phc/reports', element: <RoleRoute roles={ADMIN_ROLES}><ReportCenter /></RoleRoute> },
          { path: '/phc/reports/maternal', element: <RoleRoute roles={ADMIN_ROLES}><MaternalReport /></RoleRoute> },
          { path: '/phc/reports/child-vaccination', element: <RoleRoute roles={ADMIN_ROLES}><ChildVaccinationReport /></RoleRoute> },
          { path: '/phc/reports/asha-performance', element: <RoleRoute roles={ADMIN_ROLES}><AshaPerformance /></RoleRoute> },
          { path: '/phc/analytics', element: <RoleRoute roles={ADMIN_ROLES}><Analytics /></RoleRoute> },
          { path: '/phc/risk-analysis', element: <RoleRoute roles={ADMIN_ROLES}><RiskAnalysis /></RoleRoute> },
          { path: '/phc/audit-logs', element: <RoleRoute roles={ADMIN_ROLES}><AuditLogs /></RoleRoute> },
          { path: '/phc/settings', element: <RoleRoute roles={ADMIN_ROLES}><Settings /></RoleRoute> },
          { path: '/phc/births/new', element: <RoleRoute roles={ADMIN_ROLES}><NewBirth /></RoleRoute> },
          { path: '/phc/villages/new', element: <RoleRoute roles={ADMIN_ROLES}><AddVillage /></RoleRoute> },
          { path: '/phc/sanitize', element: <RoleRoute roles={ADMIN_ROLES}><Sanitize /></RoleRoute> },

          // District ─────────────────────────────────────────────────
          // District / State / Super — unified under /phc/* ─────────────
          { path: '/phc/district-dashboard', element: <RoleRoute roles={ADMIN_ROLES}><DistrictDashboardPage /></RoleRoute> },
          { path: '/phc/phc-comparison', element: <RoleRoute roles={ADMIN_ROLES}><PHCComparisonPage /></RoleRoute> },
          { path: '/phc/resources', element: <RoleRoute roles={ADMIN_ROLES}><ResourceAllocationPage /></RoleRoute> },
          { path: '/phc/state-dashboard', element: <RoleRoute roles={ADMIN_ROLES}><StateDashboardPage /></RoleRoute> },
          { path: '/phc/district-comparison', element: <RoleRoute roles={ADMIN_ROLES}><DistrictComparisonPage /></RoleRoute> },
          { path: '/phc/users', element: <RoleRoute roles={ADMIN_ROLES}><UserManagementPage /></RoleRoute> },
          { path: '/phc/deployment', element: <RoleRoute roles={ADMIN_ROLES}><DeploymentPage /></RoleRoute> },

          // Legacy URLs → redirect to unified /phc/* ────────────────────
          { path: '/district/dashboard', element: <Navigate to="/phc/district-dashboard" replace /> },
          { path: '/district/phc-comparison', element: <Navigate to="/phc/phc-comparison" replace /> },
          { path: '/district/resources', element: <Navigate to="/phc/resources" replace /> },
          { path: '/state/dashboard', element: <Navigate to="/phc/state-dashboard" replace /> },
          { path: '/state/district-comparison', element: <Navigate to="/phc/district-comparison" replace /> },
          { path: '/state/audit-logs', element: <Navigate to="/phc/audit-logs" replace /> },
          { path: '/super/users', element: <Navigate to="/phc/users" replace /> },
          { path: '/super/deployment', element: <Navigate to="/phc/deployment" replace /> },
        ],
      },

      { path: '/session-expired', element: <SessionExpiredScreen /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
    errorElement: <ErrorBoundary />,
  },
])
