import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'abha_local_repository.dart';
import 'abha_record_model.dart';

/// Remote + offline-first repository for ABHA linkage.
class ABHARepository {
  ABHARepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = ABHALocalRepository(database);

  final Dio _dio;
  final ABHALocalRepository _local;

  Future<List<ABHARecordModel>> fetchAll() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/abha/records');
      final models = (res.data ?? const [])
          .map((e) => ABHARecordModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsert(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchAll()).map(_local.fromRow).toList();
    }
  }

  Future<ABHARecordModel> createByDemographic(Map<String, dynamic> profile) async {
    final now = DateTime.now().toIso8601String();
    final model = ABHARecordModel(
      abhaId: 'ABHA-${DateTime.now().millisecondsSinceEpoch}',
      beneficiaryId: profile['beneficiary_id'] as String?,
      status: 'created',
      linkingMethod: 'demographic',
      createdAt: now,
      updatedAt: now,
    );
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/abha/create',
        data: profile,
      );
      final remote = ABHARecordModel.fromJson(res.data ?? {});
      await _local.upsert(remote, queueSync: false);
      return remote;
    } on DioException {
      await _local.upsert(model);
      return model;
    }
  }

  Future<ABHARecordModel> linkByOtp(String abhaNumber, String otp) async {
    final now = DateTime.now().toIso8601String();
    final model = ABHARecordModel(
      abhaId: 'ABHA-${now}',
      abhaNumber: abhaNumber,
      status: 'linked',
      linkingMethod: 'otp',
      createdAt: now,
      updatedAt: now,
    );
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/abha/link/otp',
        data: {'abha_number': abhaNumber, 'otp': otp},
      );
      final remote = ABHARecordModel.fromJson(res.data ?? {});
      await _local.upsert(remote, queueSync: false);
      return remote;
    } on DioException {
      await _local.upsert(model);
      return model;
    }
  }

  Future<ABHARecordModel> linkByBiometric(String healthId) async {
    final now = DateTime.now().toIso8601String();
    final model = ABHARecordModel(
      abhaId: 'ABHA-${now}',
      healthId: healthId,
      status: 'linked',
      linkingMethod: 'biometric',
      createdAt: now,
      updatedAt: now,
    );
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/abha/link/biometric',
        data: {'health_id': healthId},
      );
      final remote = ABHARecordModel.fromJson(res.data ?? {});
      await _local.upsert(remote, queueSync: false);
      return remote;
    } on DioException {
      await _local.upsert(model);
      return model;
    }
  }

  Future<ABHARecordModel> grantConsent(String abhaId) async {
    final now = DateTime.now().toIso8601String();
    final model = ABHARecordModel(
      abhaId: abhaId,
      status: 'linked',
      consentGranted: true,
      linkingMethod: 'existing',
      updatedAt: now,
    );
    await _local.upsert(model);
    try {
      await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/abha/consent',
        data: {'abha_id': abhaId, 'consent': true},
      );
    } on DioException {
      // queued for sync
    }
    return model;
  }
}
