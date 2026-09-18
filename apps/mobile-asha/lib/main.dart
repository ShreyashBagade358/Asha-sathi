import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_shell.dart';
import 'core/config/app_config.dart';
import 'core/l10n/app_strings.dart';
import 'core/navigation/router.dart';
import 'core/offline/background_sync.dart';
import 'core/offline/database.dart';
import 'core/providers/providers.dart';
import 'core/theme/app_theme.dart';
import 'features/notifications/data/notification_service.dart';

/// Handles FCM messages delivered while the app is terminated (cold start in
/// the background isolate). Persists the payload to the local database.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final db = AppDatabase();
  try {
    final data = message.data;
    final notification = message.notification;
    final now = DateTime.now().toIso8601String();
    await db.into(db.notificationsTable).insertOnConflictUpdate(
          NotificationsTableCompanion.insert(
            notificationId: data['id'] as String? ??
                message.messageId ??
                'n-${DateTime.now().millisecondsSinceEpoch}',
            title: notification?.title ?? data['title'] ?? 'Notification',
            body: Value(notification?.body ?? data['body']),
            type: Value(data['type'] as String?),
            createdAt: Value(now),
            actionUrl: Value((data['action_url'] as String?) ??
                (data['actionUrl'] as String?)),
          ),
        );
  } catch (_) {
    // Best-effort persistence in the background isolate.
  } finally {
    await db.close();
  }
}

/// Navigate to a notification deep link, e.g. `immunization?id=<childId>`.
Future<void> navigateToAction(GoRouter router, String actionUrl) async {
  final uri = Uri.tryParse(actionUrl);
  if (uri == null) return;
  final params = <String, String>{};
  uri.queryParameters.forEach((key, value) => params[key] = value);
  try {
    await router.goNamed(uri.path, pathParameters: params);
  } catch (_) {
    router.go('/home');
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );

  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  final container = ProviderContainer();

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const ASHAApp(),
    ),
  );

  // Best-effort FCM + local notification setup.
  container.read(databaseProvider); // keep database alive
  try {
    final notifications = container.read(notificationServiceProvider);
    container.read(routerProvider); // ensure router is constructed early
    notifications.onAction = (actionUrl) =>
        navigateToAction(container.read(routerProvider), actionUrl);
    await notifications.initialize();
  } catch (_) {
    // Notifications are optional at runtime; failures should not block.
  }

  // Offline alerts + periodic background sync are best-effort.
  try {
    await container.read(localAlertEngineProvider).run();
    await registerBackgroundSync();
  } catch (_) {
    // Background sync is optional; failures should not block startup.
  }
}

/// Root application widget wiring theme, locale and router.
class ASHAApp extends ConsumerWidget {
  const ASHAApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: AppStrings.t('app_name'),
      debugShowCheckedModeBanner: false,
      theme: ASHATheme.lightTheme,
      darkTheme: ASHATheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
      supportedLocales: const [
        Locale('en'),
        Locale('hi'),
        Locale('mr'),
        Locale('as'),
        Locale('gu'),
        Locale('ta'),
        Locale('te'),
        Locale('kn'),
        Locale('ml'),
        Locale('bn'),
        Locale('or'),
        Locale('pa'),
      ],
      locale: ref.watch(localeProvider),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}