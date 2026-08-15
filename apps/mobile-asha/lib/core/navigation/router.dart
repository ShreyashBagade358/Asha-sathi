import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app_shell.dart';
import '../../features/abha/presentation/abha_consent_screen.dart';
import '../../features/abha/presentation/abha_link_screen.dart';
import '../../features/abha/presentation/abha_status_screen.dart';
import '../../features/ai_assistant/presentation/ai_assistant_chat_screen.dart';
import '../../features/ai_assistant/presentation/child_growth_screen.dart';
import '../../features/ai_assistant/presentation/maternal_risk_screen.dart';
import '../../features/ai_assistant/presentation/ncd_risk_screen.dart';
import '../../features/ai_assistant/presentation/voice_input_screen.dart';
import '../../features/beneficiary/presentation/beneficiary_detail_screen.dart';
import '../../features/beneficiary/presentation/beneficiary_form_screen.dart';
import '../../features/beneficiary/presentation/beneficiary_list_screen.dart';
import '../../features/child/presentation/child_detail_screen.dart';
import '../../features/child/presentation/child_list_screen.dart';
import '../../features/child/presentation/child_registration_screen.dart';
import '../../features/child/presentation/growth_chart_screen.dart';
import '../../features/child/presentation/hbnc_visit_screen.dart';
import '../../features/child/presentation/hbyc_visit_screen.dart';
import '../../features/child/presentation/immunization_record_screen.dart';
import '../../features/child/presentation/immunization_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/dashboard/presentation/work_plan_screen.dart';
import '../../features/death_reports/presentation/death_report_detail_screen.dart';
import '../../features/death_reports/presentation/death_report_form_screen.dart';
import '../../features/death_reports/presentation/death_report_list_screen.dart';
import '../../features/disease_control/presentation/disease_case_detail_screen.dart';
import '../../features/disease_control/presentation/disease_case_form_screen.dart';
import '../../features/disease_control/presentation/disease_case_list_screen.dart';
import '../../features/disease_control/presentation/disease_outbreak_map_screen.dart';
import '../../features/eligible_couple/presentation/ec_detail_screen.dart';
import '../../features/eligible_couple/presentation/ec_followup_screen.dart';
import '../../features/eligible_couple/presentation/ec_list_screen.dart';
import '../../features/eligible_couple/presentation/ec_registration_screen.dart';
import '../../features/household/presentation/household_detail_screen.dart';
import '../../features/household/presentation/household_form_screen.dart';
import '../../features/household/presentation/household_list_screen.dart';
import '../../features/incentives/presentation/incentive_claim_screen.dart';
import '../../features/incentives/presentation/incentive_list_screen.dart';
import '../../features/incentives/presentation/village_form_list_screen.dart';
import '../../features/incentives/presentation/village_form_screen.dart';
import '../../features/maternal/presentation/anc_record_screen.dart';
import '../../features/maternal/presentation/delivery_record_screen.dart';
import '../../features/maternal/presentation/hrp_list_screen.dart';
import '../../features/maternal/presentation/micro_birth_plan_screen.dart';
import '../../features/maternal/presentation/pnc_record_screen.dart';
import '../../features/maternal/presentation/pregnancy_list_screen.dart';
import '../../features/maternal/presentation/pregnancy_registration_screen.dart';
import '../../features/ncd/presentation/cbac_screening_form_screen.dart';
import '../../features/ncd/presentation/ncd_due_list_screen.dart';
import '../../features/notifications/presentation/notification_detail_screen.dart';
import '../../features/notifications/presentation/notification_list_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/sync/presentation/sync_status_screen.dart';
import '../../features/training/presentation/training_certificate_screen.dart';
import '../../features/training/presentation/training_detail_screen.dart';
import '../../features/training/presentation/training_list_screen.dart';
import '../../screens/login_screen.dart';
import '../../screens/otp_screen.dart';
import '../../screens/splash_screen.dart';

/// Route name constants used across the app for `context.pushNamed`.
abstract class AppRoutes {
  static const splash = 'splash';
  static const login = 'login';
  static const otp = 'otp';

  static const home = 'home';
  static const dashboard = 'dashboard';
  static const beneficiaries = 'beneficiaries';
  static const workPlan = 'work-plan';
  static const aiAssistant = 'ai-assistant';
  static const more = 'more';

