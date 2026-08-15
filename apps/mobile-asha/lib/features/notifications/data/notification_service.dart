import 'package:drift/drift.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/offline/database.dart';
import '../../../core/providers/providers.dart';
import 'notification_model.dart';

/// Local notifications plugin used to surface FCM payloads while the app is
/// in the foreground.
final _localNotifications = FlutterLocalNotificationsPlugin();

/// Persists and reads notifications from the local Drift database and wires
/// up Firebase Cloud Messaging.
class NotificationService {
  NotificationService(this._db);

  final AppDatabase _db;

  /// Initialise FCM + local notification channels and start handling
  /// foreground/background payloads. Should be called once from [main].
  Future<void> initialize({
    void Function(AppNotificationModel)? onForegroundTap,
  }) async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (details) {
        final id = details.payload;
        if (id != null && id.isNotEmpty) {
          onForegroundTap?.call(AppNotificationModel(notificationId: id));
        }
      },
    );

    final fcm = FirebaseMessaging.instance;
    await fcm.requestPermission();
    final token = await fcm.getToken();
    // In production the token is sent to the backend for targeted pushes.
    if (token != null) {
      // ignore: avoid_print
      print('FCM token: $token');
    }

    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final model = _fromRemote(message);
      if (model != null) {
        save(model);
        _showLocal(model);
      }
    });

    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      final model = _fromRemote(message);
      if (model != null) onForegroundTap?.call(model);
    });
  }

  AppNotificationModel? _fromRemote(RemoteMessage message) {
    final data = message.data;
    final notification = message.notification;
    return AppNotificationModel(
      notificationId: data['id'] as String? ??
          message.messageId ??
          'n-${DateTime.now().millisecondsSinceEpoch}',
      title: notification?.title ?? data['title'] ?? 'Notification',
      body: notification?.body ?? data['body'] ?? '',
      type: data['type'] as String? ?? 'system',
      createdAt: DateTime.now().toIso8601String(),
      actionUrl: data['action_url'] as String?,
    );
  }

  Future<void> _showLocal(AppNotificationModel model) async {
    const android = AndroidNotificationDetails(
      'asha_alerts',
      'ASHA Alerts',
      channelDescription: 'Reminders and alerts for ASHA workers',
      importance: Importance.high,
      priority: Priority.high,
    );
    const ios = DarwinNotificationDetails();
    await _localNotifications.show(
      model.notificationId.hashCode,
      model.title,
      model.body,
      const NotificationDetails(android: android, iOS: ios),
      payload: model.notificationId,
    );
  }

  /// Persist an incoming notification locally.
  Future<void> save(AppNotificationModel model) async {
    await _db.into(_db.notificationsTable).insertOnConflictUpdate(
          NotificationsTableCompanion.insert(
            notificationId: Value(model.notificationId),
            title: Value(model.title),
            body: Value(model.body),
            type: Value(model.type),
            read: Value(model.read),
            createdAt: Value(model.createdAt),
            actionUrl: Value(model.actionUrl),
          ),
        );
  }

  Future<List<AppNotificationModel>> watchAll() async {
    final rows = await (_db.select(_db.notificationsTable)
          ..orderBy(
            (t) => OrderingTerm.desc(t.createdAt),
          ))
        .get();
    return rows.map(fromRow).toList();
  }

  Future<int> unreadCount() async {
    final rows = await (_db.select(_db.notificationsTable)
          ..where((t) => t.read.equals(false)))
        .get();
    return rows.length;
  }

  Future<void> markRead(String notificationId) async {
    await (_db.update(_db.notificationsTable)
          ..where((t) => t.notificationId.equals(notificationId)))
        .write(const NotificationsTableCompanion(read: Value(true)));
  }

  /// Convert a drift row into the model.
  AppNotificationModel fromRow(NotificationRow row) => AppNotificationModel(
        notificationId: row.notificationId,
        title: row.title,
        body: row.body ?? '',
        type: row.type ?? 'system',
        read: row.read,
        createdAt: row.createdAt,
        actionUrl: row.actionUrl,
      );
}

/// Riverpod provider for [NotificationService].
final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(ref.watch(databaseProvider));
});
