import 'package:freezed_annotation/freezed_annotation.dart';

part 'incentive_models.freezed.dart';
part 'incentive_models.g.dart';

/// A monthly incentive claim generated from ASHA activities.
@freezed
abstract class IncentiveClaimModel with _$IncentiveClaimModel {
  const factory IncentiveClaimModel({
    @Default('') String claimId,
    String? month,
    String? activityCode,
    @Default('') String activityName,
    int? quantity,
    double? amount,
    @Default('draft') String status,
    String? generatedFrom,
    String? beneficiaryId,
    String? createdAt,
    String? updatedAt,
  }) = _IncentiveClaimModel;

  factory IncentiveClaimModel.fromJson(Map<String, dynamic> json) =>
      _$IncentiveClaimModelFromJson(json);
}

/// A village-level form (VHND / VHNC / PHC / AHD / Deworming).
@freezed
abstract class VillageFormModel with _$VillageFormModel {
  const factory VillageFormModel({
    @Default('') String formId,
    @Default('') String formType,
    String? formDate,
    String? villageId,
    String? place,
    String? attendedBy,
    @Default(<String, dynamic>{}) Map<String, dynamic> data,
    @Default('draft') String status,
    String? createdAt,
    String? updatedAt,
  }) = _VillageFormModel;

  factory VillageFormModel.fromJson(Map<String, dynamic> json) =>
      _$VillageFormModelFromJson(json);
}
