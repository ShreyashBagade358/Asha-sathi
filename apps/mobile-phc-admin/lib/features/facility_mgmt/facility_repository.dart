import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'facility_model.dart';

/// Fetches the facility hierarchy from the backend with offline fallback.
class FacilityRepository {
  FacilityRepository(this._dio);
  final Dio _dio;

  /// Load all facilities reachable from this PHC.
  Future<List<FacilityModel>> fetchFacilities() async {
    try {
      final response = await _dio.get<List<dynamic>>('/facilities');
      return response.data!
          .map((e) => FacilityModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockFacilities();
    } catch (_) {
      return mockFacilities();
    }
  }

  Future<FacilityModel?> fetchById(String id) async {
    final facilities = await fetchFacilities();
    for (final f in facilities) {
      if (f.id == id) return f;
    }
    return null;
  }

  /// Direct children of `parentId` (sub-centres of a PHC, villages of a SC).
  Future<List<FacilityModel>> childrenOf(String parentId) async {
    final facilities = await fetchFacilities();
    return facilities.where((f) => f.parentId == parentId).toList();
  }

  /// Demo hierarchy used whenever the API is unavailable.
  static List<FacilityModel> mockFacilities() {
    return const [
      FacilityModel(
        id: 'phc-bhagalpur-01',
        name: 'Bhagalpur PHC',
        type: 'phc',
        district: 'Bhagalpur',
        block: 'Bhagalpur Rural',
        population: 25400,
        ashaCount: 18,
        anmCount: 4,
        contactPhone: '+91 98765 43210',
        address: 'Main Road, Bhagalpur, Bihar',
        isLive: true,
      ),
      FacilityModel(
        id: 'sc-bhagalpur-101',
        name: 'Bhagalpur Sub-centre 1',
        type: 'sub_center',
        parentId: 'phc-bhagalpur-01',
        district: 'Bhagalpur',
        block: 'Bhagalpur Rural',
        population: 8200,
        ashaCount: 6,
        anmCount: 1,
        contactPhone: '+91 98000 11101',
        address: 'Ward 4, Bhagalpur',
      ),
      FacilityModel(
        id: 'sc-bhagalpur-102',
        name: 'Bhagalpur Sub-centre 2',
        type: 'sub_center',
        parentId: 'phc-bhagalpur-01',
        district: 'Bhagalpur',
        block: 'Bhagalpur Rural',
        population: 7400,
        ashaCount: 5,
        anmCount: 1,
        contactPhone: '+91 98000 11102',
        address: 'Ward 9, Bhagalpur',
      ),
      FacilityModel(
        id: 'sc-bhagalpur-103',
        name: 'Bhagalpur Sub-centre 3',
        type: 'sub_center',
        parentId: 'phc-bhagalpur-01',
        district: 'Bhagalpur',
        block: 'Bhagalpur Rural',
        population: 9800,
        ashaCount: 7,
        anmCount: 1,
        contactPhone: '+91 98000 11103',
        address: 'Villlage Panchayat Road',
      ),
      FacilityModel(
        id: 'v-1001',
        name: 'Sultanganj Village',
        type: 'village',
        parentId: 'sc-bhagalpur-101',
        district: 'Bhagalpur',
        population: 2100,
        ashaCount: 2,
        contactPhone: '+91 97000 20001',
      ),
      FacilityModel(
        id: 'v-1002',
        name: 'Nathnagar Village',
        type: 'village',
        parentId: 'sc-bhagalpur-101',
        district: 'Bhagalpur',
        population: 1750,
        ashaCount: 1,
        contactPhone: '+91 97000 20002',
      ),
      FacilityModel(
        id: 'v-1003',
        name: 'Kharik Bazaar',
        type: 'village',
        parentId: 'sc-bhagalpur-102',
        district: 'Bhagalpur',
        population: 2600,
        ashaCount: 2,
        contactPhone: '+91 97000 20003',
      ),
      FacilityModel(
        id: 'v-1004',
        name: 'Sabour Village',
        type: 'village',
        parentId: 'sc-bhagalpur-103',
        district: 'Bhagalpur',
        population: 3200,
        ashaCount: 3,
        contactPhone: '+91 97000 20004',
      ),
    ];
  }
}

final facilityRepositoryProvider = Provider<FacilityRepository>(
  (ref) => FacilityRepository(ref.watch(dioProvider)),
);
