import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'death_report_model.dart';

/// Local drift CRUD for death reports.
class DeathReportLocalRepository {
  DeathReportLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<DeathReport>> watchAll() => _db.select(_db.deathReportsTable).get();

  Future<DeathReport?> byId(String id) {
    return (_db.select(_db.deathReportsTable)
          ..where((t) => t.deathReportId.equals(id)))
        .getSingleOrNull();
  }

  Future<void> upsert(DeathReportModel model, {bool queueSync = true}) async {
    await _db.into(_db.deathReportsTable).insertOnConflictUpdate(
          DeathReportsTableCompanion.insert(
            deathReportId: Value(model.deathReportId),
            deceasedName: Value(model.deceasedName),
            deceasedGender: Value(model.deceasedGender),
            deceasedAge: Value(model.deceasedAge),
            deathDate: Value(model.deathDate),
            deathPlace: Value(model.deathPlace),
            causeCategory: Value(model.causeCategory),
            causeDescription: Value(model.causeDescription),
            isMaternalDeath: Value(model.isMaternalDeath),
            isChildDeath: Value(model.isChildDeath),
            verbalAutopsyNotes: Value(model.verbalAutopsyNotes),
            status: Value(model.status),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'death_reports',
        recordId: model.deathReportId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  DeathReportModel fromRow(DeathReport row) => DeathReportModel(
        deathReportId: row.deathReportId,
        deceasedName: row.deceasedName,
        deceasedGender: row.deceasedGender,
        deceasedAge: row.deceasedAge,
        deathDate: row.deathDate,
        deathPlace: row.deathPlace,
        causeCategory: row.causeCategory,
        causeDescription: row.causeDescription,
        isMaternalDeath: row.isMaternalDeath,
        isChildDeath: row.isChildDeath,
        verbalAutopsyNotes: row.verbalAutopsyNotes,
        status: row.status ?? 'reported',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
