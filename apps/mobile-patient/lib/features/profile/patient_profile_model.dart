import 'package:freezed_annotation/freezed_annotation.dart';

part 'patient_profile_model.freezed.dart';
part 'patient_profile_model.g.dart';

/// Demographic + health profile of a beneficiary.
@freezed
abstract class PatientProfileModel with _$PatientProfileModel {
  const factory PatientProfileModel({
    required String id,
    required String name,
    required String phone,
    @Default('') String abhaNumber,
    @Default('linked') String abhaStatus,
    @Default('') String dob,
    @Default('') String gender,
    @Default('') String maritalStatus,
    @Default('') String village,
    @Default('') String district,
    @Default('') String ashaName,
    @Default('') String ashaPhone,
    @Default('') String anmName,
    @Default('') String anmPhone,
    @Default('') String category,
    @Default(false) bool highRiskPregnancy,
    @Default('') String bloodGroup,
    @Default([]) List<String> allergies,
  }) = _PatientProfileModel;

  factory PatientProfileModel.fromJson(Map<String, dynamic> json) =>
      _$PatientProfileModelFromJson(json);

  String get initials => name.isEmpty
      ? 'S'
      : name.split(' ').where((p) => p.isNotEmpty).map((p) => p[0]).take(2).join().toUpperCase();
}
