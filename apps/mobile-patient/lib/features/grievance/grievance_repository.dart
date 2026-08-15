import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'grievance_model.dart';

/// Submits and tracks beneficiary grievances.
class GrievanceRepository {
  GrievanceRepository(this._dio);
  final Dio _dio;

  Future<List<GrievanceModel>> fetchGrievances() async {
    try {
      final response = await _dio.get<List<dynamic>>('/grievances');
      return response.data!
          .map((e) => GrievanceModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockGrievances();
    } catch (_) {
      return mockGrievances();
    }
  }

  Future<GrievanceModel?> fetchById(String id) async {
    final grievances = await fetchGrievances();
    for (final grievance in grievances) {
      if (grievance.id == id) return grievance;
    }
    return null;
  }

  Future<GrievanceModel> submit({
    required String title,
    required String category,
    required String description,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/grievances', data: {
        'title': title,
        'category': category,
        'description': description,
      });
      return GrievanceModel.fromJson(response.data ?? const {});
    } on DioException {
      return GrievanceModel(
        id: 'grv-${DateTime.now().millisecondsSinceEpoch}',
        title: title,
        category: category,
        description: description,
        status: 'submitted',
        referenceNumber: 'ASHA-${DateTime.now().millisecondsSinceEpoch}',
        submittedAt: DateTime.now(),
      );
    }
  }

  static List<GrievanceModel> mockGrievances() {
    final now = DateTime.now();
    return [
      GrievanceModel(
        id: 'grv-7001',
        title: 'Iron tablets not available at sub-centre',
        category: 'supply',
        description:
            'Iron-folic acid stock finished at Simri sub-centre. I could not collect my tablets on the last visit.',
        status: 'under_review',
        referenceNumber: 'ASHA-4482',
        submittedAt: now.subtract(const Duration(days: 4)),
      ),
      GrievanceModel(
        id: 'grv-7002',
        title: 'Anganwadi worker absent on distribution day',
        category: 'service',
        description:
            'Take-home ration distribution was delayed because the worker was unavailable.',
        status: 'resolved',
        referenceNumber: 'ASHA-4390',
        response:
            'The anganwadi worker was on sanctioned leave. Distribution was completed the next day.',
        submittedAt: now.subtract(const Duration(days: 12)),
      ),
      GrievanceModel(
        id: 'grv-7003',
        title: 'SMS appointment reminder not received',
        category: 'technology',
        description:
            'Did not receive appointment reminder SMS for my last ANC visit.',
        status: 'submitted',
        referenceNumber: 'ASHA-4521',
        submittedAt: now.subtract(const Duration(hours: 8)),
      ),
    ];
  }
}

final grievanceRepositoryProvider = Provider<GrievanceRepository>(
  (ref) => GrievanceRepository(ref.watch(dioProvider)),
);
