import 'package:freezed_annotation/freezed_annotation.dart';

part 'maternal_models.freezed.dart';
part 'maternal_models.g.dart';

/// A registered pregnancy for a beneficiary.
@freezed
abstract class PregnancyModel with _$PregnancyModel {
  const factory PregnancyModel({
    @Default('') String pregnancyId,
    @Default('') String beneficiaryId,
    String? lmp,
    String? edd,
    int? gravida,
    int? para,
    String? bloodGroup,
    @Default('active') String status,
    @Default(false) bool highRisk,
    @Default(<String>[]) List<String> highRiskReasons,
    String? createdAt,
    String? updatedAt,
  }) = _PregnancyModel;

  factory PregnancyModel.fromJson(Map<String, dynamic> json) =>
      _$PregnancyModelFromJson(json);
}

/// One ANC (antenatal) visit record.
@freezed
abstract class ANCVisitModel with _$ANCVisitModel {
  const factory ANCVisitModel({
    @Default('') String ancVisitId,
    @Default('') String pregnancyId,
    @Default('') String beneficiaryId,
    String? visitDate,
    int? gestationalAgeWeeks,
    double? weightKg,
    int? bpSystolic,
    int? bpDiastolic,
    double? hemoglobin,
    double? fundalHeight,
    int? fetalHeartRate,
    @Default(<String>[]) List<String> dangerSigns,
    @Default(<String>[]) List<String> labResults,
    String? referral,
    String? observations,
    String? createdAt,
    String? updatedAt,
  }) = _ANCVisitModel;

  factory ANCVisitModel.fromJson(Map<String, dynamic> json) =>
      _$ANCVisitModelFromJson(json);

  String get bpDisplay =>
      bpSystolic == null || bpDiastolic == null ? '—' : '$bpSystolic/$bpDiastolic';
}

/// Delivery outcome recorded at (or after) childbirth.
@freezed
abstract class DeliveryOutcomeModel with _$DeliveryOutcomeModel {
  const factory DeliveryOutcomeModel({
    @Default('') String deliveryId,
    @Default('') String pregnancyId,
    @Default('') String beneficiaryId,
    String? deliveryDate,
    String? deliveryPlace,
    String? deliveryConductor,
    @Default('normal') String deliveryMode,
    String? childName,
    @Default('male') String childGender,
    double? birthWeightKg,
    String? outcome,
    @Default(<String>[]) List<String> complications,
    String? createdAt,
    String? updatedAt,
  }) = _DeliveryOutcomeModel;

  factory DeliveryOutcomeModel.fromJson(Map<String, dynamic> json) =>
      _$DeliveryOutcomeModelFromJson(json);
}

/// Post-natal care visit (up to 42 days after delivery).
@freezed
abstract class PNCVisitModel with _$PNCVisitModel {
  const factory PNCVisitModel({
    @Default('') String pncVisitId,
    @Default('') String beneficiaryId,
    int? visitNumber,
    String? visitDate,
    double? motherWeightKg,
    int? bpSystolic,
    int? bpDiastolic,
    bool? breastfeedingStarted,
    bool? uterusInvoluted,
    bool? lochiaNormal,
    @Default(<String>[]) List<String> dangerSigns,
    String? notes,
    String? createdAt,
    String? updatedAt,
  }) = _PNCVisitModel;

  factory PNCVisitModel.fromJson(Map<String, dynamic> json) =>
      _$PNCVisitModelFromJson(json);
}

/// Micro birth plan prepared in the 9th month.
@freezed
abstract class MicroBirthPlanModel with _$MicroBirthPlanModel {
  const factory MicroBirthPlanModel({
    @Default('') String planId,
    @Default('') String pregnancyId,
    String? facility,
    String? modeOfTransport,
    String? attendant,
    @Default('') String emergencyContact,
    String? familyDecisionMaker,
    @Default(0) int advanceArrangement,
    bool? fundsArranged,
    bool? bloodDonorIdentified,
    String? notes,
    String? createdAt,
    String? updatedAt,
  }) = _MicroBirthPlanModel;

  factory MicroBirthPlanModel.fromJson(Map<String, dynamic> json) =>
      _$MicroBirthPlanModelFromJson(json);
}
