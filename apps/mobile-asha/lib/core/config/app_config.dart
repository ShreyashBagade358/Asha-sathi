/// Central application configuration.
///
/// Values may be overridden at build time with --dart-define flags, e.g.
/// `flutter run --dart-define=API_BASE_URL=https://api.example.com/v1`
class AppConfig {
  AppConfig._();

  /// Base URL for the ASHA Sathi backend REST API.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  /// Supabase project URL (used for realtime + auth fallback).
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://your-project.supabase.co',
  );

  /// Supabase anon key.
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'your-anon-key',
  );

  /// App version surfaced on the settings / about screen.
  static const String appVersion = '1.0.0';

  /// Synchronisation: how often (seconds) the auto-sync provider re-checks.
  static const int syncIntervalSeconds = 60;

  /// OTP expiry window in seconds used by the auth UI timer.
  static const int otpResendCooldownSeconds = 30;
}
