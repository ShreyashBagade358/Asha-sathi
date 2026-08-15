import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/beneficiary_model.dart';
import '../presentation/widgets/beneficiary_search_widget.dart';

final _beneficiariesProvider =
    FutureProvider<List<BeneficiaryModel>>((ref) async {
  return ref.watch(beneficiaryRepositoryProvider).fetchAll();
});

/// Searchable, filterable list of registered beneficiaries.
class BeneficiaryListScreen extends ConsumerStatefulWidget {
  const BeneficiaryListScreen({super.key});

  @override
  ConsumerState<BeneficiaryListScreen> createState() => _BeneficiaryListScreenState();
}

class _BeneficiaryListScreenState extends ConsumerState<BeneficiaryListScreen> {
  String _query = '';
  String? _genderFilter;
  bool _pregnantOnly = false;

  List<BeneficiaryModel> _applyFilters(List<BeneficiaryModel> all) {
    return all.where((b) {
      final q = _query.toLowerCase();
      final matchesQuery = b.fullName.toLowerCase().contains(q) ||
          b.beneficiaryId.toLowerCase().contains(q) ||
          (b.phone ?? '').contains(q);
      final matchesGender = _genderFilter == null || b.gender == _genderFilter;
      final matchesPregnant = !_pregnantOnly || b.isPregnant;
      return matchesQuery && matchesGender && matchesPregnant;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(_beneficiariesProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Beneficiaries',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All registered women & individuals under your care.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.beneficiaryNew),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.person_add_alt_1),
      ),
      body: SafeArea(
        child: list.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (all) {
            final filtered = _applyFilters(all);
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ASHASpacing.marginMobile,
                    ASHASpacing.marginMobile,
                    ASHASpacing.marginMobile,
                    0,
                  ),
                  child: BeneficiarySearchWidget(onChanged: (q) => setState(() => _query = q)),
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                      horizontal: ASHASpacing.marginMobile),
                  child: Row(
                    children: [
                      _FilterChip(
                        label: 'All',
                        selected: _genderFilter == null && !_pregnantOnly,
                        onTap: () => setState(() {
                          _genderFilter = null;
                          _pregnantOnly = false;
                        }),
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: 'Female',
                        selected: _genderFilter == 'female',
                        onTap: () => setState(() => _genderFilter = 'female'),
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: 'Male',
                        selected: _genderFilter == 'male',
                        onTap: () => setState(() => _genderFilter = 'male'),
                      ),
                      const SizedBox(width: 8),
                      _FilterChip(
                        label: 'Pregnant',
                        selected: _pregnantOnly,
                        onTap: () => setState(() => _pregnantOnly = true),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackSM),
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
                          itemBuilder: (context, i) {
                            final b = filtered[i];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                              child: ASHACard(
                                onTap: () => context.pushNamed(
                                  AppRoutes.beneficiaryDetail,
                                  pathParameters: {'id': b.beneficiaryId},
                                ),
                                title: b.fullName,
                                subtitle:
                                    '${b.beneficiaryId} · ${b.phone ?? 'no phone'}',
                                child: Row(
                                  children: [
                                    if (b.isPregnant)
                                      const StatusChip(
                                          status: StatusChipType.warning,
                                          label: 'Pregnant')
                                    else
                                      StatusChip(
                                        status: StatusChipType.neutral,
                                        label: ageFromDob(
                                                tryParseDate(b.dob))
                                            .toString(),
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

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: ASHAColors.primaryContainer,
      checkmarkColor: ASHAColors.primary,
      side: BorderSide(
        color: selected ? ASHAColors.primary : ASHAColors.outlineVariant,
      ),
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
          Icon(Icons.person_off_outlined, size: 64, color: ASHAColors.outline),
          SizedBox(height: ASHASpacing.stackMD),
          Text('No beneficiaries found', style: ASHATypography.bodyLG),
        ],
      ),
    );
  }
}
