import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/disease_models.dart';

final _casesProvider = FutureProvider<List<DiseaseCaseModel>>((ref) async {
  return ref.watch(diseaseRepositoryProvider).fetchAll();
});

class DiseaseCaseListScreen extends ConsumerStatefulWidget {
  const DiseaseCaseListScreen({super.key});

  @override
  ConsumerState<DiseaseCaseListScreen> createState() => _DiseaseCaseListScreenState();
}

class _DiseaseCaseListScreenState extends ConsumerState<DiseaseCaseListScreen> {
  String? _type;

  @override
  Widget build(BuildContext context) {
    final cases = ref.watch(_casesProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Disease Cases',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reported communicable disease cases.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.diseaseNew),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: cases.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final filtered = _type == null
                ? list
                : list.where((c) => c.diseaseType == _type).toList();
            return Column(
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.all(ASHASpacing.marginMobile),
                  child: Row(
                    children: [
                      _Chip('All', _type == null, () => setState(() => _type = null)),
                      const SizedBox(width: 8),
                      _Chip('Malaria', _type == 'malaria',
                          () => setState(() => _type = 'malaria')),
                      const SizedBox(width: 8),
                      _Chip('TB', _type == 'tb', () => setState(() => _type = 'tb')),
                      const SizedBox(width: 8),
                      _Chip('Dengue', _type == 'dengue',
                          () => setState(() => _type = 'dengue')),
                    ],
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(
                          child: Text('No cases reported', style: ASHATypography.bodyLG),
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
                                  AppRoutes.diseaseDetail,
                                  pathParameters: {'id': c.caseId},
                                ),
                                title: '${c.diseaseType.toUpperCase()} · ${c.patientName}',
                                subtitle: '${c.locality ?? '—'} · ${c.diagnosisDate ?? ''}',
                                child: Row(
                                  children: [
                                    StatusChip(
                                      status: c.status == 'cured'
                                          ? StatusChipType.success
                                          : StatusChipType.warning,
                                      label: c.status,
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

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.selected, this.onTap);

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
