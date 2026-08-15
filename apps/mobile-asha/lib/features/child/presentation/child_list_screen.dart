import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/child_models.dart';

final _childrenProvider = FutureProvider<List<ChildModel>>((ref) async {
  return ref.watch(childRepositoryProvider).fetchAll();
});

class ChildListScreen extends ConsumerStatefulWidget {
  const ChildListScreen({super.key});

  @override
  ConsumerState<ChildListScreen> createState() => _ChildListScreenState();
}

class _ChildListScreenState extends ConsumerState<ChildListScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final children = ref.watch(_childrenProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Children',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All children under your care, with immunization status.')),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pushNamed(AppRoutes.childRegister),
        backgroundColor: ASHAColors.primary,
        foregroundColor: ASHAColors.onPrimary,
        child: const Icon(Icons.child_care),
      ),
      body: SafeArea(
        child: children.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final filtered = list.where((c) {
              final q = _query.toLowerCase();
              return c.fullName.toLowerCase().contains(q) ||
                  c.childId.toLowerCase().contains(q);
            }).toList();
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(ASHASpacing.marginMobile),
                  child: ASHATextField(
                    label: 'Search',
                    hint: 'Search by name or ID',
                    prefixIcon: Icon(Icons.search),
                    onChanged: (v) => setState(() => _query = v ?? ''),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(
                          child: Text('No children registered',
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
                            final age = ageFromDob(tryParseDate(c.dob));
                            return Padding(
                              padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                              child: ASHACard(
                                onTap: () => context.pushNamed(
                                  AppRoutes.childDetail,
                                  pathParameters: {'id': c.childId},
                                ),
                                title: c.fullName,
                                subtitle: '${c.childId} · ${age}',
                                child: Row(
                                  children: [
                                    StatusChip(
                                      status: c.immunizationStatus == 'completed'
                                          ? StatusChipType.success
                                          : StatusChipType.warning,
                                      label: c.immunizationStatus,
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
