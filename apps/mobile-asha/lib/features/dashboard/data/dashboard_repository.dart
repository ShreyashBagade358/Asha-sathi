import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'dashboard_local_repository.dart';
import 'dashboard_models.dart';

/// Remote + offline-first repository for dashboard KPIs and tasks.
class DashboardRepository {
  DashboardRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = DashboardLocalRepository(database);

  final Dio _dio;
  final DashboardLocalRepository _local;

  Future<ASHAKpiModel> fetchKpis() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('${AppConfig.apiBaseUrl}/kpis');
      return ASHAKpiModel.fromJson(res.data ?? {});
    } on DioException {
      final tasks = await _local.incompleteTasks();
      return ASHAKpiModel(dueTasks: tasks.length);
    }
  }

  Future<List<ASHATaskModel>> fetchTasks() async {
    try {
      final res = await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/tasks');
      final models = (res.data ?? const [])
          .map((e) => ASHATaskModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.tasksToday()).map(_local.fromRow).toList();
    }
  }

  Future<ASHATaskModel> saveTask(ASHATaskModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/tasks',
        data: model.toJson(),
      );
      return ASHATaskModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  /// Seed a minimal work plan for today when the backend has no tasks.
  List<ASHATaskModel> defaultWorkPlan() {
    final now = DateTime.now().toIso8601String();
    final today = DateTime.now().toIso8601String();
    return [
      ASHATaskModel(
        taskId: 'T-${DateTime.now().millisecondsSinceEpoch}-1',
        taskType: 'anc',
        title: 'ANC visit for due mother',
        description: 'Check vitals & record in ANCRecord.',
        dueDate: today,
        priority: 'high',
        createdAt: now,
        updatedAt: now,
      ),
      ASHATaskModel(
        taskId: 'T-${DateTime.now().millisecondsSinceEpoch}-2',
        taskType: 'immunization',
        title: 'Immunization follow-up',
        description: 'OPV/Pentavalent due for children.',
        dueDate: today,
        priority: 'high',
        createdAt: now,
        updatedAt: now,
      ),
      ASHATaskModel(
        taskId: 'T-${DateTime.now().millisecondsSinceEpoch}-3',
        taskType: 'hbnc',
        title: 'HBNC visit (day 7)',
        description: 'Newborn home visit - weight & danger signs.',
        dueDate: today,
        priority: 'medium',
        createdAt: now,
        updatedAt: now,
      ),
    ];
  }
}
