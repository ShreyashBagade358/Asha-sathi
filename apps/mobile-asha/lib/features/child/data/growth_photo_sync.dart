import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import '../../../core/offline/sync_queue.dart';

/// Offline-first upload pipeline for baby-growth progress photos.
///
/// A captured photo is copied into the app documents directory and queued in
/// the [SyncQueueTable] under the `growth_photo_upload` logical table. When the
/// device is online, [uploadPending] posts each queued photo to the backend
/// photo endpoint and persists the returned `photo_url` on the local growth
/// record, so the photo survives offline capture and connection loss.
class GrowthPhotoSync {
  GrowthPhotoSync({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _db = database;

  final Dio _dio;
  final AppDatabase _db;

  /// Logical table name used inside [SyncQueueTable] for queued photo uploads.
  static const queueTable = 'growth_photo_upload';

  /// Copy [sourcePath] into the app documents directory under `growth_photos/`
  /// and return the stable local path used while the upload is queued.
  Future<String> storePhoto(String recordId, String sourcePath) async {
    final docs = await getApplicationDocumentsDirectory();
    final photoDir = Directory('${docs.path}/growth_photos');
    if (!await photoDir.exists()) {
      await photoDir.create(recursive: true);
    }
    final ext = sourcePath.contains('.') ? sourcePath.split('.').last : 'jpg';
    final dest = '${photoDir.path}/$recordId.$ext';
    final source = File(sourcePath);
    if (!await source.exists()) {
      throw const FileSystemException('Photo file no longer exists');
    }
    if (source.path != dest) {
      await source.copy(dest);
    }
    return dest;
  }

  /// Queue a captured photo for upload. Safe to call while offline.
  Future<void> enqueue({
    required String childId,
    required String recordId,
    required String localPath,
  }) async {
    final stored = await storePhoto(recordId, localPath);
    await SyncQueue.enqueue(
      db: _db,
      table: queueTable,
      recordId: recordId,
      operation: 'update',
      payload: {
        'child_id': childId,
        'record_id': recordId,
        'local_path': stored,
      },
    );
  }

  /// Upload every queued photo to the backend. Returns how many succeeded.
  Future<int> uploadPending() async {
    final pending = await (_db.select(_db.syncQueueTable)
          ..where(
            (t) => t.tableName.equals(queueTable) & t.isSynced.equals(false),
          ))
        .get();
    var uploaded = 0;
    for (final row in pending) {
      try {
        final payload = jsonDecode(row.payloadJson) as Map<String, dynamic>;
        final childId = payload['child_id'] as String;
        final recordId = payload['record_id'] as String;
        final path = payload['local_path'] as String;
        final file = File(path);
        if (!await file.exists()) {
          await _fail(row.id, 'local_file_missing:$path');
          continue;
        }
        final form = FormData.fromMap({
          'file': await MultipartFile.fromFile(path),
          'mime_type': 'image/jpeg',
        });
        final res = await _dio.post<Map<String, dynamic>>(
          '${AppConfig.apiBaseUrl}/children/$childId/growth/$recordId/photo',
          data: form,
        );
        final photoUrl = res.data?['photo_url'] as String?;
        if (photoUrl != null) {
          await (_db.update(_db.growthRecordsTable)
                ..where((t) => t.recordId.equals(recordId)))
              .write(
                GrowthRecordsTableCompanion(photoUrl: Value(photoUrl)),
              );
        }
        await (_db.update(_db.syncQueueTable)..where((t) => t.id.equals(row.id)))
            .write(
              SyncQueueTableCompanion(
                isSynced: const Value(true),
                pendingOperation: const Value('synced'),
                updatedAt: Value(DateTime.now().toIso8601String()),
              ),
            );
        uploaded++;
      } catch (e) {
        await _fail(row.id, e.toString());
      }
    }
    return uploaded;
  }

  Future<void> _fail(int rowId, String error) async {
    await (_db.update(_db.syncQueueTable)..where((t) => t.id.equals(rowId)))
        .write(SyncQueueTableCompanion(error: Value(error)));
  }

  /// recordIds of photos still waiting to upload for [childId].
  Future<Set<String>> pendingRecordIds(String childId) async {
    final rows = await (_db.select(_db.syncQueueTable)
          ..where(
            (t) => t.tableName.equals(queueTable) & t.isSynced.equals(false),
          ))
        .get();
    final ids = <String>{};
    for (final r in rows) {
      final payload = jsonDecode(r.payloadJson) as Map<String, dynamic>;
      if (payload['child_id'] == childId && payload['record_id'] is String) {
        ids.add(payload['record_id'] as String);
      }
    }
    return ids;
  }
}