import 'package:drift/drift.dart';

import 'database.dart';

/// Generates health alerts from the local Drift database so ASHA workers still
/// see due immunizations / high-risk pregnancies / missed follow-ups while
/// offline. Mirrors the server-side alert generators and dedupes by a stable
/// key kept in the [NotificationsTable].
class LocalAlertEngine {
  LocalAlertEngine(this._db);

  final AppDatabase _db;

  static const _windowDays = 7;

  /// Scan local data and insert any new missing alerts. Returns the number of
  /// alerts created (already-existing alerts are skipped).
  Future<int> run() async {
    var created = 0;
    created += await _vaccinationDue();
    created += await _highRiskPregnancies();
    created += await _missedFollowups();
    return created;
  }

  Future<int> _vaccinationDue() async {
    final now = DateTime.now();
    final rows = await _db.select(_db.immunizationsTable).get();
    final cut = now.add(const Duration(days: _windowDays));
    var created = 0;
    for (final im in rows) {
      if (im.givenDate != null && im.givenDate!.isNotEmpty) continue;
      final due = DateTime.tryParse(im.dueDate ?? '');
      if (due == null || due.isAfter(cut)) continue;
      final overdue = due.isBefore(now);
      final vaccine = im.vaccineName ?? 'Vaccination';
      created += await _insertIfNew(
        'local:vacc:${im.childId}:${im.vaccineName}',
        title: '$vaccine ${overdue ? 'overdue' : 'due'}',
        body: '$vaccine for child ${im.childId} '
            '${overdue ? 'was' : 'is'} due ${_fmt(due)}.',
        type: 'alert',
        actionUrl: 'immunization?id=${im.childId}',
      );
    }
    return created;
  }

  Future<int> _highRiskPregnancies() async {
    final rows = (await _db.select(_db.pregnanciesTable).get())
        .where((p) => p.highRisk)
        .toList();
    var created = 0;
    for (final pregnancy in rows) {
      created += await _insertIfNew(
        'local:hrp:${pregnancy.pregnancyId}',
        title: 'High-risk pregnancy follow-up',
        body:
            'High-risk pregnancy (${pregnancy.beneficiaryId}) needs an ANC follow-up.',
        type: 'alert',
        actionUrl: 'beneficiary-detail?id=${pregnancy.beneficiaryId}',
      );
    }
    return created;
  }

  Future<int> _missedFollowups() async {
    final now = DateTime.now();
    final rows = await _db.select(_db.referralsTable).get();
    var created = 0;
    for (final referral in rows) {
      final followUp = referral.followUp;
      if (followUp == null || followUp.isEmpty) continue;
      final due = DateTime.tryParse(followUp);
      if (due == null || due.isAfter(now)) continue;
      created += await _insertIfNew(
        'local:followup:${referral.referralId}',
        title: 'Missed follow-up',
        body:
            '${referral.referralType ?? 'Referral'} follow-up was due ${_fmt(due)}.',
        type: 'alert',
        actionUrl: (referral.beneficiaryId != null &&
                referral.beneficiaryId!.isNotEmpty)
            ? 'beneficiary-detail?id=${referral.beneficiaryId}'
            : 'dashboard',
      );
    }
    return created;
  }

  Future<int> _insertIfNew(
    String key, {
    required String title,
    required String body,
    required String type,
    String? actionUrl,
  }) async {
    final existing = await (_db.select(_db.notificationsTable)
          ..where((t) => t.notificationId.equals(key)))
        .get();
    if (existing.isNotEmpty) return 0;
    await _db.into(_db.notificationsTable).insert(
          NotificationsTableCompanion.insert(
            notificationId: key,
            title: title,
            body: Value(body),
            type: Value(type),
            createdAt: Value(DateTime.now().toIso8601String()),
            actionUrl: Value(actionUrl),
          ),
        );
    return 1;
  }

  static String _fmt(DateTime d) => d.toIso8601String().split('T').first;
}