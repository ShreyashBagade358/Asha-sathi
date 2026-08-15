import 'package:freezed_annotation/freezed_annotation.dart';

part 'death_report_model.freezed.dart';
part 'death_report_model.g.dart';

/// A death report with verbal autopsy markers (incl. maternal/child flags).
@freezed
abstract class DeathReportModel with _$DeathReportModel {
  const factory DeathReportModel({
    @Default('') String deathReportId,
    @Default('') String deceasedName,
    @Default('') String deceasedGender,
    int? deceasedAge,
    String? deathDate,
    String? deathPlace,
    String? causeCategory,
    String? causeDescription,
    @Default(false) bool isMaternalDeath,
    @Default(false) bool isChildDeath,
    String? verbalAutopsyNotes,
    @Default('reported') String status,
    String? createdAt,
    String? updatedAt,
  }) = _DeathReportModel;

  factory DeathReportModel.fromJson(Map<String, dynamic> json) =>
      _$DeathReportModelFromJson(json);
}
