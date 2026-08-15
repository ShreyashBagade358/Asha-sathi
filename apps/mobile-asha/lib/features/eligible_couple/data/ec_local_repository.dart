import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'ec_models.dart';

/// Local drift CRUD for eligible couples + follow-ups.
class EligibleCoupleLocalRepository {
  EligibleCoupleLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<EligibleCouple>> watchAll() => _db.select(_db.eligibleCouplesTable).get();

  Future<EligibleCouple?> byId(String ecId) {
    return (_db.select(_db.eligibleCouplesTable)
          ..where((t) => t.ecId.equals(ecId)))
        .getSingleOrNull();
  }

  Future<void> upsert(EligibleCoupleModel model, {bool queueSync = true}) async {
    await _db.into(_db.eligibleCouplesTable).insertOnConflictUpdate(
          EligibleCouplesTableCompanion.insert(
            ecId: Value(model.ecId),
            husbandName: Value(model.husbandName),
            wifeName: Value(model.wifeName),
            wifeBeneficiaryId: Value(model.wifeBeneficiaryId),
            address: Value(model.address),
            age: Value(model.age),
            childrenCount: Value(model.childrenCount),
            contraceptiveMethod: Value(model.contraceptiveMethod),
            needsFamilyPlanning: Value(model.needsFamilyPlanning),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'eligible_couples',
        recordId: model.ecId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<void> upsertFollowup(ECFollowupModel model, {bool queueSync = true}) async {
    await _db.into(_db.ecFollowupsTable).insertOnConflictUpdate(
          ECFollowupsTableCompanion.insert(
            followupId: Value(model.followupId),
            ecId: Value(model.ecId),
            followupDate: Value(model.followupDate),
            methodUsed: Value(model.methodUsed),
            sideEffects: Value(model.sideEffects.join('|')),
            counselingDone: Value(model.counselingDone),
            missedPeriod: Value(model.missedPeriod),
            notes: Value(model.notes),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'ec_followups',
        recordId: model.followupId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<List<ECFollowup>> followupsFor(String ecId) {
    return (_db.select(_db.ecFollowupsTable)
          ..where((t) => t.ecId.equals(ecId)))
        .get();
  }

  EligibleCoupleModel fromRow(EligibleCouple row) => EligibleCoupleModel(
        ecId: row.ecId,
        husbandName: row.husbandName,
        wifeName: row.wifeName,
        wifeBeneficiaryId: row.wifeBeneficiaryId,
        address: row.address,
        age: row.age,
        childrenCount: row.childrenCount,
        contraceptiveMethod: row.contraceptiveMethod,
        needsFamilyPlanning: row.needsFamilyPlanning,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );

  ECFollowupModel followupFromRow(ECFollowup row) => ECFollowupModel(
        followupId: row.followupId,
        ecId: row.ecId,
        followupDate: row.followupDate,
        methodUsed: row.methodUsed,
        sideEffects: (row.sideEffects ?? '').isEmpty
            ? const []
            : row.sideEffects!.split('|'),
        counselingDone: row.counselingDone,
        missedPeriod: row.missedPeriod,
        notes: row.notes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
