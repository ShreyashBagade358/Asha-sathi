import 'package:freezed_annotation/freezed_annotation.dart';

part 'sync_status_model.freezed.dart';
part 'sync_status_model.g.dart';

/// Aggregated synchronisation status shown on the sync screen.
///
/// [pending] is the number of queued local mutations not yet uploaded,
/// [lastSyncedAt] tracks the most recent successful sync, and [conflicts]
/// lists record ids that could not be resolved automatically.
@freezed
abstract class SyncStatusModel with _$SyncStatusModel {
  const factory SyncStatusModel({
    @Default(false) bool isSyncing,
    @Default(0) int pending,
    @Default(0) int synced,
    @Default(false) bool isOnline,
    DateTime? lastSyncedAt,
    String? lastError,
    @Default(<String>[]) List<String> conflicts,
  }) = _SyncStatusModel;

  factory SyncStatusModel.fromJson(Map<String, dynamic> json) =>
      _$SyncStatusModelFromJson(json);
}
