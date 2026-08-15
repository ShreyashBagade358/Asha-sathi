import 'package:freezed_annotation/freezed_annotation.dart';

part 'disease_models.freezed.dart';
part 'disease_models.g.dart';

/// General notifiable / communicable disease case.
@freezed
abstract class DiseaseCaseModel with _$DiseaseCaseModel {
  const factory DiseaseCaseModel({
    @Default('') String caseId,
    @Default('') String diseaseType,
    @Default('') String patientName,
    String? beneficiaryId,
    String? diagnosisDate,
    @Default(<String>[]) List<String> symptoms,
    String? treatment,
    @Default('under-treatment') String status,
    String? locality,
    String? pincode,
    String? createdAt,
    String? updatedAt,
  }) = _DiseaseCaseModel;

  factory DiseaseCaseModel.fromJson(Map<String, dynamic> json) =>
      _$DiseaseCaseModelFromJson(json);
}

/// Malaria case with vector/parasite details.
@freezed
abstract class MalariaCaseModel with _$MalariaCaseModel {
  const factory MalariaCaseModel({
    @Default('') String caseId,
    @Default('') String patientName,
    String? diagnosisDate,
    @Default('pf') String species,
    @Default(false) bool microscopyPositive,
    @Default(false) bool rapidTestPositive,
    @Default(false) bool indoorResidualSprayDone,
    @Default('') String treatment,
    String? houseNumber,
    String? locality,
    @Default('') String pincode,
    String? source,
    @Default('under-treatment') String status,
    String? createdAt,
    String? updatedAt,
  }) = _MalariaCaseModel;

  factory MalariaCaseModel.fromJson(Map<String, dynamic> json) =>
      _$MalariaCaseModelFromJson(json);
}

/// Tuberculosis case with DOTS details.
@freezed
abstract class TBCaseModel with _$TBCaseModel {
  const factory TBCaseModel({
    @Default('') String caseId,
    @Default('') String patientName,
    String? diagnosisDate,
    @Default('pulmonary') String tbType,
    @Default(false) bool sputumPositive,
    @Default('') String dotsProvider,
    String? treatmentStartDate,
    @Default('') String treatmentRegimen,
    @Default('on-treatment') String status,
    String? houseNumber,
    String? locality,
    @Default('') String pincode,
    String? source,
    String? createdAt,
    String? updatedAt,
  }) = _TBCaseModel;

  factory TBCaseModel.fromJson(Map<String, dynamic> json) =>
      _$TBCaseModelFromJson(json);
}
