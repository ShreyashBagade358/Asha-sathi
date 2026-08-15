import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import 'ai_models.dart';

/// Riverpod provider for the AI assistant repository.
final aiRepositoryProvider = Provider<AIRepository>((ref) => AIRepository());

/// Backend client for the AI / ML risk-assist features.
class AIRepository {
  AIRepository({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;

  /// Maternal risk prediction from vitals + history.
  Future<AIRiskPredictionModel> predictMaternalRisk({
    required int age,
    required int gestationalAgeWeeks,
    required double hemoglobin,
    required int bpSystolic,
    required int bpDiastolic,
    bool previousCSection = false,
    bool multiplePregnancy = false,
    bool preExistingDiabetes = false,
    bool preExistingHypertension = false,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/ai/maternal-risk',
        data: {
          'age': age,
          'gestational_age_weeks': gestationalAgeWeeks,
          'hemoglobin': hemoglobin,
          'bp_systolic': bpSystolic,
          'bp_diastolic': bpDiastolic,
          'previous_c_section': previousCSection,
          'multiple_pregnancy': multiplePregnancy,
          'pre_existing_diabetes': preExistingDiabetes,
          'pre_existing_hypertension': preExistingHypertension,
        },
      );
      return AIRiskPredictionModel.fromJson(res.data ?? {});
    } on DioException {
      // Deterministic offline fallback.
      return _offlineMaternalRisk(
        age: age,
        hb: hemoglobin,
        bpSystolic: bpSystolic,
        bpDiastolic: bpDiastolic,
      );
    }
  }

  AIRiskPredictionModel _offlineMaternalRisk({
    required int age,
    required double hb,
    required int bpSystolic,
    required int bpDiastolic,
  }) {
    final factors = <String>[];
    if (age < 18) factors.add('Adolescent pregnancy (age < 18)');
    if (age > 35) factors.add('Advanced maternal age (> 35)');
    if (hb < 7) factors.add('Severe anaemia');
    if (hb < 11) factors.add('Anaemia');
    if (bpSystolic >= 140 || bpDiastolic >= 90) {
      factors.add('Hypertension (BP >= 140/90)');
    }
    final score = factors.length;
    return AIRiskPredictionModel(
      category: 'maternal',
      riskLevel: score >= 2 ? 'high' : (score == 1 ? 'moderate' : 'low'),
      riskScore: score / 5,
      riskFactors: factors,
      recommendation: score >= 2
          ? 'Refer to PHC/CHC for detailed evaluation urgently.'
          : 'Continue routine ANC. Re-screen at next visit.',
      modelVersion: 'offline-rule-v1',
    );
  }

  /// Child growth risk from weight-for-age z-score inputs.
  Future<AIRiskPredictionModel> predictChildGrowth({
    required int ageMonths,
    required double weightKg,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/ai/child-growth',
        data: {'age_months': ageMonths, 'weight_kg': weightKg},
      );
      return AIRiskPredictionModel.fromJson(res.data ?? {});
    } on DioException {
      // Simple median-weight heuristic (approx WHO medians).
      const medians = <double>[
        3.3, 4.5, 5.8, 6.6, 7.3, 7.8, 8.2, 8.6, 8.9, 9.2,
        9.5, 9.7, 10.0,
      ];
      final median = ageMonths < medians.length ? medians[ageMonths] : 10.0;
      final diff = (weightKg - median) / median;
      final level = diff < -0.3
          ? 'high'
          : diff < -0.15
              ? 'moderate'
              : 'low';
      return AIRiskPredictionModel(
        category: 'child-growth',
        riskLevel: level,
        riskScore: (diff + 1).clamp(0.0, 1.0),
        riskFactors: diff < -0.3 ? ['Severe underweight for age'] : const [],
        recommendation: diff < -0.3
            ? 'Refer to nutrition rehabilitation. Start HBYC counselling.'
            : 'Continue growth monitoring monthly.',
        modelVersion: 'offline-zscore-v1',
      );
    }
  }

  /// NCD risk prediction from CBAC score + measurements.
  Future<AIRiskPredictionModel> predictNCDRisk({
    required int cbacScore,
    required double bmi,
    required int bpSystolic,
    required int bpDiastolic,
    double? bloodSugar,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/ai/ncd-risk',
        data: {
          'cbac_score': cbacScore,
          'bmi': bmi,
          'bp_systolic': bpSystolic,
          'bp_diastolic': bpDiastolic,
          'blood_sugar': bloodSugar,
        },
      );
      return AIRiskPredictionModel.fromJson(res.data ?? {});
    } on DioException {
      final factors = <String>[];
      if (cbacScore >= 4) factors.add('CBAC score >= 4');
      if (bmi >= 25) factors.add('Overweight/obese (BMI >= 25)');
      if (bpSystolic >= 140 || bpDiastolic >= 90) factors.add('Hypertension');
      if ((bloodSugar ?? 0) >= 200) factors.add('Random sugar >= 200');
      return AIRiskPredictionModel(
        category: 'ncd',
        riskLevel: factors.length >= 2 ? 'high' : (factors.length == 1 ? 'moderate' : 'low'),
        riskScore: factors.length / 4,
        riskFactors: factors,
        recommendation: factors.length >= 2
            ? 'Refer to PHC for confirmatory testing (BP, glucose).'
            : 'Healthy lifestyle counselling recommended.',
        modelVersion: 'offline-rule-v1',
      );
    }
  }

  /// Free-form chat with the ASHA assistant.
  Future<String> chat(String message) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/ai/chat',
        data: {'message': message},
      );
      return res.data?['reply'] as String? ?? 'I\'m here to help.';
    } on DioException {
      return _offlineReply(message);
    }
  }

  String _offlineReply(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('anaemia') || lower.contains('hemoglobin') || lower.contains('hb')) {
      return 'Anaemia: give IFA tablets daily, advise iron-rich diet, and if Hb < 7 g/dL refer urgently.';
    }
    if (lower.contains('bp') || lower.contains('blood pressure') || lower.contains('hypertension')) {
      return 'High BP in pregnancy (>= 140/90) is a danger sign. Rest, reduce salt, and refer to PHC today.';
    }
    if (lower.contains('immuni') || lower.contains('vaccine')) {
      return 'Check the child\'s immunization card against the national schedule. Visit the Immunization tab for due doses.';
    }
    if (lower.contains('breastfeed')) {
      return 'Initiate breastfeeding within 1 hour of birth and exclusively breastfeed for 6 months.';
    }
    return 'Thank you for your question. I can help with anaemia, BP, immunization, breastfeeding and referrals.';
  }
}