  static const households = 'households';
  static const householdNew = 'household-new';
  static const householdDetail = 'household-detail';

  static const beneficiaryNew = 'beneficiary-new';
  static const beneficiaryDetail = 'beneficiary-detail';

  static const pregnancy = 'pregnancy';
  static const pregnancyRegister = 'pregnancy-register';
  static const ancRecord = 'anc-record';
  static const deliveryRecord = 'delivery-record';
  static const pncRecord = 'pnc-record';
  static const microBirthPlan = 'micro-birth-plan';
  static const hrpList = 'hrp-list';

  static const children = 'children';
  static const childRegister = 'child-register';
  static const childDetail = 'child-detail';
  static const immunization = 'immunization';
  static const immunizationRecord = 'immunization-record';
  static const hbncVisit = 'hbnc-visit';
  static const hbycVisit = 'hbyc-visit';
  static const growthChart = 'growth-chart';

  static const ecList = 'ec-list';
  static const ecRegister = 'ec-register';
  static const ecDetail = 'ec-detail';
  static const ecFollowup = 'ec-followup';

  static const ncdDueList = 'ncd-due-list';
  static const cbacScreening = 'cbac-screening';

  static const diseaseList = 'disease-list';
  static const diseaseNew = 'disease-new';
  static const diseaseDetail = 'disease-detail';
  static const diseaseOutbreakMap = 'disease-outbreak-map';

  static const deathList = 'death-list';
  static const deathNew = 'death-new';
  static const deathDetail = 'death-detail';

  static const incentives = 'incentives';
  static const incentiveClaim = 'incentive-claim';
  static const villageForms = 'village-forms';
  static const villageFormNew = 'village-form-new';

  static const abhaLink = 'abha-link';
  static const abhaStatus = 'abha-status';
  static const abhaConsent = 'abha-consent';

  static const trainingList = 'training-list';
  static const trainingDetail = 'training-detail';
  static const trainingCertificate = 'training-certificate';

  static const maternalRisk = 'maternal-risk';
  static const childGrowth = 'child-growth';
  static const ncdRisk = 'ncd-risk';
  static const aiChat = 'ai-chat';
  static const voiceInput = 'voice-input';

  static const notificationList = 'notification-list';
  static const notificationDetail = 'notification-detail';

