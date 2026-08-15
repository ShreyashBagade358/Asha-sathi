import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_models.freezed.dart';
part 'dashboard_models.g.dart';

/// Aggregated KPI snapshot for the ASHA worker's dashboard.
@freezed
abstract class ASHAKpiModel with _$ASHAKpiModel {
  const factory ASHAKpiModel({
    @Default(0) int pregnantWomen,
    @Default(0) int ancDone,
    @Default(0) int hrp,
    @Default(0) int immunized,
    @Default(0) int hbncDone,
    @Default(0) int eligibleCouples,
    @Default(0) int incentivesEarned,
    @Default(0) int dueTasks,
  }) = _ASHAKpiModel;

  factory ASHAKpiModel.fromJson(Map<String, dynamic> json) =>
      _$ASHAKpiModelFromJson(json);
}

/// A prioritised task in the daily work plan.
@freezed
abstract class ASHATaskModel with _$ASHATaskModel {
  const factory ASHATaskModel({
    @Default('') String taskId,
    @Default('') String taskType,
    @Default('') String title,
    String? description,
    String? dueDate,
    @Default('medium') String priority,
    @Default(false) bool isCompleted,
    String? completedAt,
    double? completedLatitude,
    double? completedLongitude,
    String? beneficiaryId,
    String? createdAt,
    String? updatedAt,
  }) = _ASHATaskModel;

  factory ASHATaskModel.fromJson(Map<String, dynamic> json) =>
      _$ASHATaskModelFromJson(json);
}
