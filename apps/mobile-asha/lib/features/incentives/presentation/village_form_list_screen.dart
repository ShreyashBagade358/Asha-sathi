import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/incentive_models.dart';

final _formsProvider = FutureProvider<List<VillageFormModel>>((ref) async {
  return ref.watch(incentiveRepositoryProvider).fetchForms();
});

class VillageFormListScreen extends ConsumerWidget {
  const VillageFormListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final forms = ref.watch(_formsProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Village Forms',
        onBack: () => context.pop(),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.villageFormNew),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: forms.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            if (list.isEmpty) {
              return const Center(
                child: Text('No village forms', style: ASHATypography.bodyLG),
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
                final f = list[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                  child: ASHACard(
                    title: f.formType.toUpperCase(),
                    subtitle: '${f.formDate ?? '—'} · ${f.place ?? f.villageId ?? ''}',
                    child: Row(
                      children: [
                        StatusChip(
                          status: f.status == 'submitted'
                              ? StatusChipType.success
                              : StatusChipType.warning,
                          label: f.status,
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
