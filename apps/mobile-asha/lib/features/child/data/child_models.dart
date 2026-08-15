import 'package:freezed_annotation/freezed_annotation.dart';

part 'child_models.freezed.dart';
part 'child_models.g.dart';

/// A registered child under the ASHA worker's care.
@freezed
abstract class ChildModel with _$ChildModel {
  const factory ChildModel({
    @Default('') String childId,
    String? beneficiaryId,
    String? householdId,
    @Default('') String fullName,
    @Default('male') String gender,
    String? dob,
    double? birthWeight,
    int? birthOrder,
    String? motherBeneficiaryId,
    @Default(false) bool breastfeedingStarted,
    @Default('pending') String immunizationStatus,
    String? createdAt,
    String? updatedAt,
  }) = _ChildModel;

  factory ChildModel.fromJson(Map<String, dynamic> json) =>
      _$ChildModelFromJson(json);
}

/// Immunization dose record for a child.
@freezed
abstract class ImmunizationModel with _$ImmunizationModel {
  const factory ImmunizationModel({
    @Default('') String immunizationId,
    @Default('') String childId,
    @Default('') String vaccineName,
    String? dueDate,
    String? givenDate,
    String? givenAt,
    String? batchNumber,
    @Default('due') String status,
    String? createdAt,
    String? updatedAt,
  }) = _ImmunizationModel;

  factory ImmunizationModel.fromJson(Map<String, dynamic> json) =>
      _$ImmunizationModelFromJson(json);
}

/// Home Based Newborn Care visit (days 3, 7, 14, 21, 28).
@freezed
abstract class HBNCVisitModel with _$HBNCVisitModel {
  const factory HBNCVisitModel({
    @Default('') String visitId,
    @Default('') String childId,
    int? visitNumber,
    String? visitDate,
    int? dayOfLife,
    double? weightKg,
    double? temperature,
    @Default(false) bool jaundice,
    @Default(<String>[]) List<String> dangerSigns,
    @Default(false) bool referralNeeded,
    String? notes,
    String? createdAt,
    String? updatedAt,
  }) = _HBNCVisitModel;

  factory HBNCVisitModel.fromJson(Map<String, dynamic> json) =>
      _$HBNCVisitModelFromJson(json);
}

/// Home Based Care for Young Child visit (months 3-15).
@freezed
abstract class HBYCVisitModel with _$HBYCVisitModel {
  const factory HBYCVisitModel({
    @Default('') String visitId,
    @Default('') String childId,
    int? visitNumber,
    String? visitDate,
    int? ageMonths,
    @Default(false) bool complementaryFeedingStarted,
    @Default(false) bool growthMonitoring,
    @Default(false) bool counselingGiven,
    @Default(false) bool referralNeeded,
    String? notes,
    String? createdAt,
    String? updatedAt,
  }) = _HBYCVisitModel;

  factory HBYCVisitModel.fromJson(Map<String, dynamic> json) =>
      _$HBYCVisitModelFromJson(json);
}

/// One weight/height growth measurement for the growth chart.
@freezed
abstract class GrowthRecordModel with _$GrowthRecordModel {
  const factory GrowthRecordModel({
    @Default('') String recordId,
    @Default('') String childId,
    String? measuredOn,
    int? ageMonths,
    double? weightKg,
    double? heightCm,
    double? muacCm,
    String? createdAt,
  }) = _GrowthRecordModel;

  factory GrowthRecordModel.fromJson(Map<String, dynamic> json) =>
      _$GrowthRecordModelFromJson(json);
}
