import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'ncd_local_repository.dart';
import 'ncd_screening_model.dart';

/// Remote + offline-first repository for NCD screenings.
class NCDRepository {
  NCDRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = NCDLocalRepository(database);

  final Dio _dio;
  final NCDLocalRepository _local;

  Future<List<NCDScreeningModel>> fetchAll() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/ncd-screenings');
      final models = (res.data ?? const [])
          .map((e) => NCDScreeningModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchAll()).map(_local.fromRow).toList();
    }
  }

  Future<List<NCDScreeningModel>> dueScreenings() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/ncd-screenings/due');
      return (res.data ?? const [])
          .map((e) => NCDScreeningModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } on DioException {
      return (await _local.dueScreenings()).map(_local.fromRow).toList();
    }
  }

  Future<NCDScreeningModel> save(NCDScreeningModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/ncd-screenings',
        data: model.toJson(),
      );
      return NCDScreeningModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  /// Compute the CBAC risk score: 1 point per positive answer.
  int computeRiskScore(List<bool> answers) =>
      answers.where((a) => a).length;

  /// Map a raw score to a risk level.
  String riskLevelFor(int score) {
    if (score >= 4) return 'high';
    if (score >= 2) return 'moderate';
    return 'low';
  }
}
