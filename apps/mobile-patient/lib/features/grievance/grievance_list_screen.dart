import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'grievance_model.dart';
import 'grievance_repository.dart';

/// History of grievances with status.
class GrievanceListScreen extends ConsumerStatefulWidget {
  const GrievanceListScreen({super.key});

  @override
  ConsumerState<GrievanceListScreen> createState() => _GrievanceListScreenState();
}

class _GrievanceListScreenState extends ConsumerState<GrievanceListScreen> {
  List<GrievanceModel> _grievances = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final grievances = await ref.read(grievanceRepositoryProvider).fetchGrievances();
    if (mounted) setState(() {
      _grievances = grievances;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: ASHATopAppBar(title: 'My Grievances', onBack: () => context.pop()),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _grievances.isEmpty
              ? const ASHAEmptyState(
                  icon: Icons.history_toggle_off_outlined,
                  title: 'No grievances yet',
                  message: 'Your raised complaints will appear here.',
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(ASHASpacing.gutter),
                    itemCount: _grievances.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final grievance = _grievances[index];
                      return ASHACard(
                        onTap: () =>
                            context.push('/grievance/status/${grievance.id}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    grievance.title,
                                    style: ASHATypography.titleMedium,
                                  ),
                                ),
                                StatusChip(
                                  status: statusChipTypeFrom(grievance.status),
                                  label: grievance.statusLabel,
                                  compact: true,
                                ),
                              ],
                            ),
                            const SizedBox(height: ASHASpacing.stackSM),
                            Text(
                              '${grievance.categoryLabel} · ${grievance.referenceNumber} · ${formatDate(grievance.submittedAt ?? DateTime.now())}',
                              style: ASHATypography.bodySmall.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
