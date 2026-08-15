import 'package:freezed_annotation/freezed_annotation.dart';

part 'staff_model.freezed.dart';
part 'staff_model.g.dart';

/// Staff member (ASHA / ANM / supervisor / MO) under a PHC.
@freezed
abstract class StaffModel with _$StaffModel {
  const factory StaffModel({
    required String id,
    required String name,
    @Default('asha') String role,
    @Default('') String phone,
    @Default('') String phcId,
    @Default('') String village,
    @Default('') String supervisorId,
    @Default('') String supervisorName,
    @Default(0) int catchmentHouseholds,
    @Default(0) double performanceScore,
    @Default('active') String status,
    @Default('') String avatarColor,
  }) = _StaffModel;

  factory StaffModel.fromJson(Map<String, dynamic> json) =>
      _$StaffModelFromJson(json);

  String get roleLabel {
    switch (role) {
      case 'asha':
        return 'ASHA';
      case 'anm':
        return 'ANM';
      case 'phc_medical_officer':
        return 'Medical Officer';
      case 'health_supervisor':
        return 'Health Supervisor';
      case 'staff_nurse':
        return 'Staff Nurse';
      default:
        return role.toUpperCase();
    }
  }
}

/// Role filter options for the staff list.
const List<String> staffRoles = [
  'all',
  'asha',
  'anm',
  'health_supervisor',
  'phc_medical_officer',
];
