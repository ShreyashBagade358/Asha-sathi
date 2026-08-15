import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import '../../../core/offline/sync_queue.dart';
import 'maternal_local_repository.dart';
import 'maternal_models.dart';

/// Remote + offline-first repository for maternal health records.
class MaternalRepository {
  MaternalRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _db = database,
        _local = MaternalLocalRepository(database);

  final Dio _dio;
  final AppDatabase _db;
  final MaternalLocalRepository _local;

  Future<List<PregnancyModel>> fetchPregnancies() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/pregnancies');
      final models = (res.data ?? const [])
          .map((e) => PregnancyModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsertPregnancy(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchPregnancies()).map(_local.pregnancyFromRow).toList();
    }
  }

  Future<List<PregnancyModel>> fetchHRP() async {
    final all = await fetchPregnancies();
    return all.where((p) => p.highRisk).toList();
  }

  Future<PregnancyModel?> getPregnancy(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
          '${AppConfig.apiBaseUrl}/pregnancies/$id');
      final model = PregnancyModel.fromJson(res.data ?? {});
      await _local.upsertPregnancy(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.pregnancyById(id);
      return row == null ? null : _local.pregnancyFromRow(row);
    }
  }

  Future<PregnancyModel> savePregnancy(PregnancyModel model) async {
    await _local.upsertPregnancy(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/pregnancies',
        data: model.toJson(),
      );
      return PregnancyModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<List<ANCVisitModel>> ancVisits(String pregnancyId) async {
    try {
      final res = await _dio.get<List<dynamic>>(
          '${AppConfig.apiBaseUrl}/pregnancies/$pregnancyId/anc-visits');
      return (res.data ?? const [])
          .map((e) => ANCVisitModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } on DioException {
      return (await _local.ancVisitsFor(pregnancyId)).map(_local.ancFromRow).toList();
    }
  }

  Future<ANCVisitModel> saveANCVisit(ANCVisitModel model) async {
    await _local.upsertANCVisit(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/pregnancies/${model.pregnancyId}/anc-visits',
        data: model.toJson(),
      );
      return ANCVisitModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  /// Delivery outcomes are stored locally + queued for sync.
  Future<DeliveryOutcomeModel> saveDelivery(DeliveryOutcomeModel model) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/deliveries',
        data: model.toJson(),
      );
      return DeliveryOutcomeModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      await SyncQueue.enqueue(
        db: _db,
        table: 'deliveries',
        recordId: model.deliveryId,
        operation: 'update',
        payload: model.toJson(),
      );
      return model;
    }
  }
}
