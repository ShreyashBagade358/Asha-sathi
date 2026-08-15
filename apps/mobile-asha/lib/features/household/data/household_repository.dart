import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'household_local_repository.dart';
import 'household_model.dart';

/// Remote CRUD for households via the ASHA Sathi REST API with offline-first
/// local fallback through [HouseholdLocalRepository].
class HouseholdRepository {
  HouseholdRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = HouseholdLocalRepository(database);

  final Dio _dio;
  final HouseholdLocalRepository _local;

  Future<List<HouseholdModel>> fetchAll() async {
    try {
      final res = await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/households');
      final models = (res.data ?? const [])
          .map((e) => HouseholdModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      final rows = await _local.watchAll();
      return rows.map(_local.fromRow).toList();
    }
  }

  Future<HouseholdModel?> getById(String hhid) async {
    try {
      final res = await _dio
          .get<Map<String, dynamic>>('${AppConfig.apiBaseUrl}/households/$hhid');
      final model = HouseholdModel.fromJson(res.data ?? {});
      await _local.upsert(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.byId(hhid);
      return row == null ? null : _local.fromRow(row);
    }
  }

  Future<HouseholdModel> save(HouseholdModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/households',
        data: model.toJson(),
      );
      return HouseholdModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<void> delete(String hhid) async {
    await _local.delete(hhid);
    try {
      await _dio.delete('${AppConfig.apiBaseUrl}/households/$hhid');
    } on DioException {
      // queued for later sync
    }
  }
}
