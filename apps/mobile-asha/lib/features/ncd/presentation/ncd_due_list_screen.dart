import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/ncd_screening_model.dart';

final _dueProvider = FutureProvider<List<NCDScreeningModel>>((ref) async {
  return ref.watch(ncdRepositoryProvider).dueScreenings();
});

/// People due for annual NCD screening (CBAC checklist).
class NCDDueListScreen extends ConsumerWidget {
  const NCDDueListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final due = ref.watch(_dueProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'NCD Screening Due',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('CBAC screening is due for people 30+ or with risk factors.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.cbacScreening),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.favorite_outline),
      ),
      body: SafeArea(
        child: due.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            if (list.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified_outlined, size: 64, color: ASHAColors.primary),
                    SizedBox(height: ASHASpacing.stackMD),
                    Text('No screenings due', style: ASHATypography.bodyLG),
                  ],
                ),
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
                final s = list[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                  child: ASHACard(
                    title: s.beneficiaryId,
                    subtitle: 'Last screened ${s.screeningDate ?? 'never'}',
                    child: Row(
                      children: [
                        StatusChip(
                          status: StatusChipType.warning,
                          label: 'Due',
                        ),
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
