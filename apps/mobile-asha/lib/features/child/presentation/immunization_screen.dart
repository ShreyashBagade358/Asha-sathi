import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/child_models.dart';

final _scheduleProvider =
    FutureProvider.family<List<ImmunizationModel>, String>((ref, childId) async {
  final repo = ref.watch(childRepositoryProvider);
  final existing = await repo.immunizationSchedule(childId);
  if (existing.isNotEmpty) return existing;
  // Seed default schedule from the child's DOB.
  final child = await repo.getById(childId);
  final seeded = repo.defaultSchedule(childId, child?.dob);
  for (final m in seeded) {
    await repo.saveImmunization(m);
  }
  return seeded;
});

class ImmunizationScreen extends ConsumerWidget {
  const ImmunizationScreen({super.key, required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedule = ref.watch(_scheduleProvider(childId));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Immunization',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: schedule.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final due = list.where((m) => m.status != 'given').toList();
            final given = list.where((m) => m.status == 'given').toList();
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                Row(
                  children: [
                    const Icon(Icons.vaccines, color: ASHAColors.primary),
                    const SizedBox(width: 8),
                    Text('Due (${due.length})', style: ASHATypography.headlineMD),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                if (due.isEmpty)
                  const ASHACard(
                    title: 'All caught up 🎉',
                    subtitle: 'No vaccines due for this child.',
                    child: SizedBox.shrink(),
                  )
                else
                  ...due.map((m) => _VaccineRow(
                        model: m,
                        onTap: () => context.pushNamed(
                          AppRoutes.immunizationRecord,
                          pathParameters: {
                            'id': childId,
                            'vaccineId': m.immunizationId,
                          },
                        ),
                      )),
                const SizedBox(height: ASHASpacing.stackLG),
                Row(
                  children: [
                    const Icon(Icons.check_circle, color: ASHAColors.primary),
                    const SizedBox(width: 8),
                    Text('Given (${given.length})', style: ASHATypography.headlineMD),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                if (given.isEmpty)
                  Text('No vaccines recorded yet', style: ASHATypography.bodyMD)
                else
                  ...given.map((m) => _VaccineRow(model: m, showGiven: true)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _VaccineRow extends StatelessWidget {
  const _VaccineRow({required this.model, this.showGiven = false, this.onTap});

  final ImmunizationModel model;
  final bool showGiven;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
      child: ASHACard(
        onTap: onTap,
        title: model.vaccineName,
        subtitle: showGiven
            ? 'Given ${formatDate(tryParseDate(model.givenDate))}'
            : 'Due ${formatDate(tryParseDate(model.dueDate))}',
        child: Row(
          children: [
            StatusChip(
              status: showGiven
                  ? StatusChipType.success
                  : StatusChipType.warning,
              label: showGiven ? 'given' : 'due',
            ),
            const Spacer(),
            if (!showGiven)
              const Icon(Icons.chevron_right, color: ASHAColors.outline),
          ],
        ),
      ),
    );
  }
}
