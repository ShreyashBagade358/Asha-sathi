import 'package:freezed_annotation/freezed_annotation.dart';

part 'reminder_model.freezed.dart';
part 'reminder_model.g.dart';

/// A medication / visit / vaccination reminder.
@freezed
abstract class ReminderModel with _$ReminderModel {
  const factory ReminderModel({
    required String id,
    required String title,
    @Default('medication') String type,
    @Default('') String description,
    DateTime? dueAt,
    @Default('pending') String status,
    @Default('daily') String frequency,
    @Default('') String instructions,
  }) = _ReminderModel;

  factory ReminderModel.fromJson(Map<String, dynamic> json) =>
      _$ReminderModelFromJson(json);

  String get typeLabel => _capitalize(type);

  String get frequencyLabel => frequency.replaceAll('_', ' ');
}

String _capitalize(String input) {
  if (input.isEmpty) return input;
  return input[0].toUpperCase() + input.substring(1);
}
