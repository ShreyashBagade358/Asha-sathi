import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'disease_local_repository.dart';
import 'disease_models.dart';

/// Remote + offline-first repository for disease control.
class DiseaseRepository {
  DiseaseRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _localDb = database,
        _local = DiseaseLocalRepository(database);

  final Dio _dio;
  final AppDatabase _localDb;
  final DiseaseLocalRepository _local;

  Future<List<DiseaseCaseModel>> fetchAll({String? type}) async {
    try {
      final uri = type == null
          ? '${AppConfig.apiBaseUrl}/disease-cases'
          : '${AppConfig.apiBaseUrl}/disease-cases?type=$type';
      final res = await _dio.get<List<dynamic>>(uri);
      final models = (res.data ?? const [])
          .map((e) => DiseaseCaseModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      final rows = type == null
          ? await _local.watchAll()
          : await _local.byType(type);
      return rows.map(_local.fromRow).toList();
    }
  }

  Future<DiseaseCaseModel?> getById(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
          '${AppConfig.apiBaseUrl}/disease-cases/$id');
      final model = DiseaseCaseModel.fromJson(res.data ?? {});
      await _local.upsert(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.byId(id);
      return row == null ? null : _local.fromRow(row);
    }
  }

  Future<DiseaseCaseModel> save(DiseaseCaseModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/disease-cases',
        data: model.toJson(),
      );
      return DiseaseCaseModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<MalariaCaseModel> saveMalaria(MalariaCaseModel model) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/disease-cases/malaria',
        data: model.toJson(),
      );
      return MalariaCaseModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      await SyncQueue.enqueue(
        db: _localDb,
        table: 'malaria_cases',
        recordId: model.caseId,
        operation: 'update',
        payload: model.toJson(),
      );
      return model;
    }
  }

  Future<TBCaseModel> saveTB(TBCaseModel model) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/disease-cases/tb',
        data: model.toJson(),
      );
      return TBCaseModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      await SyncQueue.enqueue(
        db: _localDb,
        table: 'tb_cases',
        recordId: model.caseId,
        operation: 'update',
        payload: model.toJson(),
      );
      return model;
    }
  }
}
