import 'dart:convert';

import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'incentive_models.dart';

/// Local drift CRUD for incentive claims + village forms.
class IncentiveLocalRepository {
  IncentiveLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<IncentiveClaim>> claimsForMonth(String month) {
    return (_db.select(_db.incentiveClaimsTable)
          ..where((t) => t.month.equals(month)))
        .get();
  }

  Future<List<IncentiveClaim>> watchClaims() =>
      _db.select(_db.incentiveClaimsTable).get();

  Future<void> upsertClaim(IncentiveClaimModel model, {bool queueSync = true}) async {
    await _db.into(_db.incentiveClaimsTable).insertOnConflictUpdate(
          IncentiveClaimsTableCompanion.insert(
            claimId: Value(model.claimId),
            month: Value(model.month),
            activityCode: Value(model.activityCode),
            activityName: Value(model.activityName),
            quantity: Value(model.quantity),
            amount: Value(model.amount?.toString()),
            status: Value(model.status),
            generatedFrom: Value(model.generatedFrom),
            beneficiaryId: Value(model.beneficiaryId),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'incentive_claims',
        recordId: model.claimId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<List<VillageForm>> watchForms() => _db.select(_db.villageFormsTable).get();

  Future<void> upsertForm(VillageFormModel model, {bool queueSync = true}) async {
    await _db.into(_db.villageFormsTable).insertOnConflictUpdate(
          VillageFormsTableCompanion.insert(
            formId: Value(model.formId),
            formType: Value(model.formType),
            formDate: Value(model.formDate),
            villageId: Value(model.villageId),
            place: Value(model.place),
            attendedBy: Value(model.attendedBy),
            dataJson: Value(jsonEncode(model.data)),
            status: Value(model.status),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'village_forms',
        recordId: model.formId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  IncentiveClaimModel claimFromRow(IncentiveClaim row) => IncentiveClaimModel(
        claimId: row.claimId,
        month: row.month,
        activityCode: row.activityCode,
        activityName: row.activityName,
        quantity: row.quantity,
        amount: double.tryParse(row.amount ?? ''),
        status: row.status ?? 'draft',
        generatedFrom: row.generatedFrom,
        beneficiaryId: row.beneficiaryId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );

  VillageFormModel formFromRow(VillageForm row) => VillageFormModel(
        formId: row.formId,
        formType: row.formType,
        formDate: row.formDate,
        villageId: row.villageId,
        place: row.place,
        attendedBy: row.attendedBy,
        data: row.dataJson == null
            ? const {}
            : (jsonDecode(row.dataJson!) as Map).cast<String, dynamic>(),
        status: row.status ?? 'draft',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
