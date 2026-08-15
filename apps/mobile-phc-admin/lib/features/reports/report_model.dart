import 'package:freezed_annotation/freezed_annotation.dart';

part 'report_model.freezed.dart';
part 'report_model.g.dart';

/// A single trend point for a chart (label -> value).
@freezed
abstract class ReportTrendPoint with _$ReportTrendPoint {
  const factory ReportTrendPoint({
    required String label,
    required double value,
  }) = _ReportTrendPoint;

  factory ReportTrendPoint.fromJson(Map<String, dynamic> json) =>
      _$ReportTrendPointFromJson(json);
}

/// Aggregated facility KPIs for one month.
@freezed
abstract class ReportModel with _$ReportModel {
  const factory ReportModel({
    required String id,
    required String period,
    required String facilityName,
    DateTime? generatedAt,
    @Default(0) int maternalRegistrations,
    @Default(0) int highRiskPregnancies,
    @Default(0) int institutionalDeliveries,
    @Default(0) int homeDeliveries,
    @Default(0) int childrenImmunized,
    @Default(0) int samCases,
    @Default(0) int mamCases,
    @Default(0) int ncdScreened,
    @Default(0) int hypertensionCases,
    @Default(0) int diabetesCases,
    @Default(0) int referralCount,
    @Default([]) List<ReportTrendPoint> registrationTrend,
  }) = _ReportModel;

  factory ReportModel.fromJson(Map<String, dynamic> json) =>
      _$ReportModelFromJson(json);

  int get totalDeliveries => institutionalDeliveries + homeDeliveries;

  double get institutionalDeliveryRate => totalDeliveries == 0
      ? 0
      : (institutionalDeliveries / totalDeliveries * 100);

  int get malnutritionCases => samCases + mamCases;

  int get totalNcdCases => hypertensionCases + diabetesCases;
}
