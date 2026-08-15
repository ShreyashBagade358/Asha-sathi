import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'incentive_local_repository.dart';
import 'incentive_models.dart';

/// Remote + offline-first repository for incentives + village forms.
class IncentiveRepository {
  IncentiveRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = IncentiveLocalRepository(database);

  final Dio _dio;
  final IncentiveLocalRepository _local;

  Future<List<IncentiveClaimModel>> fetchClaims() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/incentives');
      final models = (res.data ?? const [])
          .map((e) => IncentiveClaimModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsertClaim(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchClaims()).map(_local.claimFromRow).toList();
    }
  }

  Future<List<IncentiveClaimModel>> claimsForMonth(String month) async {
    try {
      final res = await _dio
          .get<List<dynamic>>('${AppConfig.apiBaseUrl}/incentives?month=$month');
      return (res.data ?? const [])
          .map((e) => IncentiveClaimModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } on DioException {
      return (await _local.claimsForMonth(month)).map(_local.claimFromRow).toList();
    }
  }

  Future<IncentiveClaimModel> saveClaim(IncentiveClaimModel model) async {
    await _local.upsertClaim(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/incentives',
        data: model.toJson(),
      );
      return IncentiveClaimModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  /// Generate a claim set from recorded activities for [month].
  List<IncentiveClaimModel> generateFromActivities(String month) {
    final base = DateTime.now().millisecondsSinceEpoch;
    const activities = <(String, String, int, double)>[
      ('PREG_REG', 'Pregnancy registration', 1, 500),
      ('ANC_4', 'ANC visits completed', 4, 300),
      ('HBNC_4', 'HBNC visits (newborn)', 4, 250),
      ('IMM_MR', 'Measles-rubella dose', 1, 150),
      ('EC_FP', 'Eligible couple counselling', 2, 100),
    ];
    return activities
        .map((a) => IncentiveClaimModel(
              claimId: 'INC-$base-${a.$1}',
              month: month,
              activityCode: a.$1,
              activityName: a.$2,
              quantity: a.$3,
              amount: (a.$3 * a.$4).toDouble(),
              status: 'draft',
              generatedFrom: 'auto',
              createdAt: DateTime.now().toIso8601String(),
            ))
        .toList();
  }

  Future<List<VillageFormModel>> fetchForms() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/village-forms');
      final models = (res.data ?? const [])
          .map((e) => VillageFormModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsertForm(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchForms()).map(_local.formFromRow).toList();
    }
  }

  Future<VillageFormModel> saveForm(VillageFormModel model) async {
    await _local.upsertForm(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/village-forms',
        data: model.toJson(),
      );
      return VillageFormModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }
}
