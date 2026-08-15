import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'appointment_model.dart';

/// Fetches and books PHC appointments.
class AppointmentsRepository {
  AppointmentsRepository(this._dio);
  final Dio _dio;

  Future<List<AppointmentModel>> fetchAppointments() async {
    try {
      final response = await _dio.get<List<dynamic>>('/appointments');
      return response.data!
          .map((e) => AppointmentModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockAppointments();
    } catch (_) {
      return mockAppointments();
    }
  }

  Future<AppointmentModel?> fetchById(String id) async {
    final appointments = await fetchAppointments();
    for (final appointment in appointments) {
      if (appointment.id == id) return appointment;
    }
    return null;
  }

  /// Book a new appointment; returns the created appointment.
  Future<AppointmentModel> book({
    required String title,
    required String facilityName,
    required DateTime scheduledAt,
    required String purpose,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('/appointments', data: {
        'title': title,
        'facility_name': facilityName,
        'scheduled_at': scheduledAt.toIso8601String(),
        'purpose': purpose,
      });
      return AppointmentModel.fromJson(response.data ?? const {});
    } on DioException {
      return AppointmentModel(
        id: 'apt-${DateTime.now().millisecondsSinceEpoch}',
        title: title,
        facilityName: facilityName,
        scheduledAt: scheduledAt,
        purpose: purpose,
        status: 'requested',
      );
    }
  }

  Future<void> cancel(String id) async {
    try {
      await _dio.post('/appointments/$id/cancel');
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  static List<AppointmentModel> mockAppointments() {
    final now = DateTime.now();
    return [
      AppointmentModel(
        id: 'apt-4001',
        title: 'Antenatal Checkup',
        facilityName: 'PHC Bhagalpur-01',
        providerName: 'Dr. Meera Nair',
        scheduledAt: now.add(const Duration(days: 3)),
        purpose: 'Regular ANC follow-up',
        status: 'confirmed',
        notes: 'Bring ANC card and latest lab reports.',
      ),
      AppointmentModel(
        id: 'apt-4002',
        title: 'Iron Supplement Review',
        facilityName: 'Sub-centre Simri',
        providerName: 'ANM Rekha Yadav',
        scheduledAt: now.add(const Duration(days: 10)),
        purpose: 'Review iron-folic acid response',
        status: 'scheduled',
      ),
      AppointmentModel(
        id: 'apt-4003',
        title: 'Ultrasound Scan',
        facilityName: 'District Hospital',
        providerName: 'Radiologist',
        scheduledAt: now.add(const Duration(days: 21)),
        purpose: 'Anomaly scan',
        status: 'confirmed',
        notes: 'Please carry referral letter.',
      ),
      AppointmentModel(
        id: 'apt-4004',
        title: 'Previous ANC Visit',
        facilityName: 'PHC Bhagalpur-01',
        providerName: 'Dr. Meera Nair',
        scheduledAt: now.subtract(const Duration(days: 5)),
        purpose: 'ANC visit 4',
        status: 'completed',
        notes: 'Vitals recorded. Fetal heart normal.',
      ),
    ];
  }
}

final appointmentsRepositoryProvider = Provider<AppointmentsRepository>(
  (ref) => AppointmentsRepository(ref.watch(dioProvider)),
);
