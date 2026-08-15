import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import 'scheme_model.dart';

/// Lists government schemes and their application status.
class SchemesRepository {
  SchemesRepository(this._dio);
  final Dio _dio;

  Future<List<SchemeModel>> fetchSchemes() async {
    try {
      final response = await _dio.get<List<dynamic>>('/schemes');
      return response.data!
          .map((e) => SchemeModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException {
      return mockSchemes();
    } catch (_) {
      return mockSchemes();
    }
  }

  Future<SchemeModel?> fetchById(String id) async {
    final schemes = await fetchSchemes();
    for (final scheme in schemes) {
      if (scheme.id == id) return scheme;
    }
    return null;
  }

  static List<SchemeModel> mockSchemes() => const [
        SchemeModel(
          id: 'sch-6001',
          name: 'Janani Suraksha Yojana (JSY)',
          department: 'Ministry of Health & Family Welfare',
          description:
              'Conditional cash transfer scheme to encourage institutional delivery and reduce maternal & infant mortality.',
          eligibility:
              'Pregnant women in low-income households delivering at a government health facility.',
          benefits:
              'Cash assistance of ₹1,400 (rural) / ₹1,000 (urban) on institutional delivery.',
          documents: 'Bank passbook, ANC card, delivery certificate.',
          status: 'active',
          eligible: true,
          appliedStatus: 'not_applied',
        ),
        SchemeModel(
          id: 'sch-6002',
          name: 'Pradhan Mantri Matru Vandana Yojana (PMMVY)',
          department: 'Ministry of Women & Child Development',
          description:
              'Cash incentive for pregnant and lactating women for their first live birth.',
          eligibility:
              'Pregnant women 19 years and above, first live birth, registered at anganwadi.',
          benefits: '₹5,000 in three instalments during pregnancy and lactation.',
          documents: 'MCP card, bank account details, Aadhaar.',
          status: 'active',
          eligible: true,
          appliedStatus: 'applied',
        ),
        SchemeModel(
          id: 'sch-6003',
          name: 'Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana',
          department: 'National Health Authority',
          description:
              'Health assurance of ₹5 lakh per family per year for secondary and tertiary care hospitalization.',
          eligibility:
              'Families listed in SECC-2011 beneficiary database as eligible households.',
          benefits: 'Cashless hospitalisation cover of ₹5 lakh per family per year.',
          documents: 'Ayushman card / E-card, Aadhaar.',
          status: 'active',
          eligible: true,
          appliedStatus: 'applied',
        ),
        SchemeModel(
          id: 'sch-6004',
          name: 'Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)',
          department: 'Ministry of Health & Family Welfare',
          description:
              'Free, high-quality antenatal care on the 9th of every month at identified centres.',
          eligibility: 'All pregnant women.',
          benefits:
              'Free antenatal checkup, diagnostics and treatment by specialist doctors.',
          documents: 'MCP card, Aadhaar.',
          status: 'active',
          eligible: true,
          appliedStatus: 'not_applied',
        ),
        SchemeModel(
          id: 'sch-6005',
          name: 'Mamta Scheme (Bihar)',
          department: 'Government of Bihar',
          description:
              'Health incentive scheme for pregnant women, mothers and children in Bihar.',
          eligibility: 'Residents of Bihar with valid MCP card.',
          benefits:
              'Financial incentives across pregnancy, delivery and child-care milestones.',
          documents: 'MCP card, Aadhaar, bank passbook.',
          status: 'active',
          eligible: true,
          appliedStatus: 'applied',
        ),
        SchemeModel(
          id: 'sch-6006',
          name: 'Kanya Utthan Yojana (Bihar)',
          department: 'Department of Social Welfare, Bihar',
          description:
              'Scheme for the education and welfare of girl children in Bihar.',
          eligibility: 'Girls born on or after 22 Jan 2019 in a BPL family.',
          benefits:
              '₹2,000 at birth, ₹5,000 at class 8, ₹5,000 at class 10 and more.',
          documents: 'Birth certificate, BPL card, Aadhaar.',
          status: 'active',
          eligible: false,
          appliedStatus: 'not_eligible',
        ),
      ];
}

final schemesRepositoryProvider = Provider<SchemesRepository>(
  (ref) => SchemesRepository(ref.watch(dioProvider)),
);
