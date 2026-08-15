import 'dart:convert';

import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';

/// Local drift CRUD for households + queued sync writes.
class HouseholdLocalRepository {
  HouseholdLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<Household>> watchAll() => _db.select(_db.householdsTable).get();

  Future<Household?> byId(String hhid) {
    return (_db.select(_db.householdsTable)
          ..where((t) => t.hhid.equals(hhid)))
        .getSingleOrNull();
  }

  /// Upsert a household locally. When [queueSync] is true the change is also
  /// enqueued for later upload.
  Future<void> upsert(HouseholdModel model, {bool queueSync = true}) async {
    await _db.into(_db.householdsTable).insertOnConflictUpdate(
          HouseholdsTableCompanion.insert(
            hhid: Value(model.hhid),
            villageId: Value(model.villageId),
            address: Value(model.address),
            landmark: Value(model.landmark),
            amenities: Value(jsonEncode(model.amenities)),
            consentGiven: Value(model.consentGiven),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'households',
        recordId: model.hhid,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<void> delete(String hhid) async {
    await (_db.delete(_db.householdsTable)..where((t) => t.hhid.equals(hhid)))
        .go();
    await SyncQueue.enqueue(
      db: _db,
      table: 'households',
      recordId: hhid,
      operation: 'delete',
      payload: {'hhid': hhid},
    );
  }

  /// Convert a drift row into the freezed model.
  HouseholdModel fromRow(Household row) => HouseholdModel(
        hhid: row.hhid,
        villageId: row.villageId,
        address: row.address,
        landmark: row.landmark,
        amenities: row.amenities == null
            ? const []
            : (jsonDecode(row.amenities!) as List)
                .map((e) => e.toString())
                .toList(),
        consentGiven: row.consentGiven,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
