import 'package:freezed_annotation/freezed_annotation.dart';

part 'ec_models.freezed.dart';
part 'ec_models.g.dart';

/// An eligible couple (reproductive age) registered for family planning.
@freezed
abstract class EligibleCoupleModel with _$EligibleCoupleModel {
  const factory EligibleCoupleModel({
    @Default('') String ecId,
    @Default('') String husbandName,
    @Default('') String wifeName,
    String? wifeBeneficiaryId,
    String? address,
    int? age,
    int? childrenCount,
    String? contraceptiveMethod,
    @Default(false) bool needsFamilyPlanning,
    String? createdAt,
    String? updatedAt,
  }) = _EligibleCoupleModel;

  factory EligibleCoupleModel.fromJson(Map<String, dynamic> json) =>
      _$EligibleCoupleModelFromJson(json);
}

/// Follow-up counselling/monitoring visit for an eligible couple.
@freezed
abstract class ECFollowupModel with _$ECFollowupModel {
  const factory ECFollowupModel({
    @Default('') String followupId,
    @Default('') String ecId,
    String? followupDate,
    String? methodUsed,
    @Default(<String>[]) List<String> sideEffects,
    @Default(false) bool counselingDone,
    @Default(false) bool missedPeriod,
    String? notes,
    String? createdAt,
    String? updatedAt,
  }) = _ECFollowupModel;

  factory ECFollowupModel.fromJson(Map<String, dynamic> json) =>
      _$ECFollowupModelFromJson(json);
}
