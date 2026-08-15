import 'package:freezed_annotation/freezed_annotation.dart';

part 'grievance_model.freezed.dart';
part 'grievance_model.g.dart';

/// A complaint / feedback raised by the beneficiary.
@freezed
abstract class GrievanceModel with _$GrievanceModel {
  const factory GrievanceModel({
    required String id,
    required String title,
    @Default('') String category,
    @Default('') String description,
    @Default('submitted') String status,
    @Default('') String referenceNumber,
    @Default('') String response,
    DateTime? submittedAt,
  }) = _GrievanceModel;

  factory GrievanceModel.fromJson(Map<String, dynamic> json) =>
      _$GrievanceModelFromJson(json);

  String get categoryLabel => _capitalize(category);

  String get statusLabel => status.replaceAll('_', ' ').toUpperCase();
}

String _capitalize(String input) {
  if (input.isEmpty) return input;
  return input[0].toUpperCase() + input.substring(1);
}
