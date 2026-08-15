import 'package:freezed_annotation/freezed_annotation.dart';

part 'ncd_screening_model.freezed.dart';
part 'ncd_screening_model.g.dart';

/// A CBAC (Community Based Assessment Checklist) NCD screening record.
@freezed
abstract class NCDScreeningModel with _$NCDScreeningModel {
  const factory NCDScreeningModel({
    @Default('') String screeningId,
    @Default('') String beneficiaryId,
    String? screeningDate,
    int? age,
    int? bpSystolic,
    int? bpDiastolic,
    double? bmi,
    double? bloodSugar,
    double? waistCircumference,
    @Default(0) int riskScore,
    @Default('low') String riskLevel,
    @Default(<String>[]) List<String> questions,
    String? referralStatus,
    String? createdAt,
    String? updatedAt,
  }) = _NCDScreeningModel;

  factory NCDScreeningModel.fromJson(Map<String, dynamic> json) =>
      _$NCDScreeningModelFromJson(json);
}
