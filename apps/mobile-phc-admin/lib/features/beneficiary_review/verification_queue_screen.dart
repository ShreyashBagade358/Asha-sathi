import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'pending_verification_model.dart';
import 'verification_repository.dart';

/// Pending beneficiary data entries awaiting PHC review.
class VerificationQueueScreen extends ConsumerStatefulWidget {
  const VerificationQueueScreen({super.key});

  @override
  ConsumerState<VerificationQueueScreen> createState() =>
      _VerificationQueueScreenState();
}

class _VerificationQueueScreenState
    extends ConsumerState<VerificationQueueScreen> {
  List<PendingVerificationModel> _queue = [];
  bool _loading = true;
  String _statusFilter = 'pending';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final queue = await ref.read(verificationRepositoryProvider).fetchQueue();
    if (mounted) setState(() {
      _queue = queue;
      _loading = false;
    });
  }

  List<PendingVerificationModel> get _filtered {
    if (_statusFilter == 'all') return _queue;
    return _queue.where((item) => item.status == _statusFilter).toList();
  }

  int get _pendingCount =>
      _queue.where((item) => item.status == 'pending').length;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _filtered;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Beneficiary Review'),
      body: Column(
        children: [
          if (_pendingCount > 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  ASHASpacing.gutter, ASHASpacing.stackMD, ASHASpacing.gutter, 0),
              child: Container(
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusLg),
                ),
                padding: const EdgeInsets.all(ASHASpacing.stackMD),
                child: Row(
                  children: [
                    Icon(Icons.mark_email_read_outlined,
                        color: theme.colorScheme.primary),
                    const SizedBox(width: ASHASpacing.stackMD),
                    Expanded(
                      child: Text(
                        '$_pendingCount entries awaiting verification',
                        style: ASHATypography.bodyMD,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: ASHASpacing.gutter, vertical: ASHASpacing.stackSM),
              children: [
                for (final status in const ['all', 'pending', 'approved', 'rejected'])
                  Padding(
                    padding: const EdgeInsets.only(right: ASHASpacing.stackSM),
                    child: FilterChip(
                      label: Text(status.toUpperCase()),
                      selected: _statusFilter == status,
                      onSelected: (_) => setState(() => _statusFilter = status),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? ASHAEmptyState(
                        icon: Icons.inbox_outlined,
                        title: 'Nothing here',
                        message: _statusFilter == 'pending'
                            ? 'All submitted entries have been reviewed.'
                            : 'No entries in this category.',
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(ASHASpacing.gutter),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final item = filtered[index];
                            return _QueueTile(
                              item: item,
                              onTap: () =>
                                  context.push('/verification/${item.id}'),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _QueueTile extends StatelessWidget {
  const _QueueTile({required this.item, required this.onTap});

  final PendingVerificationModel item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      onTap: onTap,
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: theme.colorScheme.primaryContainer,
            child: Text(initials(item.beneficiaryName),
                style: ASHATypography.titleMedium),
          ),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.beneficiaryName, style: ASHATypography.titleMedium),
                const SizedBox(height: 2),
                Text(
                  '${item.categoryLabel} · ${item.submittedBy}',
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  formatDate(item.submittedAt ?? DateTime.now()),
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ASHASpacing.stackSM),
          StatusChip(
            status: statusChipTypeFrom(item.status),
            label: item.status,
            compact: true,
          ),
        ],
      ),
    );
  }
}
