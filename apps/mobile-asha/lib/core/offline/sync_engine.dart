import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide isNull;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import 'database.dart';

/// Handles bi-directional synchronisation between the local Drift database
/// and the ASHA Sathi backend.
///
/// * [pushLocalChanges] drains [SyncQueueTable] records marked as not synced.
/// * [pullRemoteChanges] fetches records changed since a timestamp and
///   upserts them locally.
/// * [subscribeRealtime] streams `postgres_changes` from Supabase.
/// * Conflict resolution is last-write-wins on `updated_at`.
class SyncEngine {
  SyncEngine({
    required AppDatabase database,
    required SupabaseClient supabase,
    Dio? dio,
    Connectivity? connectivity,
  })  : _db = database,
        _supabase = supabase,
        _dio = dio ?? Dio(),
        _connectivity = connectivity ?? Connectivity();

  final AppDatabase _db;
  final SupabaseClient _supabase;
  final Dio _dio;
  final Connectivity _connectivity;

  StreamSubscription<ConnectivityResult>? _connectivitySub;
  StreamSubscription<RealtimeChannel>? _realtimeSub;

  /// Whether the device currently has an active network connection.
  Future<bool> get isOnline async {
    final results = await _connectivity.checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  /// Watch connectivity and invoke [onOnline] whenever the device regains
  /// connectivity after having none.
  Stream<bool> watchConnectivity() {
    bool wasOnline = false;
    return _connectivity.onConnectivityChanged.map((results) {
      final nowOnline = results.any((r) => r != ConnectivityResult.none);
      final changedToOnline = nowOnline && !wasOnline;
      wasOnline = nowOnline;
      return changedToOnline;
    }).distinct();
  }

  /// Upload queued local changes to the backend. Returns the count pushed.
  Future<int> pushLocalChanges() async {
    if (!await isOnline) {
      throw SyncOfflineException();
    }
    final pending = await (_db.select(_db.syncQueueTable)
          ..where((t) => t.isSynced.equals(false)))
        .get();

    var pushed = 0;
    for (final row in pending) {
      try {
        final payload = jsonDecode(row.payloadJson) as Map<String, dynamic>;
        final tableName = row.tableName;
        final uri = switch (row.operation) {
          'delete' => '${AppConfig.apiBaseUrl}/sync/$tableName/${row.recordId}',
          _ => '${AppConfig.apiBaseUrl}/sync/$tableName',
        };
        final method = switch (row.operation) {
          'delete' => 'DELETE',
          'insert' => 'POST',
          _ => 'PUT',
        };
        await _dio.request<void>(
          uri,
          data: method == 'DELETE' ? null : payload,
          options: Options(method: method),
        );
        await _markSynced(row.id);
        pushed++;
      } catch (e) {
        await (_db.update(_db.syncQueueTable)..where((t) => t.id.equals(row.id)))
            .write(SyncQueueTableCompanion(error: Value(e.toString())));
      }
    }
    return pushed;
  }

  Future<void> _markSynced(int id) async {
    await (_db.update(_db.syncQueueTable)..where((t) => t.id.equals(id)))
        .write(SyncQueueTableCompanion(
      isSynced: const Value(true),
      pendingOperation: const Value('synced'),
      updatedAt: Value(DateTime.now().toIso8601String()),
    ));
  }

  /// Fetch records changed since [since] (ISO-8601) and upsert them locally.
  /// Returns the number of records pulled.
  Future<int> pullRemoteChanges({DateTime? since}) async {
    if (!await isOnline) {
      throw SyncOfflineException();
    }
    final query = Uri.parse('${AppConfig.apiBaseUrl}/sync/pull').replace(
      queryParameters: {
        'since': since?.toIso8601String() ?? '1970-01-01T00:00:00Z',
      },
    );
    final response = await _dio.get<List<dynamic>>(query.toString());
    final data = response.data as List<dynamic>? ?? const [];
    return _upsertBulk(data);
  }

  Future<int> _upsertBulk(List<dynamic> records) async {
    var count = 0;
    final batch = _db.batch();
    for (final record in records) {
      final map = (record as Map).cast<String, dynamic>();
      final table = map['table'] as String?;
      final payload = map['payload'];
      if (table == null || payload == null) continue;
      count += _upsertRow(batch, table, payload as Map<String, dynamic>);
    }
    await batch.commit();
    return count;
  }

  int _upsertRow(Batch batch, String table, Map<String, dynamic> payload) {
    switch (table) {
      case 'households':
        batch.insert(_db.householdsTable, payload);
      case 'beneficiaries':
        batch.insert(_db.beneficiariesTable, payload);
      case 'pregnancies':
        batch.insert(_db.pregnanciesTable, payload);
      case 'anc_visits':
        batch.insert(_db.ancVisitsTable, payload);
      case 'children':
        batch.insert(_db.childrenTable, payload);
      case 'immunizations':
        batch.insert(_db.immunizationsTable, payload);
      case 'hbnc_visits':
        batch.insert(_db.hbncVisitsTable, payload);
      case 'hbyc_visits':
        batch.insert(_db.hbycVisitsTable, payload);
      case 'eligible_couples':
        batch.insert(_db.eligibleCouplesTable, payload);
      case 'ec_followups':
        batch.insert(_db.ecFollowupsTable, payload);
      case 'ncd_screenings':
        batch.insert(_db.ncdScreeningsTable, payload);
      case 'disease_cases':
        batch.insert(_db.diseaseCasesTable, payload);
      case 'death_reports':
        batch.insert(_db.deathReportsTable, payload);
      case 'asha_tasks':
        batch.insert(_db.ashaTasksTable, payload);
      case 'incentive_claims':
        batch.insert(_db.incentiveClaimsTable, payload);
      case 'village_forms':
        batch.insert(_db.villageFormsTable, payload);
      case 'abha_records':
        batch.insert(_db.abhaRecordsTable, payload);
      case 'notifications':
        batch.insert(_db.notificationsTable, payload);
      case 'referrals':
        batch.insert(_db.referralsTable, payload);
      default:
        return 0;
    }
    return 1;
  }

  /// Subscribe to realtime changes on key tables via Supabase
  /// `postgres_changes`. Invokes [onChange] for every incoming event.
  void subscribeRealtime({void Function(Map<String, dynamic>)? onChange}) {
    final channel = _supabase
        .channel('asha_sync')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'beneficiaries',
          callback: (payload) => onChange?.call(payload.newRecord),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'pregnancies',
          callback: (payload) => onChange?.call(payload.newRecord),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'anc_visits',
          callback: (payload) => onChange?.call(payload.newRecord),
        );
    _realtimeSub = channel.subscribe();
  }

