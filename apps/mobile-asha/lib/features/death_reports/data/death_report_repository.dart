import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'death_report_local_repository.dart';
import 'death_report_model.dart';

/// Remote + offline-first repository for death reports.
class DeathReportRepository {
  DeathReportRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = DeathReportLocalRepository(database);

  final Dio _dio;
  final DeathReportLocalRepository _local;

  Future<List<DeathReportModel>> fetchAll() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/death-reports');
      final models = (res.data ?? const [])
          .map((e) => DeathReportModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchAll()).map(_local.fromRow).toList();
    }
  }

  Future<DeathReportModel?> getById(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
          '${AppConfig.apiBaseUrl}/death-reports/$id');
      final model = DeathReportModel.fromJson(res.data ?? {});
      await _local.upsert(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.byId(id);
      return row == null ? null : _local.fromRow(row);
    }
  }

  Future<DeathReportModel> save(DeathReportModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/death-reports',
        data: model.toJson(),
      );
      return DeathReportModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }
}
