import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/offline/sync_engine.dart';
import '../../../core/providers/providers.dart';
import 'sync_status_model.dart';

/// Notifies listeners whenever the sync state changes.
class SyncStatusNotifier extends AsyncNotifier<SyncStatusModel> {
  StreamSubscription<bool>? _connectivitySub;
  Timer? _pollTimer;

  @override
  Future<SyncStatusModel> build() async {
    final engine = ref.watch(syncEngineProvider);
    // Re-sync whenever connectivity returns.
    _connectivitySub ??= engine.watchConnectivity().listen((online) {
      if (online) syncNow();
    });
    // Periodic background sync every AppConfig.syncIntervalSeconds.
    _pollTimer ??= Timer.periodic(
      Duration(seconds: AppConfig.syncIntervalSeconds),
      (_) => syncNow(silent: true),
    );
    ref.onDispose(() {
      _connectivitySub?.cancel();
      _pollTimer?.cancel();
    });
    return _snapshot(engine);
  }

  Future<SyncStatusModel> _snapshot(SyncEngine engine) async {
    final pending = await engine.pendingCount();
    final lastSyncedAt = await engine.lastSyncTime();
    final isOnline = await engine.isOnline;
    return SyncStatusModel(
      isSyncing: false,
      pending: pending,
      isOnline: isOnline,
      lastSyncedAt: lastSyncedAt,
    );
  }

  /// Trigger an immediate push + pull cycle. When [silent] is true failures are
  /// captured in the state instead of rethrown.
  Future<void> syncNow({bool silent = false}) async {
    final engine = ref.read(syncEngineProvider);
    state = AsyncData(
      (state.valueOrNull ?? const SyncStatusModel()).copyWith(
        isSyncing: true,
        lastError: null,
      ),
    );
    try {
      final pushed = await engine.pushLocalChanges();
      final pulled = await engine.pullRemoteChanges();
      state = AsyncData(
        (await _snapshot(engine)).copyWith(
          isSyncing: false,
          synced: pushed + pulled,
          lastSyncedAt: DateTime.now(),
        ),
      );
    } catch (e) {
      state = AsyncData(
        (await _snapshot(engine)).copyWith(
          isSyncing: false,
          lastError: e is SyncOfflineException ? e.toString() : e.toString(),
        ),
      );
      if (!silent) rethrow;
    }
  }
}

/// Global auto-sync provider.
final syncStatusProvider =
    AsyncNotifierProvider<SyncStatusNotifier, SyncStatusModel>(
        SyncStatusNotifier.new);
