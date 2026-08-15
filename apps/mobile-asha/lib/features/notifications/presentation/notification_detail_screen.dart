import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/utils/formatters.dart';
import '../data/notification_model.dart';
import '../data/notification_service.dart';

/// Full view of a single notification with an optional deep-link action.
class NotificationDetailScreen extends ConsumerStatefulWidget {
  const NotificationDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<NotificationDetailScreen> createState() =>
      _NotificationDetailScreenState();
}

class _NotificationDetailScreenState
    extends ConsumerState<NotificationDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Auto-mark read on open.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(notificationServiceProvider).markRead(widget.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final notification = ref.watch(
      notificationByIdProvider(widget.id),
    );
    return Scaffold(
      appBar: ASHATopAppBar(title: 'Notification'),
      body: SafeArea(
        child: notification.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (n) {
            if (n == null) {
              return Center(
                child:                 Text('Notification not found',
                    style: ASHATypography.labelLG),
              );
            }
            final actionUrl = n.actionUrl;
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: ASHAColors.primaryContainer,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.notifications,
                              color: ASHAColors.primary, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              n.title,
                              style: ASHATypography.headlineMD,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        formatDateTime(tryParseDate(n.createdAt)),
                        style: ASHATypography.labelMD.copyWith(
                          color: ASHAColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                Text(
                  n.body,
                  style: ASHATypography.bodyLG.copyWith(height: 1.5),
                ),
                const SizedBox(height: ASHASpacing.stackXL),
                if (actionUrl != null)
                  ASHAButton(
                    label: 'Open related screen',
                    icon: Icons.arrow_forward,
                    height: 48,
                    onPressed: () {
                      final route = actionUrl.startsWith('/')
                          ? actionUrl.substring(1)
                          : actionUrl;
                      context.pushNamed(route);
                    },
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Reads a single notification from the local inbox.
final notificationByIdProvider =
    FutureProvider.family<AppNotificationModel?, String>((ref, id) async {
  final all = await ref.watch(notificationServiceProvider).watchAll();
  for (final n in all) {
    if (n.notificationId == id) return n;
  }
  return null;
});
