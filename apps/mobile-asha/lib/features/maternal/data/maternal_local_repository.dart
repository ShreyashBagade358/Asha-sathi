import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'maternal_models.dart';

/// Local drift CRUD for pregnancies and ANC records.
class MaternalLocalRepository {
  MaternalLocalRepository(this._db);

  final AppDatabase _db;

  // --- Pregnancies ---
  Future<List<Pregnancy>> watchPregnancies() =>
      _db.select(_db.pregnanciesTable).get();

  Stream<List<Pregnancy>> watchPregnanciesStream() =>
      _db.select(_db.pregnanciesTable).watch();

  Future<Pregnancy?> pregnancyById(String id) {
    return (_db.select(_db.pregnanciesTable)
          ..where((t) => t.pregnancyId.equals(id)))
        .getSingleOrNull();
  }

  Future<void> upsertPregnancy(PregnancyModel model, {bool queueSync = true}) async {
    await _db.into(_db.pregnanciesTable).insertOnConflictUpdate(
          PregnanciesTableCompanion.insert(
            pregnancyId: Value(model.pregnancyId),
            beneficiaryId: Value(model.beneficiaryId),
            lmp: Value(model.lmp),
            edd: Value(model.edd),
            gravida: Value(model.gravida),
            para: Value(model.para),
            bloodGroup: Value(model.bloodGroup),
            status: Value(model.status),
            highRisk: Value(model.highRisk),
            highRiskReasons: Value(model.highRiskReasons.join('|')),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'pregnancies',
        recordId: model.pregnancyId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  // --- ANC visits ---
  Future<List<ANCVisit>> ancVisitsFor(String pregnancyId) {
    return (_db.select(_db.ancVisitsTable)
          ..where((t) => t.pregnancyId.equals(pregnancyId))
          ..orderBy([(t) => OrderingTerm.desc(t.visitDate)]))
        .get();
  }

  Future<void> upsertANCVisit(ANCVisitModel model, {bool queueSync = true}) async {
    await _db.into(_db.ancVisitsTable).insertOnConflictUpdate(
          ANCVisitsTableCompanion.insert(
            ancVisitId: Value(model.ancVisitId),
            pregnancyId: Value(model.pregnancyId),
            beneficiaryId: Value(model.beneficiaryId),
            visitDate: Value(model.visitDate),
            gestationalAgeWeeks: Value(model.gestationalAgeWeeks),
            weightKg: Value(model.weightKg?.toString()),
            bpSystolic: Value(model.bpSystolic),
            bpDiastolic: Value(model.bpDiastolic),
            hemoglobin: Value(model.hemoglobin?.toString()),
            fundalHeight: Value(model.fundalHeight?.toString()),
            fetalHeartRate: Value(model.fetalHeartRate),
            dangerSigns: Value(model.dangerSigns.join('|')),
            labResults: Value(model.labResults.join('|')),
            referrals: Value(model.referral),
            observations: Value(model.observations),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'anc_visits',
        recordId: model.ancVisitId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  PregnancyModel pregnancyFromRow(Pregnancy row) => PregnancyModel(
        pregnancyId: row.pregnancyId,
        beneficiaryId: row.beneficiaryId,
        lmp: row.lmp,
        edd: row.edd,
        gravida: row.gravida,
        para: row.para,
        bloodGroup: row.bloodGroup,
        status: row.status ?? 'active',
        highRisk: row.highRisk,
        highRiskReasons: (row.highRiskReasons ?? '').isEmpty
            ? const []
            : row.highRiskReasons!.split('|'),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );

  ANCVisitModel ancFromRow(ANCVisit row) => ANCVisitModel(
        ancVisitId: row.ancVisitId,
        pregnancyId: row.pregnancyId,
        beneficiaryId: row.beneficiaryId,
        visitDate: row.visitDate,
        gestationalAgeWeeks: row.gestationalAgeWeeks,
        weightKg: double.tryParse(row.weightKg ?? ''),
        bpSystolic: row.bpSystolic,
        bpDiastolic: row.bpDiastolic,
        hemoglobin: double.tryParse(row.hemoglobin ?? ''),
        fundalHeight: double.tryParse(row.fundalHeight ?? ''),
        fetalHeartRate: row.fetalHeartRate,
        dangerSigns: (row.dangerSigns ?? '').isEmpty
            ? const []
            : row.dangerSigns!.split('|'),
        labResults: (row.labResults ?? '').isEmpty
            ? const []
            : row.labResults!.split('|'),
        referral: row.referrals,
        observations: row.observations,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
