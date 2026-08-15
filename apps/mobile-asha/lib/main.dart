import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_shell.dart';
import 'core/config/app_config.dart';
import 'core/l10n/app_strings.dart';
import 'core/navigation/router.dart';
import 'core/providers/providers.dart';
import 'core/theme/app_theme.dart';
import 'features/notifications/data/notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );

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
    await container
        .read(notificationServiceProvider)
        .initialize();
  } catch (_) {
    // Notifications are optional at runtime; failures should not block.
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
