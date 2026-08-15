/// Central configuration for the PHC Admin mobile app.
///
/// Values can be overridden at build time with `--dart-define`, e.g.
/// `flutter run --dart-define=API_BASE_URL=https://api.example.com/v1`.
class AppConfig {
  AppConfig._();

  /// Base URL for the ASHA Sathi backend REST API.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  /// Supabase project URL (realtime + auth fallback).
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://your-project.supabase.co',
  );

  /// Supabase anon key.
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'your-anon-key',
  );

  /// App version surfaced on the "More" screen.
  static const String appVersion = '1.0.0';

  /// Default facility id used when the backend is unreachable.
  static const String defaultFacilityId = 'phc-bhagalpur-01';

  /// Default facility name shown in headers / mock data.
  static const String defaultFacilityName = 'Bhagalpur PHC';

  /// OTP resend cooldown (seconds) used by the login timer.
  static const int otpResendCooldownSeconds = 30;
}
