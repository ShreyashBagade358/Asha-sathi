import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/disease_models.dart';

final _caseDetailProvider =
    FutureProvider.family<DiseaseCaseModel?, String>((ref, id) async {
  return ref.watch(diseaseRepositoryProvider).getById(id);
});

class DiseaseCaseDetailScreen extends ConsumerWidget {
  const DiseaseCaseDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_caseDetailProvider(id));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Case Detail',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (c) {
            if (c == null) return buildErrorScreen(ErrorScreenType.dataNotFound);
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: '${c.diseaseType.toUpperCase()} · ${c.patientName}',
                  subtitle: c.caseId,
                  child: Row(
                    children: [
                      StatusChip(
                        status: c.status == 'cured'
                            ? StatusChipType.success
                            : StatusChipType.warning,
                        label: c.status,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _Row('Diagnosis date', c.diagnosisDate ?? '—'),
                _Row('Locality', c.locality ?? '—'),
                _Row('Pincode', c.pincode ?? '—'),
                _Row('Treatment', c.treatment ?? '—'),
                const SizedBox(height: ASHASpacing.stackMD),
                Text('Symptoms', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                if (c.symptoms.isEmpty)
                  Text('None recorded', style: ASHATypography.bodyMD)
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: c.symptoms
                        .map((s) => StatusChip(status: StatusChipType.neutral, label: s))
                        .toList(),
                  ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'View outbreak map',
                  onPressed: () =>
                      context.pushNamed(AppRoutes.diseaseOutbreakMap),
                  variant: ASHAButtonVariant.outline,
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.map_outlined,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: ASHATypography.bodyMD.copyWith(color: ASHAColors.onSurfaceVariant),
            ),
          ),
          Text(value, style: ASHATypography.bodyMD),
        ],
      ),
    );
  }
}
