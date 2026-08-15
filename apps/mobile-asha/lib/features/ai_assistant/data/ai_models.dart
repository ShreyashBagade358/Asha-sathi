import 'package:freezed_annotation/freezed_annotation.dart';

part 'ai_models.freezed.dart';
part 'ai_models.g.dart';

/// Structured risk prediction returned by the ML/back-end services.
@freezed
abstract class AIRiskPredictionModel with _$AIRiskPredictionModel {
  const factory AIRiskPredictionModel({
    @Default('maternal') String category,
    @Default('low') String riskLevel,
    @Default(0.0) double riskScore,
    @Default(<String>[]) List<String> riskFactors,
    @Default('') String recommendation,
    String? modelVersion,
  }) = _AIRiskPredictionModel;

  factory AIRiskPredictionModel.fromJson(Map<String, dynamic> json) =>
      _$AIRiskPredictionModelFromJson(json);
}

/// A message in the AI assistant chat.
@freezed
abstract class ChatMessageModel with _$ChatMessageModel {
  const factory ChatMessageModel({
    @Default('user') String role,
    @Default('') String text,
    String? timestamp,
  }) = _ChatMessageModel;

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) =>
      _$ChatMessageModelFromJson(json);
}
