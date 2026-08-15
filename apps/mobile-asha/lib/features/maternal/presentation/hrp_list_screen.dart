import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/maternal_models.dart';

final _hrpProvider = FutureProvider<List<PregnancyModel>>((ref) async {
  return ref.watch(maternalRepositoryProvider).fetchHRP();
});

/// High-risk pregnancy follow-up list.
class HRPListScreen extends ConsumerWidget {
  const HRPListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hrp = ref.watch(_hrpProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'High-Risk Pregnancies',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: hrp.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            if (list.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified_outlined,
                        size: 64, color: ASHAColors.primary),
                    SizedBox(height: ASHASpacing.stackMD),
                    Text('No high-risk pregnancies', style: ASHATypography.bodyLG),
                  ],
                ),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              itemCount: list.length,
              itemBuilder: (context, i) {
                final p = list[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                  child: ASHACard(
                    title: '${p.pregnancyId} · ${p.beneficiaryId}',
                    subtitle: p.highRiskReasons.join(', '),
                    child: Row(
                      children: [
                        const StatusChip(
                            status: StatusChipType.danger, label: 'HRP'),
                        const Spacer(),
                        ASHAButton(
                          label: 'ANC',
                          variant: ASHAButtonVariant.outline,
                          height: 40,
                          onPressed: () => context.pushNamed(
                            AppRoutes.ancRecord,
                            pathParameters: {'pregnancyId': p.pregnancyId},
                          ),
                        ),
                        const SizedBox(width: 8),
                        ASHAButton(
                          label: 'Birth Plan',
                          variant: ASHAButtonVariant.outline,
                          height: 40,
                          onPressed: () => context.pushNamed(
                            AppRoutes.microBirthPlan,
                            pathParameters: {'pregnancyId': p.pregnancyId},
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