  static const syncStatus = 'sync-status';
  static const settings = 'settings';
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        name: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        name: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/otp',
        name: AppRoutes.otp,
        builder: (context, state) {
          final phone = state.extra as String? ?? '';
          return OtpScreen(phone: phone);
        },
      ),
      // ---------------------------------------------------------------
      // Authenticated shell
      // ---------------------------------------------------------------
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            name: AppRoutes.home,
            redirect: (context, state) => '/home/dashboard',
          ),
          GoRoute(
            path: '/home/dashboard',
            name: AppRoutes.dashboard,
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/home/beneficiaries',
            name: AppRoutes.beneficiaries,
            builder: (context, state) => const BeneficiaryListScreen(),
          ),
          GoRoute(
            path: '/home/work-plan',
            name: AppRoutes.workPlan,
            builder: (context, state) => const WorkPlanScreen(),
          ),
          GoRoute(
            path: '/home/ai',
            name: AppRoutes.aiAssistant,
            builder: (context, state) => const AIAssistantChatScreen(),
          ),
          GoRoute(
            path: '/home/more',
            name: AppRoutes.more,
            builder: (context, state) => const SettingsScreen(),
          ),
          // Households
          GoRoute(
            path: '/households',
            name: AppRoutes.households,
            builder: (context, state) => const HouseholdListScreen(),
          ),
          GoRoute(
            path: '/households/new',
            name: AppRoutes.householdNew,
            builder: (context, state) => const HouseholdFormScreen(),
          ),
          GoRoute(
            path: '/households/:id',
            name: AppRoutes.householdDetail,
            builder: (context, state) =>
                HouseholdDetailScreen(id: state.pathParameters['id']!),
          ),
          // Beneficiary
          GoRoute(
            path: '/beneficiaries/new',
            name: AppRoutes.beneficiaryNew,
            builder: (context, state) => const BeneficiaryFormScreen(),
          ),
          GoRoute(
            path: '/beneficiaries/:id',
            name: AppRoutes.beneficiaryDetail,
            builder: (context, state) =>
                BeneficiaryDetailScreen(id: state.pathParameters['id']!),
          ),
          // Maternal
          GoRoute(
            path: '/maternal',
            name: AppRoutes.pregnancy,
            builder: (context, state) => const PregnancyListScreen(),
          ),
          GoRoute(
            path: '/maternal/register',
            name: AppRoutes.pregnancyRegister,
            builder: (context, state) => const PregnancyRegistrationScreen(),
          ),
          GoRoute(
            path: '/maternal/anc/:pregnancyId',
            name: AppRoutes.ancRecord,
            builder: (context, state) =>
                ANCRecordScreen(pregnancyId: state.pathParameters['pregnancyId']!),
          ),
          GoRoute(
            path: '/maternal/delivery/:pregnancyId',
            name: AppRoutes.deliveryRecord,
            builder: (context, state) => DeliveryRecordScreen(
                pregnancyId: state.pathParameters['pregnancyId']!),
          ),
          GoRoute(
            path: '/maternal/pnc/:beneficiaryId',
            name: AppRoutes.pncRecord,
            builder: (context, state) =>
                PNCRecordScreen(beneficiaryId: state.pathParameters['beneficiaryId']!),
          ),
          GoRoute(
            path: '/maternal/mbp/:pregnancyId',
            name: AppRoutes.microBirthPlan,
            builder: (context, state) =>
                MicroBirthPlanScreen(pregnancyId: state.pathParameters['pregnancyId']!),
          ),
          GoRoute(
            path: '/maternal/hrp',
            name: AppRoutes.hrpList,
            builder: (context, state) => const HRPListScreen(),
          ),
          // Child
          GoRoute(
            path: '/children',
            name: AppRoutes.children,
            builder: (context, state) => const ChildListScreen(),
          ),
          GoRoute(
            path: '/children/register',
            name: AppRoutes.childRegister,
            builder: (context, state) => const ChildRegistrationScreen(),
          ),
          GoRoute(
            path: '/children/:id',
            name: AppRoutes.childDetail,
            builder: (context, state) =>
                ChildDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/children/:id/immunization',
            name: AppRoutes.immunization,
            builder: (context, state) =>
                ImmunizationScreen(childId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/children/:id/immunization/record/:vaccineId',
            name: AppRoutes.immunizationRecord,
            builder: (context, state) => ImmunizationRecordScreen(
              childId: state.pathParameters['id']!,
              vaccineId: state.pathParameters['vaccineId']!,
            ),
          ),
          GoRoute(
            path: '/children/:id/hbnc',
            name: AppRoutes.hbncVisit,
            builder: (context, state) =>
                HBNCVisitScreen(childId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/children/:id/hbyc',
            name: AppRoutes.hbycVisit,
            builder: (context, state) =>
                HBYCVisitScreen(childId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/children/:id/growth',
            name: AppRoutes.growthChart,
            builder: (context, state) =>
                GrowthChartScreen(childId: state.pathParameters['id']!),
          ),
          // Eligible couples
          GoRoute(
            path: '/ec',
            name: AppRoutes.ecList,
            builder: (context, state) => const ECListScreen(),
          ),
          GoRoute(
            path: '/ec/new',
            name: AppRoutes.ecRegister,
            builder: (context, state) => const ECRegistrationScreen(),
          ),
          GoRoute(
            path: '/ec/:id',
            name: AppRoutes.ecDetail,
            builder: (context, state) => ECDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/ec/:id/followup',
            name: AppRoutes.ecFollowup,
            builder: (context, state) =>
                ECFollowupScreen(ecId: state.pathParameters['id']!),
          ),
          // NCD
          GoRoute(
            path: '/ncd',
            name: AppRoutes.ncdDueList,
            builder: (context, state) => const NCDDueListScreen(),
          ),
          GoRoute(
            path: '/ncd/screening',
            name: AppRoutes.cbacScreening,
            builder: (context, state) => const CBACScreeningFormScreen(),
          ),
          // Disease control
          GoRoute(
            path: '/disease',
            name: AppRoutes.diseaseList,
            builder: (context, state) => const DiseaseCaseListScreen(),
          ),
          GoRoute(
            path: '/disease/new',
            name: AppRoutes.diseaseNew,
            builder: (context, state) => const DiseaseCaseFormScreen(),
          ),
          GoRoute(
            path: '/disease/:id',
            name: AppRoutes.diseaseDetail,
            builder: (context, state) =>
                DiseaseCaseDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/disease/outbreak-map',
            name: AppRoutes.diseaseOutbreakMap,
            builder: (context, state) => const DiseaseOutbreakMapScreen(),
          ),
          // Death reports
          GoRoute(
            path: '/deaths',
            name: AppRoutes.deathList,
            builder: (context, state) => const DeathReportListScreen(),
          ),
          GoRoute(
            path: '/deaths/new',
            name: AppRoutes.deathNew,
            builder: (context, state) => const DeathReportFormScreen(),
          ),
          GoRoute(
            path: '/deaths/:id',
            name: AppRoutes.deathDetail,
            builder: (context, state) =>
                DeathReportDetailScreen(id: state.pathParameters['id']!),
          ),
          // Incentives
          GoRoute(
            path: '/incentives',
            name: AppRoutes.incentives,
            builder: (context, state) => const IncentiveListScreen(),
          ),
          GoRoute(
            path: '/incentives/claim',
            name: AppRoutes.incentiveClaim,
            builder: (context, state) => const IncentiveClaimScreen(),
          ),
          GoRoute(
            path: '/forms',
            name: AppRoutes.villageForms,
            builder: (context, state) => const VillageFormListScreen(),
          ),
          GoRoute(
            path: '/forms/new',
            name: AppRoutes.villageFormNew,
            builder: (context, state) => const VillageFormScreen(),
          ),
          // ABHA
          GoRoute(
            path: '/abha/link',
            name: AppRoutes.abhaLink,
            builder: (context, state) => const ABHALinkScreen(),
          ),
          GoRoute(
            path: '/abha/status',
            name: AppRoutes.abhaStatus,
            builder: (context, state) => const ABHAStatusScreen(),
          ),
          GoRoute(
            path: '/abha/consent',
            name: AppRoutes.abhaConsent,
            builder: (context, state) => const ABHAConsentScreen(),
          ),
          // Training
          GoRoute(
            path: '/training',
            name: AppRoutes.trainingList,
            builder: (context, state) => const TrainingListScreen(),
          ),
          GoRoute(
            path: '/training/:id',
            name: AppRoutes.trainingDetail,
            builder: (context, state) =>
                TrainingDetailScreen(id: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/training/certificate/:id',
            name: AppRoutes.trainingCertificate,
            builder: (context, state) => TrainingCertificateScreen(
                trainingId: state.pathParameters['id']!),
          ),
          // AI
          GoRoute(
            path: '/ai/maternal-risk',
            name: AppRoutes.maternalRisk,
            builder: (context, state) => const MaternalRiskScreen(),
          ),
          GoRoute(
            path: '/ai/child-growth',
            name: AppRoutes.childGrowth,
            builder: (context, state) => const ChildGrowthScreen(),
          ),
          GoRoute(
            path: '/ai/ncd-risk',
            name: AppRoutes.ncdRisk,
            builder: (context, state) => const NCDRiskScreen(),
          ),
          GoRoute(
            path: '/ai/voice',
            name: AppRoutes.voiceInput,
            builder: (context, state) => const VoiceInputScreen(),
          ),
          // Notifications
          GoRoute(
            path: '/notifications',
            name: AppRoutes.notificationList,
            builder: (context, state) => const NotificationListScreen(),
          ),
          GoRoute(
            path: '/notifications/:id',
            name: AppRoutes.notificationDetail,
            builder: (context, state) => NotificationDetailScreen(
                id: state.pathParameters['id']!),
          ),
          // Sync
          GoRoute(
            path: '/sync',
            name: AppRoutes.syncStatus,
            builder: (context, state) => const SyncStatusScreen(),
          ),
          GoRoute(
            path: '/settings',
            name: AppRoutes.settings,
            builder: (context, state) => const SettingsScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) =>
        const BeneficiaryListScreen(), // pragmatic fallback
  );
});
