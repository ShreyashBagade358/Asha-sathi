import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'disease_models.dart';

/// Local drift CRUD for disease cases.
class DiseaseLocalRepository {
  DiseaseLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<DiseaseCase>> watchAll() => _db.select(_db.diseaseCasesTable).get();

  Future<List<DiseaseCase>> byType(String type) {
    return (_db.select(_db.diseaseCasesTable)
          ..where((t) => t.diseaseType.equals(type)))
        .get();
  }

  Future<DiseaseCase?> byId(String id) {
    return (_db.select(_db.diseaseCasesTable)..where((t) => t.caseId.equals(id)))
        .getSingleOrNull();
  }

  Future<void> upsert(DiseaseCaseModel model, {bool queueSync = true}) async {
    await _db.into(_db.diseaseCasesTable).insertOnConflictUpdate(
          DiseaseCasesTableCompanion.insert(
            caseId: Value(model.caseId),
            beneficiaryId: Value(model.beneficiaryId),
            patientName: Value(model.patientName),
            diseaseType: Value(model.diseaseType),
            diagnosisDate: Value(model.diagnosisDate),
            symptoms: Value(model.symptoms.join('|')),
            treatment: Value(model.treatment),
            dotsProvider: Value(null),
            houseNumber: Value(null),
            locality: Value(model.locality),
            pincode: Value(model.pincode),
            status: Value(model.status),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'disease_cases',
        recordId: model.caseId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  DiseaseCaseModel fromRow(DiseaseCase row) => DiseaseCaseModel(
        caseId: row.caseId,
        beneficiaryId: row.beneficiaryId,
        patientName: row.patientName,
        diseaseType: row.diseaseType,
        diagnosisDate: row.diagnosisDate,
        symptoms: (row.symptoms ?? '').isEmpty
            ? const []
            : row.symptoms!.split('|'),
        treatment: row.treatment,
        status: row.status ?? 'under-treatment',
        locality: row.locality,
        pincode: row.pincode,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
