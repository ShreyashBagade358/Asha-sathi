import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'reminder_model.dart';
import 'reminders_repository.dart';

/// Medication / visit reminders with mark-done actions.
class RemindersScreen extends ConsumerStatefulWidget {
  const RemindersScreen({super.key});

  @override
  ConsumerState<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends ConsumerState<RemindersScreen> {
  List<ReminderModel> _reminders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final reminders = await ref.read(remindersRepositoryProvider).fetchReminders();
    if (mounted) setState(() {
      _reminders = reminders;
      _loading = false;
    });
  }

  Future<void> _markDone(ReminderModel reminder) async {
    await ref.read(remindersRepositoryProvider).markDone(reminder.id);
    if (!mounted) return;
    setState(() {
      final index = _reminders.indexWhere((r) => r.id == reminder.id);
      if (index != -1) {
        _reminders = [..._reminders]
          ..[index] = reminder.copyWith(status: 'done');
      }
    });
  }

  Future<void> _delete(ReminderModel reminder) async {
    await ref.read(remindersRepositoryProvider).delete(reminder.id);
    if (!mounted) return;
    setState(() => _reminders.removeWhere((r) => r.id == reminder.id));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sorted = [..._reminders]..sort((a, b) {
        final dueRank = a.status == 'due' ? 0 : (a.status == 'done' ? 2 : 1);
        final dueRankB = b.status == 'due' ? 0 : (b.status == 'done' ? 2 : 1);
        return dueRank.compareTo(dueRankB);
      });

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Reminders',
        actions: [
          IconButton(
            icon: const Icon(Icons.add_alarm_outlined),
            tooltip: 'Add reminder',
            onPressed: () => context.push('/reminders/new'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/reminders/new'),
        icon: const Icon(Icons.add_alarm_outlined),
        label: const Text('Add Reminder'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: sorted.isEmpty
                  ? ASHAEmptyState(
                      icon: Icons.alarm_off_outlined,
                      title: 'No reminders',
                      message: 'Add a reminder for medications, visits or vaccinations.',
                      actionLabel: 'Add reminder',
                      onAction: () => context.push('/reminders/new'),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(ASHASpacing.gutter),
                      itemCount: sorted.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final reminder = sorted[index];
                        return _ReminderTile(
                          reminder: reminder,
                          onTap: () => _markDone(reminder),
                          onDelete: () => _delete(reminder),
                        );
                      },
                    ),
            ),
    );
  }
}

class _ReminderTile extends StatelessWidget {
  const _ReminderTile({
    required this.reminder,
    required this.onTap,
    required this.onDelete,
  });

  final ReminderModel reminder;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final done = reminder.status == 'done';
    final icon = switch (reminder.type) {
      'medication' => Icons.medication_outlined,
      'visit' => Icons.event_note_outlined,
      'vaccination' => Icons.vaccines_outlined,
      'screening' => Icons.monitor_heart_outlined,
      _ => Icons.alarm_outlined,
    };

    return ASHACard(
      onTap: onTap,
      child: Opacity(
        opacity: done ? 0.6 : 1,
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
              ),
              child: Icon(icon, color: theme.colorScheme.primary),
            ),
            const SizedBox(width: ASHASpacing.stackMD),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reminder.title,
                    style: ASHATypography.titleMedium.copyWith(
                      decoration: done ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    reminder.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ASHATypography.bodySmall.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    reminder.status == 'due'
                        ? 'Due now'
                        : '${reminder.frequencyLabel} · ${_formatDue(reminder.dueAt)}',
                    style: ASHATypography.labelMD.copyWith(
                      color: reminder.status == 'due'
                          ? theme.colorScheme.error
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: ASHASpacing.stackSM),
            if (done)
              Icon(Icons.check_circle, color: theme.colorScheme.primary)
            else
              IconButton(
                icon: const Icon(Icons.delete_outline),
                tooltip: 'Delete',
                onPressed: onDelete,
              ),
          ],
        ),
      ),
    );
  }

  String _formatDue(DateTime? date) {
    if (date == null) return '';
    return DateFormat('dd MMM').format(date);
  }
}
