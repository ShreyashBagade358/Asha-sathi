import 'package:freezed_annotation/freezed_annotation.dart';

part 'appointment_model.freezed.dart';
part 'appointment_model.g.dart';

/// A PHC / sub-centre appointment for the beneficiary.
@freezed
abstract class AppointmentModel with _$AppointmentModel {
  const factory AppointmentModel({
    required String id,
    required String title,
    @Default('') String facilityName,
    @Default('') String providerName,
    DateTime? scheduledAt,
    @Default('') String purpose,
    @Default('confirmed') String status,
    @Default('') String notes,
  }) = _AppointmentModel;

  factory AppointmentModel.fromJson(Map<String, dynamic> json) =>
      _$AppointmentModelFromJson(json);

  bool get isUpcoming =>
      status == 'confirmed' || status == 'scheduled' || status == 'upcoming';
}
