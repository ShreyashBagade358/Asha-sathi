import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'reminder_model.dart';

/// Fetches and manages beneficiary reminders.
class RemindersRepository {
  RemindersRepository(this._dio);
  final Dio _dio;

  Future<List<ReminderModel>> fetchReminders() async {
    try {
      final response = await _dio.get<List<dynamic>>('/reminders');
      return response.data!
          .map((e) => ReminderModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockReminders();
    } catch (_) {
      return mockReminders();
    }
  }

  Future<ReminderModel> create(ReminderModel reminder) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/reminders',
        data: reminder.toJson(),
      );
      return ReminderModel.fromJson(response.data ?? const {});
    } on DioException {
      return reminder;
    }
  }

  Future<void> markDone(String id) async {
    try {
      await _dio.post('/reminders/$id/done');
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete('/reminders/$id');
    } on DioException {
      // Offline demo - accepted locally.
    }
  }

  static List<ReminderModel> mockReminders() {
    final now = DateTime.now();
    return [
      ReminderModel(
        id: 'rem-5001',
        title: 'Iron & Folic Acid Tablet',
        type: 'medication',
        description: 'Take one tablet after breakfast.',
        dueAt: now,
        status: 'due',
        frequency: 'daily',
        instructions: 'Continue for the full 180-day course.',
      ),
      ReminderModel(
        id: 'rem-5002',
        title: 'Calcium Supplement',
        type: 'medication',
        description: 'Two tablets - one in morning, one at night.',
        dueAt: now.add(const Duration(hours: 6)),
        status: 'pending',
        frequency: 'daily',
        instructions: 'Take with food to avoid stomach upset.',
      ),
      ReminderModel(
        id: 'rem-5003',
        title: 'ANC Appointment',
        type: 'visit',
        description: 'Antenatal checkup at PHC Bhagalpur-01.',
        dueAt: now.add(const Duration(days: 3)),
        status: 'pending',
        frequency: 'one_time',
        instructions: 'Carry ANC card and lab reports.',
      ),
      ReminderModel(
        id: 'rem-5004',
        title: 'TT-2 Vaccination',
        type: 'vaccination',
        description: 'Tetanus toxoid booster due at 32 weeks.',
        dueAt: now.add(const Duration(days: 14)),
        status: 'pending',
        frequency: 'one_time',
      ),
      ReminderModel(
        id: 'rem-5005',
        title: 'Morning BP Check',
        type: 'screening',
        description: 'Measure blood pressure at the sub-centre.',
        dueAt: now.subtract(const Duration(hours: 2)),
        status: 'done',
        frequency: 'weekly',
      ),
    ];
  }
}

final remindersRepositoryProvider = Provider<RemindersRepository>(
  (ref) => RemindersRepository(ref.watch(dioProvider)),
);
