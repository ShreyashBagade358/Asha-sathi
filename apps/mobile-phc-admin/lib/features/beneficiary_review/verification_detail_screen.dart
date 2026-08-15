import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'pending_verification_model.dart';
import 'verification_repository.dart';

/// Review one submitted entry: inspect fields, then approve or reject.
class VerificationDetailScreen extends ConsumerStatefulWidget {
  const VerificationDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<VerificationDetailScreen> createState() =>
      _VerificationDetailScreenState();
}

class _VerificationDetailScreenState
    extends ConsumerState<VerificationDetailScreen> {
  PendingVerificationModel? _item;
  bool _loading = true;
  bool _busy = false;
  final _noteController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final item = await ref.read(verificationRepositoryProvider).fetchById(widget.id);
    if (mounted) setState(() {
      _item = item;
      _loading = false;
    });
  }

  Future<void> _submit({required bool approve}) async {
    if (_busy) return;
    setState(() => _busy = true);
    await ref.read(verificationRepositoryProvider).review(
          widget.id,
          approve: approve,
          note: _noteController.text.trim(),
        );
    if (!mounted) return;
    setState(() {
      _busy = false;
      final item = _item;
      if (item != null) {
        _item = item.copyWith(
          status: approve ? 'approved' : 'rejected',
          note: _noteController.text.trim(),
        );
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(approve ? 'Entry approved' : 'Entry rejected')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final item = _item;
    final reviewed = item != null && item.status != 'pending';

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Verification',
        onBack: () => context.pop(),
      ),
      body: _loading || item == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: theme.colorScheme.primaryContainer,
                        child: Text(initials(item.beneficiaryName),
                            style: ASHATypography.headlineLG),
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(item.beneficiaryName, style: ASHATypography.titleLarge),
                      const SizedBox(height: 4),
                      StatusChip(
                        status: statusChipTypeFrom(item.status),
                        label: item.status,
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(
                        'Submitted by ${item.submittedBy}',
                        style: ASHATypography.bodySmall.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      Text(
                        '${item.ashaPhone} · ${formatDate(item.submittedAt ?? DateTime.now())}',
                        style: ASHATypography.bodySmall.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(
                  title: 'Submitted data (${item.categoryLabel})',
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      for (final entry in item.dataEntries.entries)
                        _InfoRow(
                          label: entry.key,
                          value: entry.value.toString(),
                        ),
                    ],
                  ),
                ),
                if (item.note.isNotEmpty) ...[
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHASectionHeader(title: 'Review note'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHACard(
                    child: Row(
                      children: [
                        Icon(
                          item.status == 'approved'
                              ? Icons.check_circle_outline
                              : Icons.cancel_outlined,
                          size: 20,
                          color: item.status == 'approved'
                              ? theme.colorScheme.primary
                              : theme.colorScheme.error,
                        ),
                        const SizedBox(width: ASHASpacing.stackMD),
                        Expanded(child: Text(item.note, style: ASHATypography.bodyMD)),
                      ],
                    ),
                  ),
                ],
                if (!reviewed) ...[
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHASectionHeader(title: 'Decision'),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ASHATextField(
                    hint: 'Optional note for ASHA',
                    controller: _noteController,
                    maxLines: 2,
                  ),
                  const SizedBox(height: ASHASpacing.stackMD),
                  Row(
                    children: [
                      Expanded(
                        child: ASHAButton(
                          label: 'Approve',
                          icon: Icons.check,
                          variant: ASHAButtonVariant.primary,
                          loading: _busy,
                          onPressed: () => _submit(approve: true),
                        ),
                      ),
                      const SizedBox(width: ASHASpacing.stackSM),
                      Expanded(
                        child: ASHAButton(
                          label: 'Reject',
                          icon: Icons.close,
                          variant: ASHAButtonVariant.danger,
                          loading: _busy,
                          onPressed: () => _submit(approve: false),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: ASHATypography.bodySmall.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Text(value, style: ASHATypography.bodyMD, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
