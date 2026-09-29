import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clearConflict, getConflicts } from '../../src/db/database';
import { getServerStatus, getSyncSnapshot } from '../../src/sync/engine';
import { subscribeOnline, subscribeSync, syncNow } from '../../src/sync/network';
import type { SyncStatusResponse } from '../../src/types';

interface ConflictRow {
  clientRequestId: string;
  entity: string;
  recordId: string;
  reason: string | null;
  createdAt: string;
}

export default function SyncStatusScreen() {
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [server, setServer] = useState<SyncStatusResponse | null>(null);

  const load = useCallback(async () => {
    const snapshot = await getSyncSnapshot();
    setCounts(snapshot.counts);
    setLastSyncAt(snapshot.lastSyncAt);
    const rows = await getConflicts();
    setConflicts(
      rows.map((row) => ({
        clientRequestId: row.clientRequestId,
        entity: row.entity,
        recordId: row.recordId,
        reason: row.reason,
        createdAt: row.createdAt,
      })),
    );
    setServer(await getServerStatus());
  }, []);

  useEffect(() => {
    void load();
    const offOnline = subscribeOnline(setOnline);
    const offSync = subscribeSync((_result, busy) => {
      setSyncing(busy);
      if (!busy) void load();
    });
    return () => {
      offOnline();
      offSync();
    };
  }, [load]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: online ? '#22C55E' : '#EF4444' }]} />
        <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
      </View>

      <Pressable
        style={[styles.button, syncing && styles.buttonDisabled]}
        onPress={() => void syncNow()}
        disabled={syncing}
        testID="sync-now-button"
      >
        <Text style={styles.buttonText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>On this device</Text>
        <Row label="Pending" value={String(counts.pending ?? 0)} />
        <Row label="Failed" value={String(counts.failed ?? 0)} />
        <Row label="In progress" value={String(counts.syncing ?? 0)} />
        <Row
          label="Last sync"
          value={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
        />
      </View>

      {server ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>On the server</Text>
          <Row label="Pending push" value={String(server.pending_push)} />
          <Row label="Pending pull" value={String(server.pending_pull)} />
          <Row label="Conflicts" value={String(server.conflicts)} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conflicts ({conflicts.length})</Text>
        {conflicts.length === 0 ? (
          <Text style={styles.empty}>No conflicts.</Text>
        ) : (
          conflicts.map((conflict) => (
            <View key={conflict.clientRequestId} style={styles.conflict}>
              <Text style={styles.conflictTitle}>
                {conflict.entity} · {conflict.recordId}
              </Text>
              <Text style={styles.conflictReason}>{conflict.reason ?? 'Unknown reason'}</Text>
              <Text style={styles.conflictTime}>
                {new Date(conflict.createdAt).toLocaleString()}
              </Text>
              <Pressable
                onPress={async () => {
                  // The server row was already pulled; dropping the local edit
                  // means the next pull will re-apply the server values.
                  await clearConflict(conflict.clientRequestId);
                  void load();
                }}
              >
                <Text style={styles.dismiss}>Use server version</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 16, color: '#0F172A', fontWeight: '600' },
  button: { backgroundColor: '#0F766E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#99F6E4' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: '#64748B' },
  rowValue: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  empty: { fontSize: 13, color: '#94A3B8' },
  conflict: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    marginTop: 4,
    gap: 4,
  },
  conflictTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  conflictReason: { fontSize: 13, color: '#B91C1C' },
  conflictTime: { fontSize: 12, color: '#94A3B8' },
  dismiss: { fontSize: 13, fontWeight: '600', color: '#0F766E', marginTop: 4 },
});
