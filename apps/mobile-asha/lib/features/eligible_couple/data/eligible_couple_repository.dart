import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'ec_local_repository.dart';
import 'ec_models.dart';

/// Remote + offline-first repository for eligible couples.
class EligibleCoupleRepository {
  EligibleCoupleRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = EligibleCoupleLocalRepository(database);

  final Dio _dio;
  final EligibleCoupleLocalRepository _local;

  Future<List<EligibleCoupleModel>> fetchAll() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/eligible-couples');
      final models = (res.data ?? const [])
          .map((e) => EligibleCoupleModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchAll()).map(_local.fromRow).toList();
    }
  }

  Future<EligibleCoupleModel?> getById(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
          '${AppConfig.apiBaseUrl}/eligible-couples/$id');
      final model = EligibleCoupleModel.fromJson(res.data ?? {});
      await _local.upsert(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.byId(id);
      return row == null ? null : _local.fromRow(row);
    }
  }

  Future<EligibleCoupleModel> save(EligibleCoupleModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/eligible-couples',
        data: model.toJson(),
      );
      return EligibleCoupleModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<ECFollowupModel> saveFollowup(ECFollowupModel model) async {
    await _local.upsertFollowup(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/eligible-couples/${model.ecId}/followups',
        data: model.toJson(),
      );
      return ECFollowupModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<List<ECFollowupModel>> followups(String ecId) async {
    try {
      final res = await _dio.get<List<dynamic>>(
          '${AppConfig.apiBaseUrl}/eligible-couples/$ecId/followups');
      return (res.data ?? const [])
          .map((e) => ECFollowupModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } on DioException {
      return (await _local.followupsFor(ecId)).map(_local.followupFromRow).toList();
    }
  }
}
