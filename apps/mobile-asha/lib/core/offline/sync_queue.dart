import 'dart:convert';
import 'dart:math';

import 'package:drift/drift.dart';

import 'database.dart';

/// Helper for enqueueing local mutations to the [SyncQueueTable] so the
/// [SyncEngine] can push them to the backend later.
class SyncQueue {
  SyncQueue._();

  /// Queue an operation against the local mirror of a remote table.
  ///
  /// [table] is the remote table name, e.g. `households`. [recordId] is the
  /// remote primary key (uuid). [operation] is `insert`, `update` or `delete`.
  /// [payload] is the JSON body to push to the backend.
  ///
  /// [clientRequestId] is the idempotency key the server uses to avoid applying
  /// the same logical change twice across retries/app restarts. It is generated
  /// once per logical change and reused if that change is re-pushed.
  static Future<void> enqueue({
    required AppDatabase db,
    required String table,
    required String recordId,
    required String operation,
    required Map<String, dynamic> payload,
    int version = 1,
    String? clientRequestId,
  }) async {
    final now = DateTime.now().toIso8601String();
    await db.into(db.syncQueueTable).insert(
          SyncQueueTableCompanion.insert(
            tableName: table,
            recordId: recordId,
            operation: operation,
            payloadJson: jsonEncode(payload),
            createdAt: now,
            clientRequestId: clientRequestId ?? _newId(),
            version: version,
          ),
        );
  }

  static String _newId() {
    final rand = Random();
    return '${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}'
        '-${rand.nextInt(0x7fffffff).toRadixString(16)}'
        '-${rand.nextInt(0x7fffffff).toRadixString(16)}';
  }

  /// Remove a synced row from the queue.
  static Future<void> dequeue(AppDatabase db, int queueRowId) async {
    await (db.delete(db.syncQueueTable)..where((t) => t.id.equals(queueRowId)))
        .go();
  }
}