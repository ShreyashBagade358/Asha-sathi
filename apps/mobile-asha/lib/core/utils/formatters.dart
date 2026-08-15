import 'package:intl/intl.dart';

/// Format a [DateTime] as `dd MMM yyyy` (e.g. 12 Aug 2026).
String formatDate(DateTime? date, {String locale = 'en_IN'}) {
  if (date == null) return '—';
  return DateFormat('dd MMM yyyy', locale).format(date);
}

/// Format a [DateTime] including time `dd MMM yyyy, hh:mm a`.
String formatDateTime(DateTime? date, {String locale = 'en_IN'}) {
  if (date == null) return '—';
  return DateFormat('dd MMM yyyy, hh:mm a', locale).format(date);
}

/// Parse an ISO-8601 string (also tolerant of `yyyy-MM-dd` and
/// `dd-MM-yyyy`).
DateTime? tryParseDate(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

/// Normalise a phone number: strip spaces/dashes and require 10 digits.
String? normalisePhone(String raw) {
  final digits = raw.replaceAll(RegExp(r'[^\d]'), '');
  if (digits.length == 10) return digits;
  if (digits.length == 12 && digits.startsWith('91')) return digits.substring(2);
  if (digits.length == 11 && digits.startsWith('0')) return digits.substring(1);
  return null;
}

/// Whether [phone] is a valid Indian mobile number.
bool isValidIndianPhone(String phone) => normalisePhone(phone) != null;

/// Whether [pincode] is a valid 6-digit Indian postal code.
bool isValidIndianPincode(String pincode) =>
    RegExp(r'^[1-9][0-9]{5}$').hasMatch(pincode.trim());

/// Age expressed as years and months from [dob].
class Age {
  const Age({required this.years, required this.months});

  final int years;
  final int months;

  int get totalMonths => years * 12 + months;

  @override
  String toString() {
    if (years == 0 && months == 0) return 'Newborn';
    if (years == 0) return '$months months';
    if (months == 0) return '$years yrs';
    return '$years yrs $months months';
  }
}

/// Compute age in years + months from [dob] relative to [now].
Age ageFromDob(DateTime? dob, {DateTime? now}) {
  if (dob == null) return const Age(years: 0, months: 0);
  final ref = now ?? DateTime.now();
  var years = ref.year - dob.year;
  var months = ref.month - dob.month;
  if (ref.day < dob.day) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return Age(years: years < 0 ? 0 : years, months: months < 0 ? 0 : months);
}

/// Estimated date of delivery: LMP + 280 days.
DateTime? estimateEDD(DateTime? lmp) {
  if (lmp == null) return null;
  return lmp.add(const Duration(days: 280));
}

/// Gestational age in completed weeks from LMP.
int? gestationalAgeWeeks(DateTime? lmp, {DateTime? now}) {
  if (lmp == null) return null;
  final ref = now ?? DateTime.now();
  final days = ref.difference(lmp).inDays;
  if (days < 0) return 0;
  return (days / 7).floor();
}

/// Compute BMI from weight (kg) and height (cm).
double? bmi(double? weightKg, double? heightCm) {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  final h = heightCm / 100;
  return (weightKg / (h * h)).roundToDouble();
}

/// Capitalise the first letter of each word.
String capitalizeWords(String input) {
  return input
      .split(' ')
      .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
      .join(' ');
}
