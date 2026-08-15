import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'health_record_model.dart';

/// Fetches the beneficiary's health records.
class HealthRecordsRepository {
  HealthRecordsRepository(this._dio);
  final Dio _dio;

  Future<List<HealthRecordModel>> fetchRecords() async {
    try {
      final response = await _dio.get<List<dynamic>>('/records');
      return response.data!
          .map((e) => HealthRecordModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockRecords();
    } catch (_) {
      return mockRecords();
    }
  }

  Future<HealthRecordModel?> fetchById(String id) async {
    final records = await fetchRecords();
    for (final record in records) {
      if (record.id == id) return record;
    }
    return null;
  }

  /// Request a shareable consent code / link for a record.
  Future<String> requestShareLink(String id) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/records/$id/share',
      );
      return response.data?['link'] as String? ??
          'https://asha-sathi.in/share/$id';
    } on DioException {
      return 'https://asha-sathi.in/share/$id';
    }
  }

  static List<HealthRecordModel> mockRecords() {
    final now = DateTime.now();
    return [
      HealthRecordModel(
        id: 'rec-3001',
        type: 'anc',
        title: 'ANC Visit 4',
        facilityName: 'PHC Bhagalpur-01',
        providerName: 'Dr. Meera Nair',
        recordedAt: now.subtract(const Duration(days: 5)),
        summary: 'Routine antenatal checkup. Fetal heart rate normal.',
        values: {
          'Gestational weeks': '30',
          'BP (mmHg)': '116/74',
          'Weight (kg)': '61.4',
          'Fundal height (cm)': '28',
          'Fetal heart rate': '142 bpm',
          'TT dose': 'TT-2 given',
        },
      ),
      HealthRecordModel(
        id: 'rec-3002',
        type: 'lab',
        title: 'CBC & Hb Report',
        facilityName: 'District Hospital Lab',
        providerName: 'Lab Technologist',
        recordedAt: now.subtract(const Duration(days: 8)),
        summary: 'Haemoglobin improving after iron-folic acid supplementation.',
        values: {
          'Haemoglobin': '10.8 g/dL',
          'RBC': '4.1 million/µL',
          'WBC': '7,200 /µL',
          'Platelets': '2.4 lakh/µL',
          'Iron status': 'Improving',
        },
      ),
      HealthRecordModel(
        id: 'rec-3003',
        type: 'growth',
        title: 'Weight & Height Tracking',
        facilityName: 'Sub-centre Simri',
        providerName: 'ASHA Sunita Devi',
        recordedAt: now.subtract(const Duration(days: 12)),
        summary: 'Weight gain within expected range for gestational age.',
        values: {
          'Weight (kg)': '59.8',
          'Height (cm)': '155',
          'BMI': '24.9',
          'MUAC (mm)': '272',
        },
      ),
      HealthRecordModel(
        id: 'rec-3004',
        type: 'immunization',
        title: 'TT Immunization',
        facilityName: 'PHC Bhagalpur-01',
        providerName: 'ANM Rekha Yadav',
        recordedAt: now.subtract(const Duration(days: 20)),
        summary: 'Second tetanus toxoid dose administered during pregnancy.',
        values: {
          'Vaccine': 'Tetanus Toxoid (TT-2)',
          'Dose': '2 of 2',
          'Route': 'IM',
          'Reaction': 'None',
        },
      ),
      HealthRecordModel(
        id: 'rec-3005',
        type: 'anc',
        title: 'ANC Visit 3',
        facilityName: 'PHC Bhagalpur-01',
        providerName: 'Dr. Meera Nair',
        recordedAt: now.subtract(const Duration(days: 35)),
        summary: 'Routine checkup. Advised iron-folic acid and calcium supplements.',
        values: {
          'Gestational weeks': '25',
          'BP (mmHg)': '118/76',
          'Weight (kg)': '58.5',
          'Fundal height (cm)': '25',
          'IFA': 'Continuing',
        },
      ),
      HealthRecordModel(
        id: 'rec-3006',
        type: 'ncd',
        title: 'Blood Pressure Screening',
        facilityName: 'Health & Wellness Centre',
        providerName: 'CPHC Staff',
        recordedAt: now.subtract(const Duration(days: 60)),
        summary: 'BP within normal range at screening camp.',
        values: {
          'BP (mmHg)': '112/72',
          'Pulse': '78 bpm',
          'Risk level': 'Low',
        },
      ),
    ];
  }
}

final healthRecordsRepositoryProvider = Provider<HealthRecordsRepository>(
  (ref) => HealthRecordsRepository(ref.watch(dioProvider)),
);
