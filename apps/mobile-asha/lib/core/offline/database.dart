import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

class HouseholdsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get hhid => text().unique()();
  TextColumn get villageId => text()();
  TextColumn get address => text().nullable()();
  TextColumn get landmark => text().nullable()();
  TextColumn get amenities => text().nullable()();
  BoolColumn get consentGiven => boolean().withDefault(const Constant(false))();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class BeneficiariesTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get beneficiaryId => text().unique()();
  TextColumn get householdId => text().nullable()();
  TextColumn get abhaId => text().nullable()();
  TextColumn get fullName => text()();
  TextColumn get gender => text()();
  TextColumn get dob => text().nullable()();
  TextColumn get phone => text().nullable()();
  TextColumn get maritalStatus => text().nullable()();
  TextColumn get bloodGroup => text().nullable()();
  BoolColumn get isPregnant => boolean().withDefault(const Constant(false))();
  TextColumn get villageId => text().nullable()();
  TextColumn get photoPath => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class PregnanciesTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get pregnancyId => text().unique()();
  TextColumn get beneficiaryId => text()();
  TextColumn get lmp => text().nullable()();
  TextColumn get edd => text().nullable()();
  TextColumn get gravida => int().nullable()();
  TextColumn get para => int().nullable()();
  TextColumn get bloodGroup => text().nullable()();
  TextColumn get status => text().nullable()();
  BoolColumn get highRisk => boolean().withDefault(const Constant(false))();
  TextColumn get highRiskReasons => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ANCVisitsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get ancVisitId => text().unique()();
  TextColumn get pregnancyId => text()();
  TextColumn get beneficiaryId => text()();
  TextColumn get visitDate => text().nullable()();
  TextColumn get gestationalAgeWeeks => int().nullable()();
  TextColumn get weightKg => text().nullable()();
  TextColumn get bpSystolic => int().nullable()();
  TextColumn get bpDiastolic => int().nullable()();
  TextColumn get hemoglobin => text().nullable()();
  TextColumn get fundalHeight => text().nullable()();
  TextColumn get fetalHeartRate => int().nullable()();
  TextColumn get dangerSigns => text().nullable()();
  TextColumn get labResults => text().nullable()();
  TextColumn get referrals => text().nullable()();
  TextColumn get observations => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ChildrenTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get childId => text().unique()();
  TextColumn get beneficiaryId => text().nullable()();
  TextColumn get householdId => text().nullable()();
  TextColumn get fullName => text()();
  TextColumn get gender => text()();
  TextColumn get dob => text().nullable()();
  TextColumn get birthWeight => text().nullable()();
  TextColumn get birthOrder => int().nullable()();
  TextColumn get motherBeneficiaryId => text().nullable()();
  TextColumn get breastfeedingStarted => boolean().withDefault(const Constant(false))();
  TextColumn get immunizationStatus => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ImmunizationsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get immunizationId => text().unique()();
  TextColumn get childId => text()();
  TextColumn get vaccineName => text()();
  TextColumn get dueDate => text().nullable()();
  TextColumn get givenDate => text().nullable()();
  TextColumn get givenAt => text().nullable()();
  TextColumn get batchNumber => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class HBNCVisitsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get visitId => text().unique()();
  TextColumn get childId => text()();
  TextColumn get visitNumber => int().nullable()();
  TextColumn get visitDate => text().nullable()();
  TextColumn get dayOfLife => int().nullable()();
  TextColumn get weightKg => text().nullable()();
  TextColumn get temperature => text().nullable()();
  TextColumn get jaundice => boolean().withDefault(const Constant(false))();
  TextColumn get dangerSigns => text().nullable()();
  TextColumn get referralNeeded => boolean().withDefault(const Constant(false))();
  TextColumn get notes => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class HBYCVisitsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get visitId => text().unique()();
  TextColumn get childId => text()();
  TextColumn get visitNumber => int().nullable()();
  TextColumn get visitDate => text().nullable()();
  TextColumn get ageMonths => int().nullable()();
  TextColumn get complementaryFeedingStarted => boolean().withDefault(const Constant(false))();
  TextColumn get growthMonitoring => boolean().withDefault(const Constant(false))();
  TextColumn get counselingGiven => boolean().withDefault(const Constant(false))();
  TextColumn get referralNeeded => boolean().withDefault(const Constant(false))();
  TextColumn get notes => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class EligibleCouplesTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get ecId => text().unique()();
  TextColumn get husbandName => text()();
  TextColumn get wifeName => text()();
  TextColumn get wifeBeneficiaryId => text().nullable()();
  TextColumn get address => text().nullable()();
  TextColumn get age => int().nullable()();
  TextColumn get childrenCount => int().nullable()();
  TextColumn get contraceptiveMethod => text().nullable()();
  TextColumn get needsFamilyPlanning => boolean().withDefault(const Constant(false))();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ECFollowupsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get followupId => text().unique()();
  TextColumn get ecId => text()();
  TextColumn get followupDate => text().nullable()();
  TextColumn get methodUsed => text().nullable()();
  TextColumn get sideEffects => text().nullable()();
  TextColumn get counselingDone => boolean().withDefault(const Constant(false))();
  TextColumn get missedPeriod => boolean().withDefault(const Constant(false))();
  TextColumn get notes => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class NCDScreeningsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get screeningId => text().unique()();
  TextColumn get beneficiaryId => text()();
  TextColumn get screeningDate => text().nullable()();
  TextColumn get age => int().nullable()();
  TextColumn get bpSystolic => int().nullable()();
  TextColumn get bpDiastolic => int().nullable()();
  TextColumn get bmi => text().nullable()();
  TextColumn get bloodSugar => text().nullable()();
  TextColumn get waistCircumference => text().nullable()();
  TextColumn get riskScore => int().nullable()();
  TextColumn get riskLevel => text().nullable()();
  TextColumn get questionsJson => text().nullable()();
  TextColumn get referralStatus => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class DiseaseCasesTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get caseId => text().unique()();
  TextColumn get beneficiaryId => text().nullable()();
  TextColumn get patientName => text()();
  TextColumn get diseaseType => text()();
  TextColumn get diagnosisDate => text().nullable()();
  TextColumn get symptoms => text().nullable()();
  TextColumn get treatment => text().nullable()();
  TextColumn get treatmentStartDate => text().nullable()();
  TextColumn get dotsProvider => text().nullable()();
  TextColumn get houseNumber => text().nullable()();
  TextColumn get locality => text().nullable()();
  TextColumn get pincode => text().nullable()();
  TextColumn get source => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class DeathReportsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get deathReportId => text().unique()();
  TextColumn get deceasedName => text()();
  TextColumn get deceasedGender => text()();
  TextColumn get deceasedAge => int().nullable()();
  TextColumn get deathDate => text().nullable()();
  TextColumn get deathPlace => text().nullable()();
  TextColumn get causeCategory => text().nullable()();
  TextColumn get causeDescription => text().nullable()();
  BoolColumn get isMaternalDeath => boolean().withDefault(const Constant(false))();
  BoolColumn get isChildDeath => boolean().withDefault(const Constant(false))();
  TextColumn get verbalAutopsyNotes => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ASHATasksTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get taskId => text().unique()();
  TextColumn get taskType => text()();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  TextColumn get dueDate => text().nullable()();
  TextColumn get priority => text().nullable()();
  BoolColumn get isCompleted => boolean().withDefault(const Constant(false))();
  TextColumn get completedAt => text().nullable()();
  TextColumn get completedLatitude => text().nullable()();
  TextColumn get completedLongitude => text().nullable()();
  TextColumn get beneficiaryId => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class IncentiveClaimsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get claimId => text().unique()();
  TextColumn get month => text().nullable()();
  TextColumn get activityCode => text().nullable()();
  TextColumn get activityName => text()();
  TextColumn get quantity => int().nullable()();
  TextColumn get amount => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get generatedFrom => text().nullable()();
  TextColumn get beneficiaryId => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class VillageFormsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get formId => text().unique()();
  TextColumn get formType => text()();
  TextColumn get formDate => text().nullable()();
  TextColumn get villageId => text().nullable()();
  TextColumn get place => text().nullable()();
  TextColumn get attendedBy => text().nullable()();
  TextColumn get dataJson => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ABHARecordsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get abhaId => text().unique()();
  TextColumn get beneficiaryId => text().nullable()();
  TextColumn get abhaNumber => text().nullable()();
  TextColumn get healthId => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get linkingMethod => text().nullable()();
  TextColumn get consentGranted => boolean().withDefault(const Constant(false))();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class NotificationsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get notificationId => text().unique()();
  TextColumn get title => text()();
  TextColumn get body => text().nullable()();
  TextColumn get type => text().nullable()();
  TextColumn get read => boolean().withDefault(const Constant(false))();
  TextColumn get createdAt => text().nullable()();
  TextColumn get actionUrl => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class ReferralsTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get referralId => text().unique()();
  TextColumn get beneficiaryId => text().nullable()();
  TextColumn get referralType => text().nullable()();
  TextColumn get facility => text().nullable()();
  TextColumn get referredOn => text().nullable()();
  TextColumn get reason => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get followUp => text().nullable()();
  TextColumn get createdAt => text().nullable()();
  TextColumn get updatedAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

