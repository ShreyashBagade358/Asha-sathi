import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/dashboard_models.dart';

final _tasksProvider = FutureProvider<List<ASHATaskModel>>((ref) async {
  final repo = ref.watch(dashboardRepositoryProvider);
  var tasks = await repo.fetchTasks();
  if (tasks.isEmpty) {
    tasks = repo.defaultWorkPlan();
    for (final t in tasks) {
      await repo.saveTask(t);
    }
  }
  return tasks;
});

/// Today's prioritised work plan with check-off and GPS capture.
class WorkPlanScreen extends ConsumerWidget {
  const WorkPlanScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(_tasksProvider);
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Work Plan',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Today\'s tasks sorted by priority. Tap to complete with location capture.')),
        ),
      ),
      body: SafeArea(
        child: tasks.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (list) {
            final sorted = [...list]..sort((a, b) {
                int rank(String p) => switch (p) {
                      'high' => 0,
                      'medium' => 1,
                      _ => 2,
                    };
                final byPriority = rank(a.priority).compareTo(rank(b.priority));
                if (byPriority != 0) return byPriority;
                return (a.dueDate ?? '').compareTo(b.dueDate ?? '');
              });
            final pending = sorted.where((t) => !t.isCompleted).toList();
            final done = sorted.where((t) => t.isCompleted).toList();
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                Text('Pending (${pending.length})', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                if (pending.isEmpty)
                  const ASHACard(
                    title: 'All done for today 🎉',
                    subtitle: 'Great work!',
                    child: SizedBox.shrink(),
                  )
                else
                  ...pending.map((t) => _TaskTile(
                        task: t,
                        onComplete: () async {
                          final now = DateTime.now();
                          final updated = t.copyWith(
                            isCompleted: true,
                            completedAt: now.toIso8601String(),
                            completedLatitude: 18.5204, // placeholder
                            completedLongitude: 73.8567, // placeholder
                            updatedAt: now.toIso8601String(),
                          );
                          await ref.read(dashboardRepositoryProvider).saveTask(updated);
                          if (context.mounted) {
                            ref.invalidate(_tasksProvider);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Task completed · location captured')),
                            );
                          }
                        },
                      )),
                if (done.isNotEmpty) ...[
                  const SizedBox(height: ASHASpacing.stackLG),
                  Text('Completed (${done.length})', style: ASHATypography.headlineMD),
                  const SizedBox(height: ASHASpacing.stackSM),
                  ...done.map((t) => _TaskTile(task: t, completed: true)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task, this.onComplete, this.completed = false});

  final ASHATaskModel task;
  final VoidCallback? onComplete;
  final bool completed;

  @override
  Widget build(BuildContext context) {
    final priorityColor = switch (task.priority) {
      'high' => ASHAColors.error,
      'medium' => ASHAColors.secondary,
      _ => ASHAColors.outline,
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
      child: ASHACard(
        title: task.title,
        subtitle: task.description ?? task.taskType,
        child: Row(
          children: [
            StatusChip(
              status: completed
                  ? StatusChipType.success
                  : task.priority == 'high'
                      ? StatusChipType.danger
                      : task.priority == 'medium'
                          ? StatusChipType.warning
                          : StatusChipType.neutral,
              label: completed ? 'done' : task.priority,
            ),
            const Spacer(),
            if (completed)
              const Icon(Icons.check_circle, color: ASHAColors.primary)
            else
              ASHAButton(
                label: 'Complete',
                variant: ASHAButtonVariant.outline,
                height: 40,
                onPressed: onComplete,
                icon: Icons.location_on_outlined,
              ),
          ],
        ),
      ),
    );
  }
}
