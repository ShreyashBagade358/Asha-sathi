import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/utils/formatters.dart';
import '../data/notification_model.dart';
import '../data/notification_service.dart';

/// Inbox of push / in-app notifications.
class NotificationListScreen extends ConsumerWidget {
  const NotificationListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(
      notificationListProvider,
    );
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Notifications',
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Reminders, alerts and updates from your block.')),
        ),
      ),
      body: SafeArea(
        child: notifications.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (items) {
            if (items.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.notifications_off_outlined,
                        size: 48, color: ASHAColors.outline),
                    const SizedBox(height: 16),
                    Text('No notifications yet',
                        style: ASHATypography.labelLG),
                    const SizedBox(height: 4),
                    Text(
                      'Alerts will appear here.',
                      style: ASHATypography.bodyMD
                          .copyWith(color: ASHAColors.onSurfaceVariant),
                    ),
                  ],
                ),
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final n = items[i];
                final unread = !n.read;
                return Padding(
                  padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                  child: ASHACard(
                    onTap: () {
                      ref
                          .read(notificationServiceProvider)
                          .markRead(n.notificationId);
                      context.pushNamed(
                        AppRoutes.notificationDetail,
                        pathParameters: {'id': n.notificationId},
                      );
                    },
                    title: n.title,
                    subtitle: formatDateTime(tryParseDate(n.createdAt)),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: _typeColor(n.type),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(_typeIcon(n.type),
                              size: 22, color: ASHAColors.onPrimaryContainer),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            n.body,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: ASHATypography.bodyMD.copyWith(
                              fontWeight: unread
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                        if (unread)
                          Container(
                            width: 10,
                            height: 10,
                            margin: const EdgeInsets.only(left: 8),
                            decoration: const BoxDecoration(
                              color: ASHAColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'reminder':
        return ASHAColors.secondaryContainer;
      case 'alert':
        return ASHAColors.errorContainer;
      case 'campaign':
        return ASHAColors.tertiaryContainer;
      case 'training':
        return ASHAColors.primaryContainer;
      default:
        return ASHAColors.surfaceContainer;
    }
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'reminder':
        return Icons.alarm;
      case 'alert':
        return Icons.warning_amber_rounded;
      case 'campaign':
        return Icons.campaign;
      case 'training':
        return Icons.school;
      default:
        return Icons.notifications;
    }
  }
}

/// Watches the local inbox.
final notificationListProvider =
    FutureProvider<List<AppNotificationModel>>((ref) async {
  return ref.watch(notificationServiceProvider).watchAll();
});
