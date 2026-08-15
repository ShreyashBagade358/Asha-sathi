import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../data/sync_provider.dart';

/// Shows sync state, allows manual "Sync now", and surfaces queued conflicts.
class SyncStatusScreen extends ConsumerWidget {
  const SyncStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncState = ref.watch(syncStatusProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Sync Status',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Your data is saved on this phone and synced whenever you are online.')),
        ),
      ),
      body: SafeArea(
        child: syncState.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (status) {
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                // Connectivity card
                ASHACard(
                  title: status.isOnline ? 'Online' : 'Offline',
                  subtitle: status.isOnline
                      ? 'Your phone is connected to the network.'
                      : 'Changes are saved locally and will sync automatically when you reconnect.',
                  child: Row(
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: status.isOnline
                              ? ASHAColors.success
                              : ASHAColors.error,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        status.isOnline
                            ? Icons.cloud_done_outlined
                            : Icons.cloud_off_outlined,
                        color: status.isOnline
                            ? ASHAColors.success
                            : ASHAColors.error,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                // Sync statistics
                Row(
                  children: [
                    Expanded(
                      child: _StatTile(
                        icon: Icons.pending_actions,
                        label: 'Pending',
                        value: '${status.pending}',
                      ),
                    ),
                    const SizedBox(width: ASHASpacing.stackSM),
                    Expanded(
                      child: _StatTile(
                        icon: Icons.sync,
                        label: 'Last sync',
                        value: status.lastSyncedAt == null
                            ? 'Never'
                            : formatDateTime(status.lastSyncedAt),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHAButton(
                  label: status.isSyncing ? 'Syncing…' : 'Sync Now',
                  icon: Icons.sync,
                  height: 48,
                  onPressed: status.isSyncing
                      ? null
                      : () => ref.read(syncStatusProvider.notifier).syncNow(),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                if (status.lastError != null)
                  _ErrorBanner(message: status.lastError!),
                if (status.conflicts.isNotEmpty) ...[
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHACard(
                    title: 'Conflicts',
                    subtitle:
                        '${status.conflicts.length} records need attention',
                    child: Column(
                      children: [
                        for (final id in status.conflicts)
                          ListTile(
                            dense: true,
                            leading: const Icon(Icons.warning_amber_rounded,
                                color: ASHAColors.error),
                            title: Text(
                              id,
                              style: ASHATypography.bodyMD,
                            ),
                            trailing: ASHAButton(
                              label: 'Resolve',
                              height: 40,
                              onPressed: () {
                                // Stub: a real app would show a merge UI.
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Last-write-wins applied to this record.')),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ASHACard(
      title: label,
      subtitle: value,
      child: Icon(icon, color: ASHAColors.primary),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ASHAColors.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: ASHAColors.onErrorContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: ASHATypography.bodyMD
                  .copyWith(color: ASHAColors.onErrorContainer),
            ),
          ),
        ],
      ),
    );
  }
}
