import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'ncd_screening_model.dart';

/// Local drift CRUD for NCD screenings.
class NCDLocalRepository {
  NCDLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<NCDScreening>> watchAll() => _db.select(_db.ncdScreeningsTable).get();

  Future<List<NCDScreening>> dueScreenings() {
    final cutoff = DateTime.now().subtract(const Duration(days: 365)).toIso8601String();
    return (_db.select(_db.ncdScreeningsTable)
          ..where((t) => t.screeningDate.isSmallerThanValue(cutoff)))
        .get();
  }

  Future<void> upsert(NCDScreeningModel model, {bool queueSync = true}) async {
    await _db.into(_db.ncdScreeningsTable).insertOnConflictUpdate(
          NCDScreeningsTableCompanion.insert(
            screeningId: Value(model.screeningId),
            beneficiaryId: Value(model.beneficiaryId),
            screeningDate: Value(model.screeningDate),
            age: Value(model.age),
            bpSystolic: Value(model.bpSystolic),
            bpDiastolic: Value(model.bpDiastolic),
            bmi: Value(model.bmi?.toString()),
            bloodSugar: Value(model.bloodSugar?.toString()),
            waistCircumference: Value(model.waistCircumference?.toString()),
            riskScore: Value(model.riskScore),
            riskLevel: Value(model.riskLevel),
            questionsJson: Value(model.questions.join('|')),
            referralStatus: Value(model.referralStatus),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'ncd_screenings',
        recordId: model.screeningId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  NCDScreeningModel fromRow(NCDScreening row) => NCDScreeningModel(
        screeningId: row.screeningId,
        beneficiaryId: row.beneficiaryId,
        screeningDate: row.screeningDate,
        age: row.age,
        bpSystolic: row.bpSystolic,
        bpDiastolic: row.bpDiastolic,
        bmi: double.tryParse(row.bmi ?? ''),
        bloodSugar: double.tryParse(row.bloodSugar ?? ''),
        waistCircumference: double.tryParse(row.waistCircumference ?? ''),
        riskScore: row.riskScore ?? 0,
        riskLevel: row.riskLevel ?? 'low',
        questions: (row.questionsJson ?? '').isEmpty
            ? const []
            : row.questionsJson!.split('|'),
        referralStatus: row.referralStatus,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
