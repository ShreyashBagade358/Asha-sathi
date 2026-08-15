import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'patient_profile_model.dart';

/// Fetches and updates the beneficiary profile.
class ProfileRepository {
  ProfileRepository(this._dio);
  final Dio _dio;

  Future<PatientProfileModel> fetchProfile() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/profile');
      return PatientProfileModel.fromJson(response.data ?? const {});
    } on DioException {
      return mockProfile();
    } catch (_) {
      return mockProfile();
    }
  }

  Future<PatientProfileModel> updateProfile(
    PatientProfileModel profile,
  ) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '/profile',
        data: profile.toJson(),
      );
      return PatientProfileModel.fromJson(response.data ?? const {});
    } on DioException {
      return profile;
    }
  }

  static PatientProfileModel mockProfile() => const PatientProfileModel(
        id: 'ben-0001',
        name: 'Sita Kumari',
        phone: '9876543210',
        abhaNumber: '91-1234-5678-9012',
        abhaStatus: 'verified',
        dob: '1995-06-14',
        gender: 'Female',
        maritalStatus: 'Married',
        village: 'Simri',
        district: 'Bhagalpur',
        ashaName: 'Sunita Devi',
        ashaPhone: '+91 98123 45001',
        anmName: 'Rekha Yadav',
        anmPhone: '+91 98123 45002',
        category: 'Antenatal',
        highRiskPregnancy: false,
        bloodGroup: 'O+',
        allergies: ['Penicillin'],
      );
}

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(dioProvider)),
);
