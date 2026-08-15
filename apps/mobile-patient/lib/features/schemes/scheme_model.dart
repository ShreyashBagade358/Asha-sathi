import 'package:freezed_annotation/freezed_annotation.dart';

part 'scheme_model.freezed.dart';
part 'scheme_model.g.dart';

/// A government health / welfare scheme the beneficiary may be eligible for.
@freezed
abstract class SchemeModel with _$SchemeModel {
  const factory SchemeModel({
    required String id,
    required String name,
    @Default('') String department,
    @Default('') String description,
    @Default('') String eligibility,
    @Default('') String benefits,
    @Default('') String documents,
    @Default('active') String status,
    @Default(false) bool eligible,
    @Default('') String appliedStatus,
  }) = _SchemeModel;

  factory SchemeModel.fromJson(Map<String, dynamic> json) =>
      _$SchemeModelFromJson(json);
}
