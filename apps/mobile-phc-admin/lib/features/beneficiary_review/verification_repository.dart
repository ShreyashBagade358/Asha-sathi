import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'pending_verification_model.dart';

/// Fetches / reviews data entries submitted by ASHAs.
class VerificationRepository {
  VerificationRepository(this._dio);
  final Dio _dio;

  Future<List<PendingVerificationModel>> fetchQueue() async {
    try {
      final response = await _dio.get<List<dynamic>>('/verification/queue');
      return response.data!
          .map((e) => PendingVerificationModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockQueue();
    } catch (_) {
      return mockQueue();
    }
  }

  Future<PendingVerificationModel?> fetchById(String id) async {
    final queue = await fetchQueue();
    for (final item in queue) {
      if (item.id == id) return item;
    }
    return null;
  }

  /// Approve / reject an entry with an optional note.
  Future<void> review(String id, {required bool approve, String note = ''}) async {
    try {
      await _dio.post('/verification/$id/review',
          data: {'approve': approve, 'note': note});
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  static List<PendingVerificationModel> mockQueue() {
    final now = DateTime.now();
    return [
      PendingVerificationModel(
        id: 'pv-1001',
        beneficiaryName: 'Sita Kumari',
        category: 'maternal',
        submittedBy: 'Sunita Devi',
        ashaPhone: '+91 98123 45001',
        facilityId: 'phc-bhagalpur-01',
        status: 'pending',
        dataEntries: {
          'ANC visit': '3rd visit',
          'Gestational weeks': '26',
          'BP (mmHg)': '118/76',
          'Haemoglobin (g/dL)': '11.2',
          'Weight (kg)': '58.5',
          'Fundal height (cm)': '25',
        },
        submittedAt: now.subtract(const Duration(hours: 3)),
      ),
      PendingVerificationModel(
        id: 'pv-1002',
        beneficiaryName: 'Rani Devi',
        category: 'maternal',
        submittedBy: 'Rekha Yadav',
        ashaPhone: '+91 98123 45002',
        facilityId: 'phc-bhagalpur-01',
        status: 'pending',
        dataEntries: {
          'ANC visit': '1st visit',
          'Gestational weeks': '12',
          'BP (mmHg)': '142/92',
          'Haemoglobin (g/dL)': '8.9',
          'Weight (kg)': '62.0',
          'High-risk flag': 'Yes - refer to PHC',
        },
        submittedAt: now.subtract(const Duration(hours: 6)),
      ),
      PendingVerificationModel(
        id: 'pv-1003',
        beneficiaryName: 'Aarav Kumar',
        category: 'child',
        submittedBy: 'Kavita Singh',
        ashaPhone: '+91 98123 45003',
        facilityId: 'phc-bhagalpur-01',
        status: 'pending',
        dataEntries: {
          'Age (months)': '18',
          'Weight (kg)': '9.4',
          'Height (cm)': '78.0',
          'MUAC (mm)': '132',
          'Immunization': 'Complete',
          'Nutrition status': 'Normal (auto)',
        },
        submittedAt: now.subtract(const Duration(days: 1)),
      ),
      PendingVerificationModel(
        id: 'pv-1004',
        beneficiaryName: 'Mahesh Sah',
        category: 'ncd',
        submittedBy: 'Meena Paswan',
        ashaPhone: '+91 98123 45004',
        facilityId: 'phc-bhagalpur-01',
        status: 'pending',
        dataEntries: {
          'Age': '52',
          'BP (mmHg)': '146/94',
          'Random blood sugar': '198',
          'BMI': '28.4',
          'Waist (cm)': '98',
          'History': 'Father diabetic',
        },
        submittedAt: now.subtract(const Duration(days: 2)),
      ),
      PendingVerificationModel(
        id: 'pv-1005',
        beneficiaryName: 'Anita Kumari',
        category: 'child',
        submittedBy: 'Sunita Devi',
        ashaPhone: '+91 98123 45001',
        facilityId: 'phc-bhagalpur-01',
        status: 'approved',
        note: 'Verified against immunization register.',
        dataEntries: {
          'Age (months)': '30',
          'Weight (kg)': '11.2',
          'Height (cm)': '86.0',
          'MUAC (mm)': '138',
          'Immunization': 'Complete',
        },
        submittedAt: now.subtract(const Duration(days: 4)),
      ),
      PendingVerificationModel(
        id: 'pv-1006',
        beneficiaryName: 'Puja Oraon',
        category: 'maternal',
        submittedBy: 'Rekha Yadav',
        ashaPhone: '+91 98123 45002',
        facilityId: 'phc-bhagalpur-01',
        status: 'rejected',
        note: 'Duplicate entry - already recorded at 1st visit.',
        dataEntries: {
          'ANC visit': '1st visit',
          'Gestational weeks': '10',
          'BP (mmHg)': '112/72',
        },
        submittedAt: now.subtract(const Duration(days: 5)),
      ),
    ];
  }
}

final verificationRepositoryProvider = Provider<VerificationRepository>(
  (ref) => VerificationRepository(ref.watch(dioProvider)),
);
