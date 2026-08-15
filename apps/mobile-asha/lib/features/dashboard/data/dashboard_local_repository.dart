import 'package:drift/drift.dart';

import '../../../core/offline/database.dart';
import 'dashboard_models.dart';

/// Local drift CRUD for ASHA tasks.
class DashboardLocalRepository {
  DashboardLocalRepository(this._db);

  final AppDatabase _db;

  Future<List<ASHATask>> tasksToday() {
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day).toIso8601String();
    return (_db.select(_db.ashaTasksTable)
          ..where((t) => t.dueDate.isBiggerOrEqualValue(start)))
        .get();
  }

  Future<List<ASHATask>> incompleteTasks() {
    return (_db.select(_db.ashaTasksTable)
          ..where((t) => t.isCompleted.equals(false)))
        .get();
  }

  Future<void> upsert(ASHATaskModel model, {bool queueSync = true}) async {
    await _db.into(_db.ashaTasksTable).insertOnConflictUpdate(
          ASHATasksTableCompanion.insert(
            taskId: Value(model.taskId),
            taskType: Value(model.taskType),
            title: Value(model.title),
            description: Value(model.description),
            dueDate: Value(model.dueDate),
            priority: Value(model.priority),
            isCompleted: Value(model.isCompleted),
            completedAt: Value(model.completedAt),
            completedLatitude: Value(model.completedLatitude?.toString()),
            completedLongitude: Value(model.completedLongitude?.toString()),
            beneficiaryId: Value(model.beneficiaryId),
            createdAt: Value(model.createdAt),
            updatedAt: Value(model.updatedAt),
          ),
        );
    if (queueSync) {
      await SyncQueue.enqueue(
        db: _db,
        table: 'asha_tasks',
        recordId: model.taskId,
        operation: 'update',
        payload: model.toJson(),
      );
    }
  }

  Future<void> markCompleted(ASHATaskModel model) => upsert(model);

  ASHATaskModel fromRow(ASHATask row) => ASHATaskModel(
        taskId: row.taskId,
        taskType: row.taskType,
        title: row.title,
        description: row.description,
        dueDate: row.dueDate,
        priority: row.priority ?? 'medium',
        isCompleted: row.isCompleted,
        completedAt: row.completedAt,
        completedLatitude: double.tryParse(row.completedLatitude ?? ''),
        completedLongitude: double.tryParse(row.completedLongitude ?? ''),
        beneficiaryId: row.beneficiaryId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      );
}
