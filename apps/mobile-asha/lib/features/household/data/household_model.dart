import 'package:freezed_annotation/freezed_annotation.dart';

part 'household_model.freezed.dart';
part 'household_model.g.dart';

/// A surveyed household in the ASHA worker's assigned village(s).
@freezed
abstract class HouseholdModel with _$HouseholdModel {
  const factory HouseholdModel({
    @Default('') String hhid,
    @Default('') String villageId,
    String? address,
    String? landmark,
    @Default(<String>[]) List<String> amenities,
    @Default(false) bool consentGiven,
    String? createdAt,
    String? updatedAt,
  }) = _HouseholdModel;

  factory HouseholdModel.fromJson(Map<String, dynamic> json) =>
      _$HouseholdModelFromJson(json);

  String get summaryAddress => [address, landmark]
      .where((e) => e != null && e.isNotEmpty)
      .join(', ');
}
