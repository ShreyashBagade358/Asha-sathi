import 'package:freezed_annotation/freezed_annotation.dart';

part 'health_record_model.freezed.dart';
part 'health_record_model.g.dart';

/// A single health record (ANC visit, growth, immunization, lab, NCD).
@freezed
abstract class HealthRecordModel with _$HealthRecordModel {
  const factory HealthRecordModel({
    required String id,
    required String type,
    required String title,
    @Default('') String facilityName,
    @Default('') String providerName,
    DateTime? recordedAt,
    @Default('') String summary,
    @Default({}) Map<String, dynamic> values,
    @Default('complete') String status,
    @Default(true) bool shareable,
  }) = _HealthRecordModel;

  factory HealthRecordModel.fromJson(Map<String, dynamic> json) =>
      _$HealthRecordModelFromJson(json);

  String get typeLabel {
    switch (type) {
      case 'anc':
        return 'ANC Visit';
      case 'growth':
        return 'Growth Tracking';
      case 'immunization':
        return 'Immunization';
      case 'lab':
        return 'Lab Test';
      case 'ncd':
        return 'NCD Screening';
      default:
        return _capitalize(type);
    }
  }
}

String _capitalize(String input) {
  if (input.isEmpty) return input;
  return input[0].toUpperCase() + input.substring(1);
}