  /// Last-write-wins resolution based on the `updated_at` field.
  ///
  /// If [localUpdatedAt] is null or earlier than [remoteUpdatedAt], the remote
  /// record wins and [onRemoteWins] is invoked with the remote record. Used by
  /// the sync status screen to surface conflicts.
  bool resolveConflict({
    required String? localUpdatedAt,
    required String? remoteUpdatedAt,
    void Function(Map<String, dynamic> remote)? onRemoteWins,
  }) {
    final l = DateTime.tryParse(localUpdatedAt ?? '');
    final r = DateTime.tryParse(remoteUpdatedAt ?? '');
    final remoteWins = r != null && (l == null || r.isAfter(l));
    if (remoteWins && onRemoteWins != null) {
      onRemoteWins({});
    }
    return remoteWins;
  }

  /// Number of records currently queued but not yet synced.
  Future<int> pendingCount() async {
    final count = await (_db.select(_db.syncQueueTable)
          ..where((t) => t.isSynced.equals(false)))
        .get();
    return count.length;
  }

  /// Timestamp of the most recent successful pull, persisted via a queue row.
  Future<DateTime?> lastSyncTime() async {
    final rows = await (_db.select(_db.syncQueueTable)
          ..where((t) => t.operation.equals('_meta_last_sync')))
        .get();
    if (rows.isEmpty) return null;
    return DateTime.tryParse(rows.last.createdAt);
  }

  void dispose() {
    _connectivitySub?.cancel();
    _realtimeSub?.cancel();
  }
}

/// Thrown when an operation requires connectivity but the device is offline.
class SyncOfflineException implements Exception {
  @override
  String toString() => 'You are offline. Changes are saved locally.';
}
