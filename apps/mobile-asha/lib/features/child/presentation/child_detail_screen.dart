import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/child_models.dart';

final _childDetailProvider =
    FutureProvider.family<ChildModel?, String>((ref, id) async {
  return ref.watch(childRepositoryProvider).getById(id);
});

class ChildDetailScreen extends ConsumerWidget {
  const ChildDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_childDetailProvider(id));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Child',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (child) {
            if (child == null) return buildErrorScreen(ErrorScreenType.dataNotFound);
            final age = ageFromDob(tryParseDate(child.dob));
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: child.fullName,
                  subtitle: '${child.childId} · ${age}',
                  child: Row(
                    children: [
                      StatusChip(
                        status: child.immunizationStatus == 'completed'
                            ? StatusChipType.success
                            : StatusChipType.warning,
                        label: child.immunizationStatus,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _Row('Gender', capitalizeWords(child.gender)),
                _Row('Birth weight', child.birthWeight != null
                    ? '${child.birthWeight} kg'
                    : '—'),
                _Row('Breastfeeding', child.breastfeedingStarted ? 'Yes' : 'No'),
                _Row('Mother', child.motherBeneficiaryId ?? '—'),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Immunization Schedule',
                  onPressed: () => context.pushNamed(
                    AppRoutes.immunization,
                    pathParameters: {'id': id},
                  ),
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.vaccines_outlined,
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHAButton(
                  label: 'Growth Chart',
                  onPressed: () => context.pushNamed(
                    AppRoutes.growthChart,
                    pathParameters: {'id': id},
                  ),
                  variant: ASHAButtonVariant.outline,
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.timeline_outlined,
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHAButton(
                  label: 'HBNC Visit',
                  onPressed: () => context.pushNamed(
                    AppRoutes.hbncVisit,
                    pathParameters: {'id': id},
                  ),
                  variant: ASHAButtonVariant.outline,
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.home_outlined,
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHAButton(
                  label: 'HBYC Visit',
                  onPressed: () => context.pushNamed(
                    AppRoutes.hbycVisit,
                    pathParameters: {'id': id},
                  ),
                  variant: ASHAButtonVariant.outline,
                  fullWidth: true,
                  height: ASHASpacing.touchTargetMin,
                  icon: Icons.child_care_outlined,
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
