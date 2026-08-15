import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/l10n/app_strings.dart';
import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/household_local_repository.dart';
import '../data/household_model.dart';
import '../data/household_repository.dart';

final _householdsProvider = FutureProvider<List<HouseholdModel>>((ref) async {
  return ref.watch(householdRepositoryProvider).fetchAll();
});

class HouseholdListScreen extends ConsumerStatefulWidget {
  const HouseholdListScreen({super.key});

  @override
  ConsumerState<HouseholdListScreen> createState() => _HouseholdListScreenState();
}

class _HouseholdListScreenState extends ConsumerState<HouseholdListScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final households = ref.watch(_householdsProvider);
    final lang = AppStrings.t;
    return Scaffold(
      appBar: ASHATopAppBar(
        title: lang('households'),
        onHelp: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Households you have surveyed in your area.')),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.householdNew),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: households.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final filtered = list.where((h) {
              final q = _query.toLowerCase();
              return h.hhid.toLowerCase().contains(q) ||
                  h.villageId.toLowerCase().contains(q) ||
                  (h.address ?? '').toLowerCase().contains(q);
            }).toList();
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(ASHASpacing.marginMobile),
                  child: ASHATextField(
                    label: lang('search'),
                    hint: 'Search by HHID or village',
                    prefixIcon: Icon(Icons.search),
                    onChanged: (v) => setState(() => _query = v ?? ''),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const _EmptyState()
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(
                            ASHASpacing.marginMobile,
                            0,
                            ASHASpacing.marginMobile,
                            96,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, i) => _HouseholdCard(
                            model: filtered[i],
                            onTap: () => context.pushNamed(
                              AppRoutes.householdDetail,
                              pathParameters: {'id': filtered[i].hhid},
                            ),
                          ),
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

class _HouseholdCard extends StatelessWidget {
  const _HouseholdCard({required this.model, required this.onTap});

  final HouseholdModel model;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
      child: ASHACard(
        onTap: onTap,
        title: model.hhid,
        subtitle: model.summaryAddress.isEmpty ? model.villageId : model.summaryAddress,
        child: Row(
          children: [
            if (model.consentGiven)
              const StatusChip(status: StatusChipType.success, label: 'Consent')
            else
              const StatusChip(status: StatusChipType.neutral, label: 'No consent'),
            const Spacer(),
            const Icon(Icons.chevron_right, color: ASHAColors.outline),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.home_work_outlined,
              size: 64, color: ASHAColors.outline),
          const SizedBox(height: ASHASpacing.stackMD),
          Text('No households found', style: ASHATypography.bodyLG),
        ],
      ),
    );
  }
}