class SyncQueueTable extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get tableName => text()();
  TextColumn get recordId => text()();
  TextColumn get operation => text()(); // insert | update | delete
  TextColumn get payloadJson => text()();
  // Idempotency key sent to /sync/push. The server replays the stored result
  // for a retried client_request_id instead of applying the change twice.
  TextColumn get clientRequestId => text()();
  // Optimistic-concurrency version of the record this queue row was based on.
  IntColumn get version => int().withDefault(const Constant(1))();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  TextColumn get pendingOperation => text().nullable()(); // synced | conflict
  TextColumn get createdAt => text()();
  TextColumn get updatedAt => text().nullable()();
  TextColumn get error => text().nullable()();
  // Push retry/backoff bookkeeping: attempts made so far and the earliest time
  // this row may be retried (exponential backoff, see SyncEngine).
  IntColumn get attempts => integer().withDefault(const Constant(0))();
  TextColumn get nextRetryAt => text().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/// Local (offline-first) database for ASHA Sathi.
///
/// Drift is configured with `driftDatabase` from `drift_flutter` which picks
/// a sensible native location per platform and enables WAL.
@DriftDatabase(
  tables: [
    HouseholdsTable,
    BeneficiariesTable,
    PregnanciesTable,
    ANCVisitsTable,
    ChildrenTable,
    ImmunizationsTable,
    HBNCVisitsTable,
    HBYCVisitsTable,
    EligibleCouplesTable,
    ECFollowupsTable,
    NCDScreeningsTable,
    DiseaseCasesTable,
    DeathReportsTable,
    ASHATasksTable,
    IncentiveClaimsTable,
    VillageFormsTable,
    ABHARecordsTable,
    NotificationsTable,
    ReferralsTable,
    SyncQueueTable,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(driftDatabase(name: 'asha_sathi'));

  /// Optionally construct with an in-memory database for tests.
  AppDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.addColumn(syncQueueTable, syncQueueTable.clientRequestId);
            await m.addColumn(syncQueueTable, syncQueueTable.version);
            await m.runCustom(
              "UPDATE sync_queue SET client_request_id = "
              "hex(randomblob(16)) WHERE client_request_id IS NULL",
            );
          }
          if (from < 3) {
            await m.addColumn(syncQueueTable, syncQueueTable.attempts);
            await m.addColumn(syncQueueTable, syncQueueTable.nextRetryAt);
          }
        },
      );
}
