import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/auth_repository.dart';
import '../auth/auth_state.dart';
import '../offline/database.dart';
import '../offline/sync_engine.dart';
import '../../features/abha/data/abha_repository.dart';
import '../../features/beneficiary/data/beneficiary_repository.dart';
import '../../features/child/data/child_repository.dart';
import '../../features/dashboard/data/dashboard_repository.dart';
import '../../features/death_reports/data/death_report_repository.dart';
import '../../features/disease_control/data/disease_repository.dart';
import '../../features/eligible_couple/data/eligible_couple_repository.dart';
import '../../features/household/data/household_repository.dart';
import '../../features/incentives/data/incentive_repository.dart';
import '../../features/maternal/data/maternal_repository.dart';
import '../../features/ncd/data/ncd_repository.dart';

/// Shared Dio instance with JSON + auth interceptors.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: '',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    ),
  );
  dio.interceptors.add(LogInterceptor(requestBody: false, responseBody: false));
  return dio;
});

/// Supabase client used for realtime channels + auth fallback.
final supabaseProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

/// Local Drift database singleton.
final databaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});

/// Auth repository (OTP / biometric endpoints).
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(dio: ref.watch(dioProvider));
});

/// Auth state ChangeNotifier.
final authStateProvider = ChangeNotifierProvider<AuthState>((ref) {
  return AuthState();
});

/// Sync engine for offline-first synchronisation.
final syncEngineProvider = Provider<SyncEngine>((ref) {
  return SyncEngine(
    database: ref.watch(databaseProvider),
    supabase: ref.watch(supabaseProvider),
    dio: ref.watch(dioProvider),
  );
});

// ---------------------------------------------------------------------------
// Feature repositories
// ---------------------------------------------------------------------------

final householdRepositoryProvider = Provider<HouseholdRepository>((ref) {
  return HouseholdRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final beneficiaryRepositoryProvider = Provider<BeneficiaryRepository>((ref) {
  return BeneficiaryRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final maternalRepositoryProvider = Provider<MaternalRepository>((ref) {
  return MaternalRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final childRepositoryProvider = Provider<ChildRepository>((ref) {
  return ChildRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final eligibleCoupleRepositoryProvider = Provider<EligibleCoupleRepository>((ref) {
  return EligibleCoupleRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final ncdRepositoryProvider = Provider<NCDRepository>((ref) {
  return NCDRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final diseaseRepositoryProvider = Provider<DiseaseRepository>((ref) {
  return DiseaseRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final deathReportRepositoryProvider = Provider<DeathReportRepository>((ref) {
  return DeathReportRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final incentiveRepositoryProvider = Provider<IncentiveRepository>((ref) {
  return IncentiveRepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});

final abhaRepositoryProvider = Provider<ABHARepository>((ref) {
  return ABHARepository(
    dio: ref.watch(dioProvider),
    database: ref.watch(databaseProvider),
  );
});
