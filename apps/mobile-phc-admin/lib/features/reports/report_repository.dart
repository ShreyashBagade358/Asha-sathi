import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'report_model.dart';

/// Fetches facility KPI reports.
class ReportRepository {
  ReportRepository(this._dio);
  final Dio _dio;

  Future<List<ReportModel>> fetchReports() async {
    try {
      final response = await _dio.get<List<dynamic>>('/reports');
      return response.data!
          .map((e) => ReportModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockReports();
    } catch (_) {
      return mockReports();
    }
  }

  Future<ReportModel?> fetchById(String id) async {
    final reports = await fetchReports();
    for (final report in reports) {
      if (report.id == id || report.period == id) return report;
    }
    return null;
  }

  static List<ReportModel> mockReports() {
    final now = DateTime.now();
    return [
      ReportModel(
        id: 'rep-2026-07',
        period: '2026-07',
        facilityName: 'PHC Bhagalpur-01',
        generatedAt: now,
        maternalRegistrations: 86,
        highRiskPregnancies: 9,
        institutionalDeliveries: 71,
        homeDeliveries: 4,
        childrenImmunized: 103,
        samCases: 3,
        mamCases: 11,
        ncdScreened: 154,
        hypertensionCases: 18,
        diabetesCases: 9,
        referralCount: 24,
        registrationTrend: const [
          ReportTrendPoint(label: 'Mar', value: 58),
          ReportTrendPoint(label: 'Apr', value: 64),
          ReportTrendPoint(label: 'May', value: 61),
          ReportTrendPoint(label: 'Jun', value: 79),
          ReportTrendPoint(label: 'Jul', value: 86),
        ],
      ),
      ReportModel(
        id: 'rep-2026-06',
        period: '2026-06',
        facilityName: 'PHC Bhagalpur-01',
        generatedAt: now.subtract(const Duration(days: 31)),
        maternalRegistrations: 79,
        highRiskPregnancies: 7,
        institutionalDeliveries: 68,
        homeDeliveries: 6,
        childrenImmunized: 98,
        samCases: 2,
        mamCases: 9,
        ncdScreened: 141,
        hypertensionCases: 15,
        diabetesCases: 8,
        referralCount: 19,
        registrationTrend: const [
          ReportTrendPoint(label: 'Feb', value: 54),
          ReportTrendPoint(label: 'Mar', value: 58),
          ReportTrendPoint(label: 'Apr', value: 64),
          ReportTrendPoint(label: 'May', value: 61),
          ReportTrendPoint(label: 'Jun', value: 79),
        ],
      ),
      ReportModel(
        id: 'rep-2026-05',
        period: '2026-05',
        facilityName: 'PHC Bhagalpur-01',
        generatedAt: now.subtract(const Duration(days: 61)),
        maternalRegistrations: 61,
        highRiskPregnancies: 5,
        institutionalDeliveries: 60,
        homeDeliveries: 8,
        childrenImmunized: 89,
        samCases: 2,
        mamCases: 8,
        ncdScreened: 122,
        hypertensionCases: 13,
        diabetesCases: 6,
        referralCount: 15,
        registrationTrend: const [
          ReportTrendPoint(label: 'Jan', value: 52),
          ReportTrendPoint(label: 'Feb', value: 54),
          ReportTrendPoint(label: 'Mar', value: 58),
          ReportTrendPoint(label: 'Apr', value: 64),
          ReportTrendPoint(label: 'May', value: 61),
        ],
      ),
    ];
  }
}

final reportRepositoryProvider = Provider<ReportRepository>(
  (ref) => ReportRepository(ref.watch(dioProvider)),
);
