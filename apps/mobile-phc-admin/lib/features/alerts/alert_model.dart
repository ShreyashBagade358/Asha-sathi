import 'package:freezed_annotation/freezed_annotation.dart';

part 'alert_model.freezed.dart';
part 'alert_model.g.dart';

/// A priority alert raised for a beneficiary or facility.
@freezed
abstract class AlertModel with _$AlertModel {
  const factory AlertModel({
    required String id,
    required String title,
    @Default('general') String type,
    @Default('') String description,
    @Default('high') String priority,
    @Default('') String beneficiaryName,
    @Default('') String village,
    @Default('') String facilityId,
    @Default('unassigned') String assignedAsha,
    @Default('new') String status,
    DateTime? createdAt,
  }) = _AlertModel;

  factory AlertModel.fromJson(Map<String, dynamic> json) =>
      _$AlertModelFromJson(json);

  String get priorityLabel => priority.toUpperCase();

  String get typeLabel => _capitalize(type);

  String get statusLabel => status.replaceAll('_', ' ').toUpperCase();
}

String _capitalize(String input) {
  if (input.isEmpty) return input;
  return input[0].toUpperCase() + input.substring(1);
}
