/// Simple validation helpers used by form screens.
library;

import 'package:asha_design_system/asha_design_system.dart';

/// Returns an error string when [value] is null/empty, else null.
String? Function(String?) nonEmpty(String message) {
  return (value) => (value == null || value.trim().isEmpty) ? message : null;
}

/// Validates a 10-digit Indian mobile number.
String? Function(String?) phone(String message) {
  return (value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return message;
    if (!RegExp(r'^\d{10}$').hasMatch(v)) {
      return 'Enter a valid 10-digit mobile number';
    }
    return null;
  };
}

/// Validates a 6-digit Indian postal code.
String? Function(String?) pincode([String message = 'Enter a valid pincode']) {
  return (value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return null;
    if (!RegExp(r'^[1-9][0-9]{5}$').hasMatch(v)) return message;
    return null;
  };
}

/// Returns an error if [date] is null, or not after [minDate].
String? Function(DateTime?) dateAfter(
  DateTime minDate, {
  String message = 'Date must be after',
}) {
  return (date) {
    if (date == null) return 'This field is required';
    if (!date.isAfter(minDate)) return message;
    return null;
  };
}

/// Returns an error if [date] is null or in the future.
String? Function(DateTime?) dateNotInFuture(
    [String message = 'Date cannot be in the future']) {
  return (date) {
    if (date == null) return 'This field is required';
    if (date.isAfter(DateTime.now())) return message;
    return null;
  };
}

/// Generic required validator for non-text values.
String? Function(T?) required<T>(String message) {
  return (value) => value == null ? message : null;
}

/// Validates that [value] has at least [min] characters.
String? Function(String?) minLength(int min, String message) {
  return (value) {
    if (value == null || value.trim().length < min) return message;
    return null;
  };
}
