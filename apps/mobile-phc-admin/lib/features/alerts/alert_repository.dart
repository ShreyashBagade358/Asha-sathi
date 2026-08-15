import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'alert_model.dart';

/// Fetches and triages facility alerts.
class AlertRepository {
  AlertRepository(this._dio);
  final Dio _dio;

  Future<List<AlertModel>> fetchAlerts() async {
    try {
      final response = await _dio.get<List<dynamic>>('/alerts');
      return response.data!
          .map((e) => AlertModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockAlerts();
    } catch (_) {
      return mockAlerts();
    }
  }

  Future<AlertModel?> fetchById(String id) async {
    final alerts = await fetchAlerts();
    for (final alert in alerts) {
      if (alert.id == id) return alert;
    }
    return null;
  }

  Future<void> assign(String id, {required String ashaName}) async {
    try {
      await _dio.post('/alerts/$id/assign', data: {'ashaName': ashaName});
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  Future<void> escalate(String id) async {
    try {
      await _dio.post('/alerts/$id/escalate');
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  Future<void> dismiss(String id) async {
    try {
      await _dio.post('/alerts/$id/dismiss');
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  static List<String> mockAshaList() => const [
        'Sunita Devi',
        'Rekha Yadav',
        'Kavita Singh',
        'Meena Paswan',
      ];

  static List<AlertModel> mockAlerts() {
    final now = DateTime.now();
    return [
      AlertModel(
        id: 'alt-2001',
        title: 'High-risk pregnancy without follow-up',
        type: 'maternal',
        description:
            'Rani Devi (26w gestation) has BP 142/92 and Hb 8.9. Referral to PHC issued but no follow-up visit recorded in 2 weeks.',
        priority: 'high',
        beneficiaryName: 'Rani Devi',
        village: 'Simri',
        facilityId: 'phc-bhagalpur-01',
        assignedAsha: 'unassigned',
        status: 'new',
        createdAt: now.subtract(const Duration(hours: 2)),
      ),
      AlertModel(
        id: 'alt-2002',
        title: 'Missed immunization dose',
        type: 'child',
        description:
            'Aarav Kumar (18 months) has not received the MR-2 booster due 6 weeks ago. Mother unreachable on two calls.',
        priority: 'medium',
        beneficiaryName: 'Aarav Kumar',
        village: 'Mathurapur',
        facilityId: 'phc-bhagalpur-01',
        assignedAsha: 'Kavita Singh',
        status: 'assigned',
        createdAt: now.subtract(const Duration(days: 1)),
      ),
      AlertModel(
        id: 'alt-2003',
        title: 'NCD screening overdue',
        type: 'ncd',
        description:
            'Mahesh Sah (52) flagged hypertensive during camp but has not returned for confirmation testing.',
        priority: 'high',
        beneficiaryName: 'Mahesh Sah',
        village: 'Simri',
        facilityId: 'phc-bhagalpur-01',
        assignedAsha: 'unassigned',
        status: 'new',
        createdAt: now.subtract(const Duration(days: 1)),
      ),
      AlertModel(
        id: 'alt-2004',
        title: 'Stock low - ORS sachets',
        type: 'stock',
        description:
            'ORS stock at sub-centre Simri fell below 20% reorder level. Resupply requested.',
        priority: 'medium',
        village: 'Simri',
        facilityId: 'phc-bhagalpur-01',
        assignedAsha: 'Rekha Yadav',
        status: 'escalated',
        createdAt: now.subtract(const Duration(days: 2)),
      ),
      AlertModel(
        id: 'alt-2005',
        title: 'Malnutrition case - SAM',
        type: 'nutrition',
        description:
            'Aarav Kumar flagged SAM on last measurement (weight 9.4 kg at 18 months). Nutrition rehabilitation advised.',
        priority: 'high',
        beneficiaryName: 'Aarav Kumar',
        village: 'Mathurapur',
        facilityId: 'phc-bhagalpur-01',
        assignedAsha: 'unassigned',
        status: 'new',
        createdAt: now.subtract(const Duration(days: 3)),
      ),
      AlertModel(
        id: 'alt-2006',
        title: 'Duplicate beneficiary record',
        type: 'data',
        description:
            'Two records found for Puja Oraon under different spellings. Merge requested.',
        priority: 'low',
        beneficiaryName: 'Puja Oraon',
        village: 'Bachwari',
        facilityId: 'phc-bhagalpur-01',
        assignedAsha: 'unassigned',
        status: 'dismissed',
        createdAt: now.subtract(const Duration(days: 5)),
      ),
    ];
  }
}

final alertRepositoryProvider = Provider<AlertRepository>(
  (ref) => AlertRepository(ref.watch(dioProvider)),
);
