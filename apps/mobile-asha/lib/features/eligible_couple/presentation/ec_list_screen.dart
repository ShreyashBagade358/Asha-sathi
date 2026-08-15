import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/ec_models.dart';

final _ecProvider = FutureProvider<List<EligibleCoupleModel>>((ref) async {
  return ref.watch(eligibleCoupleRepositoryProvider).fetchAll();
});

class ECListScreen extends ConsumerStatefulWidget {
  const ECListScreen({super.key});

  @override
  ConsumerState<ECListScreen> createState() => _ECListScreenState();
}

class _ECListScreenState extends ConsumerState<ECListScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final couples = ref.watch(_ecProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Eligible Couples',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Couples in reproductive age group for family planning counselling.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.ecRegister),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.family_restroom),
      ),
      body: SafeArea(
        child: couples.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final filtered = list.where((c) {
              final q = _query.toLowerCase();
              return c.husbandName.toLowerCase().contains(q) ||
                  c.wifeName.toLowerCase().contains(q) ||
                  c.ecId.toLowerCase().contains(q);
            }).toList();
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(ASHASpacing.marginMobile),
                  child: ASHATextField(
                    label: 'Search',
                    hint: 'Search couple',
                    prefixIcon: Icon(Icons.search),
                    onChanged: (v) => setState(() => _query = v ?? ''),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(
                          child: Text('No couples registered',
                              style: ASHATypography.bodyLG),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(
                            ASHASpacing.marginMobile,
                            0,
                            ASHASpacing.marginMobile,
                            96,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, i) {
                            final c = filtered[i];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                              child: ASHACard(
                                onTap: () => context.pushNamed(
                                  AppRoutes.ecDetail,
                                  pathParameters: {'id': c.ecId},
                                ),
                                title: '${c.husbandName} & ${c.wifeName}',
                                subtitle: '${c.ecId} · ${c.childrenCount ?? 0} children',
                                child: Row(
                                  children: [
                                    if (c.needsFamilyPlanning)
                                      const StatusChip(
                                          status: StatusChipType.info,
                                          label: 'Needs FP')
                                    else
                                      StatusChip(
                                        status: StatusChipType.neutral,
                                        label: c.contraceptiveMethod ?? 'No method',
                                      ),
                                    const Spacer(),
                                    const Icon(Icons.chevron_right,
                                        color: ASHAColors.outline),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
