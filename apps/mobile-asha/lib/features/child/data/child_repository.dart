import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/database.dart';
import 'child_local_repository.dart';
import 'child_models.dart';

/// Remote + offline-first repository for child health.
class ChildRepository {
  ChildRepository({required Dio dio, required AppDatabase database})
      : _dio = dio,
        _local = ChildLocalRepository(database);

  final Dio _dio;
  final ChildLocalRepository _local;

  Future<List<ChildModel>> fetchAll() async {
    try {
      final res = await _dio.get<List<dynamic>>('${AppConfig.apiBaseUrl}/children');
      final models = (res.data ?? const [])
          .map((e) => ChildModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
      for (final m in models) {
        await _local.upsertChild(m, queueSync: false);
      }
      return models;
    } on DioException {
      return (await _local.watchChildren()).map(_local.childFromRow).toList();
    }
  }

  Future<ChildModel?> getById(String id) async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('${AppConfig.apiBaseUrl}/children/$id');
      final model = ChildModel.fromJson(res.data ?? {});
      await _local.upsertChild(model, queueSync: false);
      return model;
    } on DioException {
      final row = await _local.childById(id);
      return row == null ? null : _local.childFromRow(row);
    }
  }

  Future<ChildModel> save(ChildModel model) async {
    await _local.upsertChild(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/children',
        data: model.toJson(),
      );
      return ChildModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  Future<List<ImmunizationModel>> immunizationSchedule(String childId) async {
    try {
      final res = await _dio.get<List<dynamic>>(
          '${AppConfig.apiBaseUrl}/children/$childId/immunizations');
      return (res.data ?? const [])
          .map((e) => ImmunizationModel.fromJson((e as Map).cast<String, dynamic>()))
          .toList();
    } on DioException {
      return (await _local.immunizationsFor(childId))
          .map(_local.immunizationFromRow)
          .toList();
    }
  }

  Future<ImmunizationModel> saveImmunization(ImmunizationModel model) async {
    await _local.upsertImmunization(model);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/children/${model.childId}/immunizations',
        data: model.toJson(),
      );
      return ImmunizationModel.fromJson(res.data ?? model.toJson());
    } on DioException {
      return model;
    }
  }

  /// Default Indian immunization schedule relative to birth [dob].
  List<ImmunizationModel> defaultSchedule(String childId, String? dob) {
    final birth = DateTime.tryParse(dob ?? '');
    const schedule = {
      'BCG': 0,
      'Hepatitis B - Birth dose': 0,
      'OPV - Birth dose': 0,
      'Pentavalent - 1': 6,
      'OPV - 1': 6,
      'Rotavirus - 1': 6,
      'Pentavalent - 2': 10,
      'OPV - 2': 10,
      'Rotavirus - 2': 10,
      'Pentavalent - 3': 14,
      'OPV - 3': 14,
      'Rotavirus - 3': 14,
      'Measles / MR - 1': 9,
      'Vitamin A - 1': 9,
      'MR - 2': 15,
      'DPT booster - 1': 16,
      'OPV booster': 16,
      'Vitamin A - 2 to 9': 16,
      'DPT booster - 2': 60,
    };
    return schedule.entries.map((e) {
      final due = birth?.add(Duration(days: e.value * 30));
      return ImmunizationModel(
        immunizationId: 'IMM-${childId}-${e.key}',
        childId: childId,
        vaccineName: e.key,
        dueDate: due?.toIso8601String(),
        status: 'due',
      );
    }).toList();
  }
}
