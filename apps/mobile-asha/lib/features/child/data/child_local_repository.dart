import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'child_models.dart';

/// Local drift CRUD for children + immunization + growth records.
class ChildLocalRepository {
  ChildLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<Child>> watchChildren() => _db.select(_db.childrenTable).get();

  Future<Child?> childById(String id) {
    return (_db.select(_db.childrenTable)..where((t) => t.childId.equals(id)))
        .getSingleOrNull();
  }

  Future<void> upsertChild(ChildModel model, {bool queueSync = true}) async {
    await _db.into(_db.childrenTable).insertOnConflictUpdate(
          ChildrenTableCompanion.insert(
            childId: Value(model.childId),
            beneficiaryId: Value(model.beneficiaryId),
            householdId: Value(model.householdId),
            fullName: Value(model.fullName),
            gender: Value(model.gender),
            dob: Value(model.dob),
            birthWeight: Value(model.birthWeight?.toString()),
            birthOrder: Value(model.birthOrder),
            motherBeneficiaryId: Value(model.motherBeneficiaryId),
            breastfeedingStarted: Value(model.breastfeedingStarted),
            immunizationStatus: Value(model.immunizationStatus),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'children',
        recordId: model.childId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<void> upsertImmunization(ImmunizationModel model,
      {bool queueSync = true}) async {
    await _db.into(_db.immunizationsTable).insertOnConflictUpdate(
          ImmunizationsTableCompanion.insert(
            immunizationId: Value(model.immunizationId),
            childId: Value(model.childId),
            vaccineName: Value(model.vaccineName),
            dueDate: Value(model.dueDate),
            givenDate: Value(model.givenDate),
            givenAt: Value(model.givenAt),
            batchNumber: Value(model.batchNumber),
            status: Value(model.status),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'immunizations',
        recordId: model.immunizationId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<List<Immunization>> immunizationsFor(String childId) {
    return (_db.select(_db.immunizationsTable)
          ..where((t) => t.childId.equals(childId)))
        .get();
  }

  ChildModel childFromRow(Child row) => ChildModel(
        childId: row.childId,
        beneficiaryId: row.beneficiaryId,
        householdId: row.householdId,
        fullName: row.fullName,
        gender: row.gender,
        dob: row.dob,
        birthWeight: double.tryParse(row.birthWeight ?? ''),
        birthOrder: row.birthOrder,
        motherBeneficiaryId: row.motherBeneficiaryId,
        breastfeedingStarted: row.breastfeedingStarted,
        immunizationStatus: row.immunizationStatus ?? 'pending',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );

  ImmunizationModel immunizationFromRow(Immunization row) => ImmunizationModel(
        immunizationId: row.immunizationId,
        childId: row.childId,
        vaccineName: row.vaccineName,
        dueDate: row.dueDate,
        givenDate: row.givenDate,
        givenAt: row.givenAt,
        batchNumber: row.batchNumber,
        status: row.status ?? 'due',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
