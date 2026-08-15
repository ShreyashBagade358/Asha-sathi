import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'abha_record_model.dart';

/// Local drift CRUD for ABHA records.
class ABHALocalRepository {
  ABHALocalRepository(this._db);

  final AppDatabase _db;

  Future<List<ABHARecord>> watchAll() => _db.select(_db.abhaRecordsTable).get();

  Future<void> upsert(ABHARecordModel model, {bool queueSync = true}) async {
    await _db.into(_db.abhaRecordsTable).insertOnConflictUpdate(
          ABHARecordsTableCompanion.insert(
            abhaId: Value(model.abhaId),
            beneficiaryId: Value(model.beneficiaryId),
            abhaNumber: Value(model.abhaNumber),
            healthId: Value(model.healthId),
            status: Value(model.status),
            linkingMethod: Value(model.linkingMethod),
            consentGranted: Value(model.consentGranted),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'abha_records',
        recordId: model.abhaId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  ABHARecordModel fromRow(ABHARecord row) => ABHARecordModel(
        abhaId: row.abhaId,
        beneficiaryId: row.beneficiaryId,
        abhaNumber: row.abhaNumber,
        healthId: row.healthId,
        status: row.status ?? 'unlinked',
        linkingMethod: row.linkingMethod ?? 'none',
        consentGranted: row.consentGranted,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
