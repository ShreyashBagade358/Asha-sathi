import 'dart:convert';

import 'package:drift/drift.dart';

import 'database.dart';

/// Helper for enqueueing local mutations to the [SyncQueueTable] so the
/// [SyncEngine] can push them to the backend later.
class SyncQueue {
  SyncQueue._();

  /// Queue an operation against the local mirror of a remote table.
  ///
  /// [table] is the remote table name, e.g. `households`. [recordId] is the
  /// domain primary key. [operation] is `insert`, `update` or `delete`.
  /// [payload] is the JSON body to push to the backend.
  static Future<void> enqueue({
    required AppDatabase db,
    required String table,
    required String recordId,
    required String operation,
    required Map<String, dynamic> payload,
  }) async {
    final now = DateTime.now().toIso8601String();
    await db.into(db.syncQueueTable).insert(
          SyncQueueTableCompanion.insert(
            tableName: table,
            recordId: recordId,
            operation: operation,
            payloadJson: jsonEncode(payload),
            createdAt: now,
          ),
        );
  }

  /// Remove a synced row from the queue.
  static Future<void> dequeue(AppDatabase db, int queueRowId) async {
    await (db.delete(db.syncQueueTable)..where((t) => t.id.equals(queueRowId)))
        .go();
  }
}
