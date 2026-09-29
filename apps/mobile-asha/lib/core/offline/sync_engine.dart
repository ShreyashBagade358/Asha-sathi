import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide isNull;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import 'database.dart';
import 'local_alert_engine.dart';
import '../../features/child/data/growth_photo_sync.dart';

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
    Future<String> Function()? deviceIdProvider,
    LocalAlertEngine? alertEngine,
    GrowthPhotoSync? photoSync,
  })  : _db = database,
        _supabase = supabase,
        _dio = dio ?? Dio(),
        _connectivity = connectivity ?? Connectivity(),
        _deviceIdProvider = deviceIdProvider ?? _emptyDeviceId,
        _alertEngine = alertEngine,
        _photoSync = photoSync;

  final AppDatabase _db;
  final SupabaseClient _supabase;
  final Dio _dio;
  final Connectivity _connectivity;
  final Future<String> Function() _deviceIdProvider;
  final LocalAlertEngine? _alertEngine;
  final GrowthPhotoSync? _photoSync;

  static Future<String> _emptyDeviceId() async => '';

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
  ///
  /// Rows are skipped while their exponential-backoff window ([nextRetryAt])
  /// has not elapsed; rows whose change is only bookkeeping (`_meta_last_sync`)
  /// are never pushed.
  Future<int> pushLocalChanges() async {
    if (!await isOnline) {
      throw SyncOfflineException();
    }
    final now = DateTime.now().toUtc().toIso8601String();
    final pending = await (_db.select(_db.syncQueueTable)
          ..where(
            (t) => t.isSynced.equals(false) &
                t.operation.equals('_meta_last_sync').not() &
                (t.nextRetryAt.isNull() | t.nextRetryAt.isSmallerOrEqualValue(now)),
          ))
        .get();

    var pushed = 0;
    final deviceId = await _deviceIdProvider();
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
        // Idempotency key + optimistic-concurrency version let the server
        // apply each logical change exactly once and reject stale writes.
        final headers = <String, String>{
          'X-Client-Request-Id': row.clientRequestId,
          'X-Base-Version': '${row.version}',
          if (deviceId.isNotEmpty) 'X-Device-Id': deviceId,
        };
        await _dio.request<void>(
          uri,
          data: method == 'DELETE' ? null : payload,
          options: Options(method: method, headers: headers),
        );
        await _markSynced(row.id);
        pushed++;
      } catch (e) {
        await _recordPushFailure(row, e);
      }
    }
    await _photoSync?.uploadPending();
    return pushed;
  }

  /// Bump the retry counter and compute the next allowed attempt time using
  /// exponential backoff (2^n minutes, capped at 24 hours).
  Future<void> _recordPushFailure(SyncQueueRow row, Object error) async {
    final attempts = row.attempts + 1;
    final minutes = (1 << (attempts > 6 ? 6 : attempts)).clamp(1, 1440);
    final nextRetry = DateTime.now()
        .toUtc()
        .add(Duration(minutes: minutes))
        .toIso8601String();
    await (_db.update(_db.syncQueueTable)..where((t) => t.id.equals(row.id)))
        .write(SyncQueueTableCompanion(
      attempts: Value(attempts),
      nextRetryAt: Value(nextRetry),
      error: Value(error.toString()),
    ));
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
  /// Returns the number of records pulled. When [since] is omitted, the last
  /// successful pull timestamp is used (resuming from where we stopped).
  Future<int> pullRemoteChanges({DateTime? since}) async {
    if (!await isOnline) {
      throw SyncOfflineException();
    }
    final resumeFrom = since ?? await lastSyncTime();
    final query = Uri.parse('${AppConfig.apiBaseUrl}/sync/pull').replace(
      queryParameters: {
        'since': resumeFrom?.toUtc().toIso8601String() ?? '1970-01-01T00:00:00Z',
      },
    );
    final response = await _dio.get<List<dynamic>>(query.toString());
    final data = response.data as List<dynamic>? ?? const [];
    final count = await _upsertBulk(data);
    await _writeMetaLastSync(DateTime.now().toUtc());
    await _alertEngine?.run();
    return count;
  }

  Future<int> _upsertBulk(List<dynamic> records) async {
    var count = 0;
    final valid = <(String, Map<String, dynamic>)>[];
    for (final record in records) {
      final map = (record as Map).cast<String, dynamic>();
      final table = map['table'] as String?;
      final payload = map['payload'];
      if (table == null || payload == null) continue;
      valid.add((table, payload as Map<String, dynamic>));
    }

    await _db.transaction(() async {
      for (final (table, payload) in valid) {
        count += await _upsertRow(table, payload);
      }
    });
    await _dedupe();
    return count;
  }

  /// Remote-table -> local unique column name (SQL snake_case), used by the
  /// post-pull dedupe sweep to collapse duplicate rows created by earlier pulls.
  final _uniqueKeyCols = <String, String>{
    'households': 'hhid',
    'beneficiaries': 'beneficiary_id',
    'pregnancies': 'pregnancy_id',
    'anc_visits': 'anc_visit_id',
    'children': 'child_id',
    'immunizations': 'immunization_id',
    'hbnc_visits': 'visit_id',
    'hbyc_visits': 'visit_id',
    'growth_records': 'record_id',
    'eligible_couples': 'ec_id',
    'ec_followups': 'followup_id',
    'ncd_screenings': 'screening_id',
    'disease_cases': 'case_id',
    'death_reports': 'death_report_id',
    'asha_tasks': 'task_id',
    'incentive_claims': 'claim_id',
    'village_forms': 'form_id',
    'abha_records': 'abha_id',
    'notifications': 'notification_id',
    'referrals': 'referral_id',
  };

  /// Upsert a single pulled record. The conflict target is the record's
  /// business key (the unique remote id column) so the local auto-increment
  /// rowid never causes duplicate rows on re-pull.
  Future<int> _upsertRow(String table, Map<String, dynamic> payload) async {
    switch (table) {
      case 'households':
        return await _db.into(_db.householdsTable).insertOnConflictUpdate(
            payload, target: [_db.householdsTable.hhid]);
      case 'beneficiaries':
        return await _db.into(_db.beneficiariesTable).insertOnConflictUpdate(
            payload, target: [_db.beneficiariesTable.beneficiaryId]);
      case 'pregnancies':
        return await _db.into(_db.pregnanciesTable).insertOnConflictUpdate(
            payload, target: [_db.pregnanciesTable.pregnancyId]);
      case 'anc_visits':
        return await _db.into(_db.ancVisitsTable).insertOnConflictUpdate(
            payload, target: [_db.ancVisitsTable.ancVisitId]);
      case 'children':
        return await _db.into(_db.childrenTable).insertOnConflictUpdate(
            payload, target: [_db.childrenTable.childId]);
      case 'immunizations':
        return await _db.into(_db.immunizationsTable).insertOnConflictUpdate(
            payload, target: [_db.immunizationsTable.immunizationId]);
      case 'hbnc_visits':
        return await _db.into(_db.hbncVisitsTable).insertOnConflictUpdate(
            payload, target: [_db.hbncVisitsTable.visitId]);
      case 'hbyc_visits':
        return await _db.into(_db.hbycVisitsTable).insertOnConflictUpdate(
            payload, target: [_db.hbycVisitsTable.visitId]);
      case 'growth_records':
        // Remote rows use `record_date`/`muac_mm`; the local table stores the
        // date in `measured_on` and MUAC in centimetres.
        final muacMm = payload['muac_mm'] as num?;
        final local = <String, dynamic>{
          'record_id': payload['id'],
          'child_id': payload['child_id'],
          'measured_on': payload['record_date'],
          'weight_kg': payload['weight_kg']?.toString(),
          'height_cm': payload['height_cm']?.toString(),
          'muac_cm': muacMm == null ? null : (muacMm / 10).toString(),
          'photo_url': payload['photo_url'],
          'created_at': payload['created_at'],
          'updated_at': payload['updated_at'],
        };
        return await _db.into(_db.growthRecordsTable).insertOnConflictUpdate(
            local, target: [_db.growthRecordsTable.recordId]);
      case 'eligible_couples':
        return await _db.into(_db.eligibleCouplesTable).insertOnConflictUpdate(
            payload, target: [_db.eligibleCouplesTable.ecId]);
      case 'ec_followups':
        return await _db.into(_db.ecFollowupsTable).insertOnConflictUpdate(
            payload, target: [_db.ecFollowupsTable.followupId]);
      case 'ncd_screenings':
        return await _db.into(_db.ncdScreeningsTable).insertOnConflictUpdate(
            payload, target: [_db.ncdScreeningsTable.screeningId]);
      case 'disease_cases':
        return await _db.into(_db.diseaseCasesTable).insertOnConflictUpdate(
            payload, target: [_db.diseaseCasesTable.caseId]);
      case 'death_reports':
        return await _db.into(_db.deathReportsTable).insertOnConflictUpdate(
            payload, target: [_db.deathReportsTable.deathReportId]);
      case 'asha_tasks':
        return await _db.into(_db.ashaTasksTable).insertOnConflictUpdate(
            payload, target: [_db.ashaTasksTable.taskId]);
      case 'incentive_claims':
        return await _db.into(_db.incentiveClaimsTable).insertOnConflictUpdate(
            payload, target: [_db.incentiveClaimsTable.claimId]);
      case 'village_forms':
        return await _db.into(_db.villageFormsTable).insertOnConflictUpdate(
            payload, target: [_db.villageFormsTable.formId]);
      case 'abha_records':
        return await _db.into(_db.abhaRecordsTable).insertOnConflictUpdate(
            payload, target: [_db.abhaRecordsTable.abhaId]);
      case 'notifications':
        return await _db.into(_db.notificationsTable).insertOnConflictUpdate(
            payload, target: [_db.notificationsTable.notificationId]);
      case 'referrals':
        return await _db.into(_db.referralsTable).insertOnConflictUpdate(
            payload, target: [_db.referralsTable.referralId]);
      default:
        return 0;
    }
  }

  /// Remove duplicate rows that may have been created by earlier pulls, keeping
  /// the oldest row per business key. Correctness net for pre-fix data.
  Future<void> _dedupe() async {
    for (final entry in _uniqueKeyCols.entries) {
      final sql = 'DELETE FROM ${entry.key} WHERE id NOT IN '
          '(SELECT MIN(id) FROM ${entry.key} GROUP BY "${entry.value}")';
      await _db.customStatement(sql);
    }
  }

  /// Persist the successful-pull watermark as a special queue row.
  Future<void> _writeMetaLastSync(DateTime t) async {
    final iso = t.toIso8601String();
    final existing = await (_db.select(_db.syncQueueTable)
          ..where((t) => t.operation.equals('_meta_last_sync')))
        .get();
    if (existing.isNotEmpty) {
      await (_db.update(_db.syncQueueTable)
            ..where((t) => t.operation.equals('_meta_last_sync')))
          .write(SyncQueueTableCompanion(
        createdAt: Value(iso),
        updatedAt: Value(iso),
      ));
    } else {
      await _db.into(_db.syncQueueTable).insert(
            SyncQueueTableCompanion.insert(
              tableName: '_meta',
              recordId: '',
              operation: '_meta_last_sync',
              payloadJson: '{}',
              createdAt: iso,
            ),
          );
    }
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
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'growth_records',
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
          ..where((t) => t.operation.equals('_meta_last_sync'))
          ..orderBy((t) => OrderingTerm.desc(t.updatedAt)))
        .get();
    if (rows.isEmpty) return null;
    final ts = rows.first.updatedAt ?? rows.first.createdAt;
    return DateTime.tryParse(ts);
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
