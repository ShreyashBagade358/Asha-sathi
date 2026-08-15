import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/death_report_model.dart';

final _deathDetailProvider =
    FutureProvider.family<DeathReportModel?, String>((ref, id) async {
  return ref.watch(deathReportRepositoryProvider).getById(id);
});

class DeathReportDetailScreen extends ConsumerWidget {
  const DeathReportDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(_deathDetailProvider(id));
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Death Report',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (r) {
            if (r == null) return buildErrorScreen(ErrorScreenType.dataNotFound);
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                ASHACard(
                  title: r.deceasedName,
                  subtitle: '${r.deathReportId} · ${formatDate(tryParseDate(r.deathDate))}',
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (r.isMaternalDeath)
                        const StatusChip(
                            status: StatusChipType.danger, label: 'Maternal death'),
                      if (r.isChildDeath)
                        const StatusChip(
                            status: StatusChipType.danger, label: 'Child death'),
                      StatusChip(
                          status: StatusChipType.neutral, label: r.status),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                _Row('Gender', capitalizeWords(r.deceasedGender)),
                _Row('Age', r.deceasedAge?.toString() ?? '—'),
                _Row('Place of death', r.deathPlace ?? '—'),
                _Row('Cause category', r.causeCategory ?? '—'),
                _Row('Cause description', r.causeDescription ?? '—'),
                const SizedBox(height: ASHASpacing.stackMD),
                Text('Verbal autopsy', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  title: r.verbalAutopsyNotes ?? 'No notes recorded',
                  child: const SizedBox.shrink(),
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
