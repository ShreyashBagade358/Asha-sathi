import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_repository.dart';
import '../auth/auth_state.dart';
import '../../app_shell.dart';
import '../../screens/home_screen.dart';
import '../../screens/login_screen.dart';
import '../../screens/splash_screen.dart';
import '../../features/appointments/appointment_detail_screen.dart';
import '../../features/appointments/appointments_screen.dart';
import '../../features/emergency/emergency_contacts_screen.dart';
import '../../features/emergency/emergency_screen.dart';
import '../../features/grievance/grievance_list_screen.dart';
import '../../features/grievance/grievance_screen.dart';
import '../../features/grievance/grievance_status_screen.dart';
import '../../features/health_records/record_detail_screen.dart';
import '../../features/health_records/record_sharing_screen.dart';
import '../../features/health_records/records_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/reminders/reminder_form_screen.dart';
import '../../features/reminders/reminders_screen.dart';
import '../../features/schemes/scheme_detail_screen.dart';
import '../../features/schemes/schemes_screen.dart';

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
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/records/:id',
        builder: (context, state) =>
            RecordDetailScreen(recordId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/records/:id/share',
        builder: (context, state) =>
            RecordSharingScreen(recordId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/appointments',
        builder: (context, state) => const AppointmentsScreen(),
      ),
      GoRoute(
        path: '/appointments/:id',
        builder: (context, state) =>
            AppointmentDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/reminders',
        builder: (context, state) => const RemindersScreen(),
      ),
      GoRoute(
        path: '/reminders/new',
        builder: (context, state) => const ReminderFormScreen(),
      ),
      GoRoute(
        path: '/schemes',
        builder: (context, state) => const SchemesScreen(),
      ),
      GoRoute(
        path: '/schemes/:id',
        builder: (context, state) => SchemeDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/grievance',
        builder: (context, state) => const GrievanceScreen(),
      ),
      GoRoute(
        path: '/grievance/list',
        builder: (context, state) => const GrievanceListScreen(),
      ),
      GoRoute(
        path: '/grievance/status/:id',
        builder: (context, state) =>
            GrievanceStatusScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/emergency',
        builder: (context, state) => const EmergencyScreen(),
      ),
      GoRoute(
        path: '/emergency/contacts',
        builder: (context, state) => const EmergencyContactsScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const HomeScreen(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/records',
              builder: (context, state) => const RecordsScreen(),
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
