import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { countBeneficiaries, listHouseholds } from '../../src/db/database';
import { getSyncSnapshot } from '../../src/sync/engine';
import { subscribeOnline, subscribeSync, syncNow } from '../../src/sync/network';
import type { SyncResult } from '../../src/sync/engine';

export default function DashboardScreen() {
  const [beneficiaries, setBeneficiaries] = useState(0);
  const [households, setHouseholds] = useState(0);
  const [online, setOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  async function refresh() {
    const [count, hh, snapshot] = await Promise.all([
      countBeneficiaries(),
      listHouseholds(),
      getSyncSnapshot(),
    ]);
    setBeneficiaries(count);
    setHouseholds(hh.length);
    setLastSyncAt(snapshot.lastSyncAt);
    setPending((snapshot.counts.pending ?? 0) + (snapshot.counts.failed ?? 0));
    setConflicts(snapshot.conflicts);
  }

  useEffect(() => {
    void refresh();
    const offOnline = subscribeOnline(setOnline);
    const offSync = subscribeSync((result, busy) => {
      setSyncing(busy);
      if (result) {
        setLastResult(result);
        void refresh();
      }
    });
    return () => {
      offOnline();
      offSync();
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.banner} data-testid="connectivity-banner">
        <View style={[styles.dot, { backgroundColor: online ? '#22C55E' : '#EF4444' }]} />
        <Text style={styles.bannerText}>
          {online ? (syncing ? 'Syncing…' : 'Online') : 'Offline — changes are saved on this device'}
        </Text>
      </View>

      <View style={styles.grid}>
        <Stat label="Beneficiaries" value={beneficiaries} />
        <Stat label="Households" value={households} />
        <Stat label="Pending sync" value={pending} tone={pending > 0 ? '#B45309' : '#0F172A'} />
        <Stat label="Conflicts" value={conflicts} tone={conflicts > 0 ? '#B91C1C' : '#0F172A'} />
      </View>

      <Pressable
        style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
        onPress={() => void syncNow()}
        disabled={syncing}
        testID="sync-now"
      >
        <Text style={styles.syncButtonText}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>

      {lastResult ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>Last sync</Text>
          <Text style={styles.resultLine}>
            {lastResult.ok ? 'Completed' : 'Did not complete'}
            {lastResult.error ? `: ${lastResult.error}` : ''}
          </Text>
          <Text style={styles.resultLine}>
            Pushed {lastResult.pushed} · Pulled {lastResult.pulled} · Conflicts{' '}
            {lastResult.conflicts}
            {lastResult.hasMore ? ' · more pages pending' : ''}
          </Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        {lastSyncAt ? `Last successful sync: ${new Date(lastSyncAt).toLocaleString()}` : 'Not synced yet'}
      </Text>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  tone = '#0F172A',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bannerText: { fontSize: 14, color: '#334155', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 13, color: '#64748B' },
  syncButton: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  syncButtonDisabled: { backgroundColor: '#99F6E4' },
  syncButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  result: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 4 },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  resultLine: { fontSize: 13, color: '#475569' },
  footnote: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});
