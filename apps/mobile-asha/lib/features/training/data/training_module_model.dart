import 'package:freezed_annotation/freezed_annotation.dart';

part 'training_module_model.freezed.dart';
part 'training_module_model.g.dart';

/// A training module (video + quiz) for ASHA workers.
@freezed
abstract class TrainingModule with _$TrainingModule {
  const factory TrainingModule({
    @Default('') String trainingId,
    @Default('') String title,
    String? description,
    String? videoUrl,
    String? thumbnailUrl,
    @Default(0) int durationMinutes,
    @Default('pending') String completionStatus,
    int? quizScore,
    String? certificateUrl,
    String? completedAt,
  }) = _TrainingModule;

  factory TrainingModule.fromJson(Map<String, dynamic> json) =>
      _$TrainingModuleFromJson(json);
}
