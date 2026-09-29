import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'child_models.dart';

/// Build the snake_case payload pushed to the backend `/sync/growth_records`
/// endpoint. Keys match the server `GrowthRecord` columns (`record_date`,
/// `weight_kg`, `height_cm`, `muac_mm`, `photo_url`) so `apply_operation` can
/// apply the change idempotently.
Map<String, dynamic> growthRecordSyncPayload(GrowthRecordModel model) => {
      'child_id': model.childId,
      'record_date': model.measuredOn,
      'weight_kg': model.weightKg,
      'height_cm': model.heightCm,
      'muac_mm': model.muacCm != null ? model.muacCm! * 10 : null,
      'photo_url': model.photoUrl,
      'created_at': model.createdAt,
      'updated_at': model.updatedAt,
    };

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

  Future<void> upsertGrowthRecord(GrowthRecordModel model,
      {bool queueSync = true}) async {
    await _db.into(_db.growthRecordsTable).insertOnConflictUpdate(
          GrowthRecordsTableCompanion.insert(
            recordId: Value(model.recordId),
            childId: Value(model.childId),
            measuredOn: Value(model.measuredOn),
            ageMonths: Value(model.ageMonths),
            weightKg: Value(model.weightKg?.toString()),
            heightCm: Value(model.heightCm?.toString()),
            muacCm: Value(model.muacCm?.toString()),
            photoUrl: Value(model.photoUrl),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'growth_records',
        recordId: model.recordId,
        operation: 'update',
        payload: growthRecordSyncPayload(model),
      );
    }
  }

  Future<List<GrowthRecord>> growthRecordsFor(String childId) {
    return (_db.select(_db.growthRecordsTable)
          ..where((t) => t.childId.equals(childId))
          ..orderBy([
            (t) => OrderingTerm.asc(t.measuredOn),
          ]))
        .get();
  }

  GrowthRecordModel growthRecordFromRow(GrowthRecord row) => GrowthRecordModel(
        recordId: row.recordId,
        childId: row.childId,
        measuredOn: row.measuredOn,
        ageMonths: row.ageMonths,
        weightKg: double.tryParse(row.weightKg ?? ''),
        heightCm: double.tryParse(row.heightCm ?? ''),
        muacCm: double.tryParse(row.muacCm ?? ''),
        photoUrl: row.photoUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );

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
