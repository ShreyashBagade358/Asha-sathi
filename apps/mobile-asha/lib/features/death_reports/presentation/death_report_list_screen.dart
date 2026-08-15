import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/death_report_model.dart';

final _deathReportsProvider = FutureProvider<List<DeathReportModel>>((ref) async {
  return ref.watch(deathReportRepositoryProvider).fetchAll();
});

class DeathReportListScreen extends ConsumerWidget {
  const DeathReportListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reports = ref.watch(_deathReportsProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Death Reports',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All reported deaths including maternal & child deaths.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.deathNew),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: reports.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            if (list.isEmpty) {
              return const Center(
                child: Text('No death reports', style: ASHATypography.bodyLG),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(
                ASHASpacing.marginMobile,
                ASHASpacing.marginMobile,
                ASHASpacing.marginMobile,
                96,
              ),
              itemCount: list.length,
              itemBuilder: (context, i) {
                final r = list[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                  child: ASHACard(
                    onTap: () => context.pushNamed(
                      AppRoutes.deathDetail,
                      pathParameters: {'id': r.deathReportId},
                    ),
                    title: r.deceasedName,
                    subtitle:
                        '${r.deathDate ?? '—'} · ${r.causeCategory ?? 'cause not stated'}',
                    child: Row(
                      children: [
                        if (r.isMaternalDeath)
                          const StatusChip(
                              status: StatusChipType.danger, label: 'Maternal'),
                        if (r.isChildDeath) ...[
                          const SizedBox(width: 8),
                          const StatusChip(
                              status: StatusChipType.danger, label: 'Child'),
                        ],
                        const Spacer(),
                        const Icon(Icons.chevron_right, color: ASHAColors.outline),
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
