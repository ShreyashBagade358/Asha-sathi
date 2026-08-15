import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_repository.dart';
import '../auth/auth_state.dart';
import '../../app_shell.dart';
import '../../screens/login_screen.dart';
import '../../screens/splash_screen.dart';
import '../../features/alerts/alert_detail_screen.dart';
import '../../features/alerts/alerts_screen.dart';
import '../../features/beneficiary_review/verification_detail_screen.dart';
import '../../features/beneficiary_review/verification_queue_screen.dart';
import '../../features/dashboard/phc_dashboard_screen.dart';
import '../../features/facility_mgmt/facility_detail_screen.dart';
import '../../features/facility_mgmt/facility_list_screen.dart';
import '../../features/reports/report_detail_screen.dart';
import '../../features/reports/reports_screen.dart';
import '../../features/staff_mgmt/staff_detail_screen.dart';
import '../../features/staff_mgmt/staff_form_screen.dart';
import '../../features/staff_mgmt/staff_list_screen.dart';
import '../../features/staff_mgmt/staff_model.dart';
import '../../screens/more_screen.dart';

/// Application router. Auth-aware redirect keeps every route behind login.
final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider.notifier);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: auth,
    redirect: (context, state) {
      final status = ref.read(authControllerProvider);
      final location = state.matchedLocation;

      if (location == '/splash') {
        return status is AuthUnknown ? null : (status is AuthAuthenticated ? '/' : '/login');
      }
      if (status is AuthUnknown) return '/splash';
      if (status is AuthUnauthenticated) {
        return location == '/login' ? null : '/login';
      }
      if (status is AuthAuthenticated && location == '/login') return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/facility',
        builder: (context, state) => const FacilityListScreen(),
      ),
      GoRoute(
        path: '/facility/:id',
        builder: (context, state) => FacilityDetailScreen(facilityId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/staff',
        builder: (context, state) => const StaffListScreen(),
      ),
      GoRoute(
        path: '/staff/new',
        builder: (context, state) => StaffFormScreen(
          initial: state.extra is StaffModel ? state.extra as StaffModel : null,
        ),
      ),
      GoRoute(
        path: '/staff/:id',
        builder: (context, state) => StaffDetailScreen(staffId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/verification',
        builder: (context, state) => const VerificationQueueScreen(),
      ),
      GoRoute(
        path: '/verification/:id',
        builder: (context, state) => VerificationDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/reports',
        builder: (context, state) => const ReportsScreen(),
      ),
      GoRoute(
        path: '/reports/:period',
        builder: (context, state) => ReportDetailScreen(period: state.pathParameters['period']!),
      ),
      GoRoute(
        path: '/alerts',
        builder: (context, state) => const AlertsScreen(),
      ),
      GoRoute(
        path: '/alerts/:id',
        builder: (context, state) => AlertDetailScreen(alertId: state.pathParameters['id']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const PHCDashboardScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/beneficiaries',
              builder: (context, state) => const VerificationQueueScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/alerts-tab',
              builder: (context, state) => const AlertsScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/more',
              builder: (context, state) => const MoreScreen(),
            ),
          ]),
        ],
      ),
    ],
  );
});
