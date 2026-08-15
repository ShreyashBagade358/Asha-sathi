import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'beneficiary_local_repository.dart';
import 'beneficiary_model.dart';

/// Remote + offline-first repository for beneficiaries.
class BeneficiaryRepository {
  BeneficiaryRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = BeneficiaryLocalRepository(database);

  final Dio _dio;
  final BeneficiaryLocalRepository _local;

  Future<List<BeneficiaryModel>> fetchAll() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/beneficiaries');
      final models = (res.data ?? const [])
          .map((e) => BeneficiaryModel.fromJson((e as Map).cast<String, dynamic>()))
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

  Future<BeneficiaryModel?> getById(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
          '${AppConfig.apiBaseUrl}/beneficiaries/$id');
      final model = BeneficiaryModel.fromJson(res.data ?? {});
      await _local.upsert(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.byId(id);
      return row == null ? null : _local.fromRow(row);
    }
  }

  Future<BeneficiaryModel> save(BeneficiaryModel model) async {
    await _local.upsert(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/beneficiaries',
        data: model.toJson(),
      );
      return BeneficiaryModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<void> delete(String id) => _local.delete(id);
}
