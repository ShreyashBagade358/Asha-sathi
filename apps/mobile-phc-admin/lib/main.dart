import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config/app_config.dart';
import 'core/navigation/router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _initSupabase();
  runApp(const ProviderScope(child: AshaPhcAdminApp()));
}

Future<void> _initSupabase() async {
  try {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    );
  } catch (_) {
    // Placeholder credentials / no network - the app falls back to the REST
    // API and offline demo data, so startup never fails.
  }
}

class AshaPhcAdminApp extends ConsumerWidget {
  const AshaPhcAdminApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'ASHA Sathi PHC Admin',
      debugShowCheckedModeBanner: false,
      theme: ASHATheme.lightTheme,
      darkTheme: ASHATheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: router,
    );
  }
}
