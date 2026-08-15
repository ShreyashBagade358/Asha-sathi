import 'package:flutter/widgets.dart';

/// A single supported language descriptor.
class LocalizedLanguage {
  const LocalizedLanguage({
    required this.code,
    required this.name,
    required this.nameNative,
  });

  /// Locale code, e.g. 'en', 'hi'.
  final String code;

  /// English display name, e.g. 'English'.
  final String name;

  /// Native display name, e.g. 'हिन्दी'.
  final String nameNative;

  Locale get locale => Locale(code);

  String get flag => _flagFor(code);

  static String _flagFor(String code) {
    switch (code) {
      case 'hi':
        return '🇮🇳';
      case 'mr':
        return '🇮🇳';
      case 'as':
        return '🇮🇳';
      case 'gu':
        return '🇮🇳';
      case 'ta':
        return '🇮🇳';
      case 'te':
        return '🇮🇳';
      case 'kn':
        return '🇮🇳';
      case 'ml':
        return '🇮🇳';
      case 'bn':
        return '🇮🇳';
      case 'or':
        return '🇮🇳';
      case 'pa':
        return '🇮🇳';
      default:
        return '🌐';
    }
  }
}

/// Languages supported by ASHA Sathi across the 12 scheduled/associate
/// languages of the target states plus English.
const List<LocalizedLanguage> supportedLanguages = [
  LocalizedLanguage(code: 'en', name: 'English', nameNative: 'English'),
  LocalizedLanguage(code: 'hi', name: 'Hindi', nameNative: 'हिन्दी'),
  LocalizedLanguage(code: 'mr', name: 'Marathi', nameNative: 'मराठी'),
  LocalizedLanguage(code: 'as', name: 'Assamese', nameNative: 'অসমীয়া'),
  LocalizedLanguage(code: 'gu', name: 'Gujarati', nameNative: 'ગુજરાતી'),
  LocalizedLanguage(code: 'ta', name: 'Tamil', nameNative: 'தமிழ்'),
  LocalizedLanguage(code: 'te', name: 'Telugu', nameNative: 'తెలుగు'),
  LocalizedLanguage(code: 'kn', name: 'Kannada', nameNative: 'ಕನ್ನಡ'),
  LocalizedLanguage(code: 'ml', name: 'Malayalam', nameNative: 'മലയാളം'),
  LocalizedLanguage(code: 'bn', name: 'Bengali', nameNative: 'বাংলা'),
  LocalizedLanguage(code: 'or', name: 'Odia', nameNative: 'ଓଡ଼ିଆ'),
  LocalizedLanguage(code: 'pa', name: 'Punjabi', nameNative: 'ਪੰਜਾਬੀ'),
];

/// Resolve a [LocalizedLanguage] from a locale code (falls back to 'en').
LocalizedLanguage languageForCode(String code) {
  for (final l in supportedLanguages) {
    if (l.code == code) return l;
  }
  return supportedLanguages.first;
}
