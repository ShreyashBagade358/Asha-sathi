import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'staff_model.dart';

/// Fetches staff (ASHAs + ANMs + supervisors) under the PHC.
class StaffRepository {
  StaffRepository(this._dio);
  final Dio _dio;

  Future<List<StaffModel>> fetchStaff() async {
    try {
      final response = await _dio.get<List<dynamic>>('/staff');
      return response.data!
          .map((e) => StaffModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockStaff();
    } catch (_) {
      return mockStaff();
    }
  }

  Future<StaffModel?> fetchById(String id) async {
    final staff = await fetchStaff();
    for (final s in staff) {
      if (s.id == id) return s;
    }
    return null;
  }

  /// Persist a new/edited staff record. Returns the id on success.
  Future<String> saveStaff(StaffModel staff) async {
    try {
      final response = await _dio.post('/staff', data: staff.toJson());
      return (response.data as Map<String, dynamic>?)?['id'] as String? ?? staff.id;
    } on DioException {
      // Offline demo - accept locally.
      return staff.id;
    }
  }

  static List<StaffModel> mockStaff() {
    return const [
      StaffModel(
        id: 'asha-001',
        name: 'Sunita Devi',
        role: 'asha',
        phone: '+91 98123 45001',
        phcId: 'phc-bhagalpur-01',
        village: 'Sultanganj Village',
        supervisorId: 'anm-001',
        supervisorName: 'Priya Kumari',
        catchmentHouseholds: 320,
        performanceScore: 92.0,
      ),
      StaffModel(
        id: 'asha-002',
        name: 'Rekha Yadav',
        role: 'asha',
        phone: '+91 98123 45002',
        phcId: 'phc-bhagalpur-01',
        village: 'Nathnagar Village',
        supervisorId: 'anm-001',
        supervisorName: 'Priya Kumari',
        catchmentHouseholds: 285,
        performanceScore: 78.0,
      ),
      StaffModel(
        id: 'asha-003',
        name: 'Kavita Singh',
        role: 'asha',
        phone: '+91 98123 45003',
        phcId: 'phc-bhagalpur-01',
        village: 'Kharik Bazaar',
        supervisorId: 'anm-002',
        supervisorName: 'Anita Sharma',
        catchmentHouseholds: 410,
        performanceScore: 88.5,
      ),
      StaffModel(
        id: 'asha-004',
        name: 'Meena Paswan',
        role: 'asha',
        phone: '+91 98123 45004',
        phcId: 'phc-bhagalpur-01',
        village: 'Sabour Village',
        supervisorId: 'anm-002',
        supervisorName: 'Anita Sharma',
        catchmentHouseholds: 260,
        performanceScore: 64.0,
        status: 'inactive',
      ),
      StaffModel(
        id: 'anm-001',
        name: 'Priya Kumari',
        role: 'anm',
        phone: '+91 98123 46001',
        phcId: 'phc-bhagalpur-01',
        village: 'Bhagalpur',
        catchmentHouseholds: 320,
        performanceScore: 91.0,
      ),
      StaffModel(
        id: 'anm-002',
        name: 'Anita Sharma',
        role: 'anm',
        phone: '+91 98123 46002',
        phcId: 'phc-bhagalpur-01',
        village: 'Bhagalpur',
        catchmentHouseholds: 410,
        performanceScore: 84.0,
      ),
      StaffModel(
        id: 'sup-001',
        name: 'Dr. Ramesh Gupta',
        role: 'health_supervisor',
        phone: '+91 98123 47001',
        phcId: 'phc-bhagalpur-01',
        village: 'Bhagalpur',
        catchmentHouseholds: 0,
        performanceScore: 95.0,
      ),
      StaffModel(
        id: 'mo-001',
        name: 'Dr. Meera Nair',
        role: 'phc_medical_officer',
        phone: '+91 98123 48001',
        phcId: 'phc-bhagalpur-01',
        village: 'Bhagalpur',
        catchmentHouseholds: 0,
        performanceScore: 98.0,
      ),
    ];
  }
}

final staffRepositoryProvider = Provider<StaffRepository>(
  (ref) => StaffRepository(ref.watch(dioProvider)),
);
