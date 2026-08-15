import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/maternal_models.dart';

final _pregnanciesProvider =
    FutureProvider<List<PregnancyModel>>((ref) async {
  return ref.watch(maternalRepositoryProvider).fetchPregnancies();
});

class PregnancyListScreen extends ConsumerStatefulWidget {
  const PregnancyListScreen({super.key});

  @override
  ConsumerState<PregnancyListScreen> createState() => _PregnancyListScreenState();
}

class _PregnancyListScreenState extends ConsumerState<PregnancyListScreen> {
  int _tab = 0;

  List<PregnancyModel> _filter(List<PregnancyModel> all) {
    switch (_tab) {
      case 0:
        return all.where((p) => p.status == 'active').toList();
      case 1:
        return all.where((p) => p.status == 'delivered').toList();
      case 2:
        return all.where((p) => p.highRisk).toList();
      default:
        return all;
    }
  }

  @override
  Widget build(BuildContext context) {
    final pregnancies = ref.watch(_pregnanciesProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Pregnancies',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Track all registered pregnancies in your area.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.pregnancyRegister),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.pregnant_woman),
      ),
      body: SafeArea(
        child: pregnancies.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (all) {
            final filtered = _filter(all);
            return Column(
              children: [
                TabBar(
                  tabs: const [
                    Tab(text: 'Active'),
                    Tab(text: 'Delivered'),
                    Tab(text: 'High Risk'),
                  ],
                  onTap: (i) => setState(() => _tab = i),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const _EmptyState()
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(
                            ASHASpacing.marginMobile,
                            ASHASpacing.stackMD,
                            ASHASpacing.marginMobile,
                            96,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, i) {
                            final p = filtered[i];
                            final edd = tryParseDate(p.edd);
                            final weeks = gestationalAgeWeeks(tryParseDate(p.lmp));
                            return Padding(
                              padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                              child: ASHACard(
                                onTap: () => _openPregnancy(p),
                                title: 'Pregnancy · ${p.pregnancyId}',
                                subtitle: 'EDD ${formatDate(edd)} · GA ${weeks ?? 0} wks',
                                child: Row(
                                  children: [
                                    if (p.highRisk)
                                      const StatusChip(
                                          status: StatusChipType.danger,
                                          label: 'HRP')
                                    else
                                      const StatusChip(
                                          status: StatusChipType.success,
                                          label: 'Active'),
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

  void _openPregnancy(PregnancyModel p) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Pregnancy ${p.pregnancyId} selected')),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.pregnant_woman, size: 64, color: ASHAColors.outline),
          SizedBox(height: ASHASpacing.stackMD),
          Text('No pregnancies here yet', style: ASHATypography.bodyLG),
        ],
      ),
    );
  }
}
