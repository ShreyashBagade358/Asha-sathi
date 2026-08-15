import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'beneficiary_model.dart';

/// Local drift CRUD for beneficiaries.
class BeneficiaryLocalRepository {
  BeneficiaryLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<Beneficiary>> watchAll() => _db.select(_db.beneficiariesTable).get();

  Stream<List<Beneficiary>> watchAllStream() =>
      (_db.select(_db.beneficiariesTable)).watch();

  Future<Beneficiary?> byId(String beneficiaryId) {
    return (_db.select(_db.beneficiariesTable)
          ..where((t) => t.beneficiaryId.equals(beneficiaryId)))
        .getSingleOrNull();
  }

  Future<List<Beneficiary>> byHousehold(String householdId) {
    return (_db.select(_db.beneficiariesTable)
          ..where((t) => t.householdId.equals(householdId)))
        .get();
  }

  Future<void> upsert(BeneficiaryModel model, {bool queueSync = true}) async {
    await _db.into(_db.beneficiariesTable).insertOnConflictUpdate(
          BeneficiariesTableCompanion.insert(
            beneficiaryId: Value(model.beneficiaryId),
            householdId: Value(model.householdId),
            abhaId: Value(model.abhaId),
            fullName: Value(model.fullName),
            gender: Value(model.gender),
            dob: Value(model.dob),
            phone: Value(model.phone),
            maritalStatus: Value(model.maritalStatus),
            bloodGroup: Value(model.bloodGroup),
            isPregnant: Value(model.isPregnant),
            villageId: Value(model.villageId),
            photoPath: Value(model.photoPath),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'beneficiaries',
        recordId: model.beneficiaryId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<void> markPregnant(String beneficiaryId, bool pregnant) async {
    await (_db.update(_db.beneficiariesTable)
          ..where((t) => t.beneficiaryId.equals(beneficiaryId)))
        .write(BeneficiariesTableCompanion(isPregnant: Value(pregnant)));
  }

  Future<void> delete(String beneficiaryId) async {
    await (_db.delete(_db.beneficiariesTable)
          ..where((t) => t.beneficiaryId.equals(beneficiaryId)))
        .go();
    await SyncQueue.enqueue(
      db: _db,
      table: 'beneficiaries',
      recordId: beneficiaryId,
      operation: 'delete',
      payload: {'beneficiary_id': beneficiaryId},
    );
  }

  BeneficiaryModel fromRow(Beneficiary row) => BeneficiaryModel(
        beneficiaryId: row.beneficiaryId,
        householdId: row.householdId,
        abhaId: row.abhaId,
        fullName: row.fullName,
        gender: row.gender,
        dob: row.dob,
        phone: row.phone,
        maritalStatus: row.maritalStatus,
        bloodGroup: row.bloodGroup,
        isPregnant: row.isPregnant,
        villageId: row.villageId,
        photoPath: row.photoPath,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
