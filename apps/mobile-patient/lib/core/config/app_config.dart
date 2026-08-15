/// Central configuration for the ASHA Sathi Patient mobile app.
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

  /// Fallback ABHA number used when the profile has not been linked yet.
  static const String defaultAbhaNumber = '91-XXXX-XXXX-0000';

  /// Helpline number used by the emergency screens.
  static const String emergencyHelpline = '108';

  /// OTP resend cooldown (seconds) used by the login timer.
  static const int otpResendCooldownSeconds = 30;
}
