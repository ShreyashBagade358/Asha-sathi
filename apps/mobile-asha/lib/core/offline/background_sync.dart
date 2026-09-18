import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:workmanager/workmanager.dart';

import '../providers/providers.dart';

const _taskUniqueName = 'asha-periodic-bg-sync';
const _taskName = 'ashaBgSync';

/// Top-level callback dispatched by [Workmanager] when the OS wakes the app in
/// the background. Runs inside its own isolate with a fresh [ProviderContainer].
@pragma('vm:entry-point')
void syncDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    final container = ProviderContainer();
    try {
      final engine = container.read(syncEngineProvider);
      if (await engine.isOnline) {
        await engine.pushLocalChanges();
        await engine.pullRemoteChanges();
      }
      return true;
    } catch (_) {
      // Swallow background-sync errors; the next scheduled run retries.
      return false;
    } finally {
      container.dispose();
    }
  });
}

/// Register the periodic background synchronisation worker (Android).
///
/// Android minimum periodic frequency is 15 minutes; iOS periodic background
/// execution is handled by the OS and this registration is a no-op there.
Future<void> registerBackgroundSync() async {
  await Workmanager().initialize(syncDispatcher);
  await Workmanager().registerPeriodicTask(
    _taskUniqueName,
    _taskName,
    frequency: const Duration(minutes: 15),
    constraints: Constraints(networkType: NetworkType.connected),
  );
}